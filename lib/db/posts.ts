import { and, asc, desc, eq, gt, inArray, like, lt, lte, ne, or, sql } from 'drizzle-orm';
import { getDb } from './index';
import { notifications, postComments, postParticipants, posts, subscriptions, users } from './schema';
import { resolveDisplayName } from '../store';
import { catName, getCategory } from '../categories';
import type { TitleMeta } from '../tmdb';
import { sendKakaoMemos } from '../kakao';
import { isPastSlot, pastCutoff, todayLocal } from '../dates';
import { DEFAULT_LOCALE, Locale, Msg, pick, toLocale } from '../i18n';
import { dateLabelShort, timeLabel } from '../datefmt';

export interface PostView {
  id: string;
  category: string;
  authorId: string;
  authorName: string;
  title: string | null;
  titleMeta: TitleMeta | null;
  recurringRuleId: string | null; // 정기 모임 회차면 규칙 id
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  capacity: number | null;
  isPast: boolean; // 종료 후 유예가 지났는지 (앱 시간대 기준, 서버가 판정)
  createdAt: string;
  participants: { id: string; name: string }[];
  comments: { id: string; userId: string; name: string; body: string; createdAt: string }[];
}

function displayNameOf(row: { kakaoName: string; nickname: string | null } | undefined, fallback: string): string {
  if (!row) return fallback;
  return resolveDisplayName(
    { kakaoName: row.kakaoName, ...(row.nickname ? { nickname: row.nickname } : {}), kakaoNameHistory: [] },
    fallback
  );
}

/**
 * 포스트 목록 (참가자·작성자 표시 이름, 댓글 포함).
 * 기준은 날짜가 아니라 (종료 시각 + 유예)이므로, 오늘 낮에 끝난 모임도 그날 바로 지난 모임이 된다.
 * past=false: 아직 안 끝난 모임, 가까운 순. past=true: 끝난 모임, 최근 순 최대 30개.
 */
export async function listPosts(category: string, past = false): Promise<PostView[]> {
  const db = await getDb();
  const { date: cutDate, time: cutTime } = pastCutoff();
  // 끝난 모임: 날짜가 지났거나, 같은 날인데 종료 시각이 기준 시각을 넘겼을 때
  const ended = or(
    lt(posts.date, cutDate),
    and(eq(posts.date, cutDate), lte(posts.endTime, cutTime))
  );
  const upcoming = or(
    gt(posts.date, cutDate),
    and(eq(posts.date, cutDate), gt(posts.endTime, cutTime))
  );
  const postRows = past
    ? await db
        .select()
        .from(posts)
        .where(and(eq(posts.category, category), ended))
        .orderBy(desc(posts.date), desc(posts.startTime))
        .limit(30)
    : await db
        .select()
        .from(posts)
        .where(and(eq(posts.category, category), upcoming))
        .orderBy(posts.date, posts.startTime);
  return buildViews(postRows);
}

/** 공유 링크(/p/[id])용 단건 뷰 조회 */
export async function getPostView(postId: string): Promise<PostView | null> {
  // 외부에서 들어오는 id이므로 uuid 형태가 아니면 캐스팅 에러 대신 404 처리
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) return null;
  const db = await getDb();
  const row = (await db.select().from(posts).where(eq(posts.id, postId)))[0];
  if (!row) return null;
  return (await buildViews([row]))[0];
}

async function buildViews(postRows: (typeof posts.$inferSelect)[]): Promise<PostView[]> {
  if (postRows.length === 0) return [];
  const db = await getDb();
  const postIds = postRows.map((p) => p.id);
  const userRows = await db.select().from(users);
  const userById = new Map(userRows.map((u) => [u.id, u]));
  const participantRows = await db.select().from(postParticipants).where(inArray(postParticipants.postId, postIds));
  const byPost = new Map<string, { id: string; name: string }[]>();
  for (const p of participantRows) {
    if (!byPost.has(p.postId)) byPost.set(p.postId, []);
    byPost.get(p.postId)!.push({ id: p.userId, name: displayNameOf(userById.get(p.userId), '알 수 없음') });
  }

  const commentRows = await db
    .select()
    .from(postComments)
    .where(inArray(postComments.postId, postIds))
    .orderBy(asc(postComments.createdAt));
  const commentsByPost = new Map<string, PostView['comments']>();
  for (const c of commentRows) {
    if (!commentsByPost.has(c.postId)) commentsByPost.set(c.postId, []);
    commentsByPost.get(c.postId)!.push({
      id: c.id,
      userId: c.userId,
      name: displayNameOf(userById.get(c.userId), '알 수 없음'),
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    });
  }

  return postRows.map((p) => ({
    id: p.id,
    category: p.category,
    authorId: p.authorId,
    authorName: displayNameOf(userById.get(p.authorId), '알 수 없음'),
    title: p.title,
    titleMeta: p.titleMeta ?? null,
    recurringRuleId: p.recurringRuleId ?? null,
    date: p.date,
    startTime: p.startTime,
    endTime: p.endTime,
    location: p.location,
    description: p.description,
    capacity: p.capacity,
    isPast: isPastSlot(p.date, p.endTime),
    createdAt: p.createdAt.toISOString(),
    participants: byPost.get(p.id) ?? [],
    comments: commentsByPost.get(p.id) ?? [],
  }));
}

export async function addComment(postId: string, userId: string, body: string): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(postComments).values({ id, postId, userId, body });
  return id;
}

/** 댓글 알림: 댓글 단 사람을 제외한 참가자 전원에게 인앱 + 카톡 발송 */
export async function notifyComment(
  post: { id: string; category: string; date: string; startTime: string; location: string; title?: string | null },
  commenterId: string,
  commenterName: string,
  body: string,
  origin: string
): Promise<void> {
  const db = await getDb();
  const recipients = await participantIdsExcept(post.id, commenterId);
  if (recipients.length === 0) return;

  const snippet = body.length > 60 ? `${body.slice(0, 60)}…` : body;
  const notice = await buildNotice(
    recipients,
    (locale) =>
      `💬 ${pick(locale, N.commentLine, {
        text: describeForNotification(post.category, N.comment, post.date, post.startTime, post.location, post.title, locale),
        name: commenterName,
        body: snippet,
      })}`,
    N.btnComment
  );
  await db.insert(notifications).values(
    notice.rows.map((r) => ({ id: crypto.randomUUID(), userId: r.userId, postId: post.id, message: r.message }))
  );
  await sendNotice(notice, `${origin}/p/${post.id}`);
}

export async function getComment(commentId: string) {
  const db = await getDb();
  return (await db.select().from(postComments).where(eq(postComments.id, commentId)))[0];
}

export async function deleteComment(commentId: string): Promise<void> {
  const db = await getDb();
  await db.delete(postComments).where(eq(postComments.id, commentId));
}

/** 리마인더 알림 식별용 접두사 — 중복 발송 방지에 쓰이므로 메시지 앞부분을 바꾸지 말 것 */
const REMINDER_PREFIX = '⏰';

/** 알림 문구 조각 (수신자 언어로 렌더된다) */
const N = {
  newPost: { ko: '새 모임', en: 'new meetup' },
  weekly: { ko: '이번 주 모임', en: 'this week' },
  updated: { ko: '모임 변경', en: 'updated' },
  cancelled: { ko: '모임 취소', en: 'cancelled' },
  comment: { ko: '새 댓글', en: 'new comment' },
  today: { ko: '오늘 모임', en: 'today' },
  byActor: { ko: '{text} — {name}', en: '{text} — {name}' },
  commentLine: { ko: '{text} — {name}: {body}', en: '{text} — {name}: {body}' },
  btnPost: { ko: '모임 보기', en: 'View meetup' },
  btnComment: { ko: '댓글 보기', en: 'View comments' },
  btnOther: { ko: '다른 모임 보기', en: 'See other meetups' },
};

/** 알림 메시지용 모임 설명: "🥒 피클볼 새 모임 · 8/1(토) 오후 6:00 · OP코트" (제목이 있으면 〈제목〉 삽입) */
function describeForNotification(
  category: string,
  label: Msg,
  date: string,
  startTime: string,
  location: string,
  title: string | null | undefined,
  locale: Locale
): string {
  const cat = getCategory(category);
  const titlePart = title ? ` 〈${title}〉` : '';
  const when = `${dateLabelShort(date, locale)} ${timeLabel(startTime, locale)}`;
  return `${cat?.emoji ?? ''} ${catName(category, locale)} ${pick(locale, label)}${titlePart} · ${when} · ${location}`;
}

interface Notice {
  /** 인앱 알림 행 (수신자마다 자기 언어의 문구) */
  rows: { userId: string; message: string }[];
  /** 카톡 발송 단위 — 같은 언어끼리 묶는다 */
  groups: { userIds: string[]; message: string; button: string }[];
}

/**
 * 수신자를 언어별로 묶어 각자의 언어로 문구를 만든다.
 * users 행이 없는 수신자(이론상 없음)는 기본 언어로 취급한다.
 */
async function buildNotice(
  recipients: string[],
  render: (locale: Locale) => string,
  button: Msg = N.btnPost
): Promise<Notice> {
  if (recipients.length === 0) return { rows: [], groups: [] };
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, locale: users.locale })
    .from(users)
    .where(inArray(users.id, recipients));

  const byLocale = new Map<Locale, string[]>();
  const known = new Set(rows.map((r) => r.id));
  for (const r of rows) {
    const locale = toLocale(r.locale);
    if (!byLocale.has(locale)) byLocale.set(locale, []);
    byLocale.get(locale)!.push(r.id);
  }
  const missing = recipients.filter((id) => !known.has(id));
  if (missing.length > 0) {
    if (!byLocale.has(DEFAULT_LOCALE)) byLocale.set(DEFAULT_LOCALE, []);
    byLocale.get(DEFAULT_LOCALE)!.push(...missing);
  }

  const groups = [...byLocale].map(([locale, userIds]) => ({
    userIds,
    message: render(locale),
    button: pick(locale, button),
  }));
  return { rows: groups.flatMap((g) => g.userIds.map((userId) => ({ userId, message: g.message }))), groups };
}

/** 언어 그룹별로 카톡 메모 발송 */
async function sendNotice(notice: Notice, linkUrl: string): Promise<void> {
  for (const g of notice.groups) {
    await sendKakaoMemos(g.userIds, g.message, linkUrl, g.button);
  }
}

/**
 * 포스트 생성 + 작성자 자동 참가 + 구독자(작성자 제외) 알림을 하나의 batch(단일 트랜잭션)로 실행.
 * neon-http는 인터랙티브 트랜잭션을 지원하지 않으므로 id를 앱에서 생성해 batch를 쓴다.
 */
export async function createPost(input: {
  category: string;
  authorId: string;
  authorName: string;
  title?: string;
  titleMeta?: TitleMeta;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description?: string;
  capacity?: number;
  recurringRuleId?: string; // 정기 모임 규칙에서 생성된 회차면 규칙 id
  label?: Msg; // 알림 문구 (기본 '새 모임', 정기 모임은 '이번 주 모임')
  origin?: string; // 카톡 알림의 "모임 보기" 링크 base URL (요청 origin)
}): Promise<string> {
  const db = await getDb();
  const postId = crypto.randomUUID();

  const subscriberRows = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(and(eq(subscriptions.category, input.category), ne(subscriptions.userId, input.authorId)));

  const notice = await buildNotice(
    subscriberRows.map((r) => r.userId),
    (locale) =>
      pick(locale, N.byActor, {
        text: describeForNotification(
          input.category,
          input.label ?? N.newPost,
          input.date,
          input.startTime,
          input.location,
          input.title,
          locale
        ),
        name: input.authorName,
      })
  );

  const postValues = {
    id: postId,
    category: input.category,
    authorId: input.authorId,
    title: input.title ?? null,
    titleMeta: input.titleMeta ?? null,
    recurringRuleId: input.recurringRuleId ?? null,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    description: input.description ?? null,
    capacity: input.capacity ?? null,
  };
  const notificationValues = notice.rows.map((r) => ({
    id: crypto.randomUUID(),
    userId: r.userId,
    postId,
    message: r.message,
  }));

  const anyDb = db as any;
  if (typeof anyDb.batch === 'function') {
    // neon-http: batch = 단일 트랜잭션
    const statements: unknown[] = [
      db.insert(posts).values(postValues),
      db.insert(postParticipants).values({ postId, userId: input.authorId }),
    ];
    if (notificationValues.length > 0) statements.push(db.insert(notifications).values(notificationValues));
    await anyDb.batch(statements);
  } else {
    // PGlite(로컬 폴백): 인터랙티브 트랜잭션 사용
    await anyDb.transaction(async (tx: typeof db) => {
      await tx.insert(posts).values(postValues);
      await tx.insert(postParticipants).values({ postId, userId: input.authorId });
      if (notificationValues.length > 0) await tx.insert(notifications).values(notificationValues);
    });
  }

  // 구독자에게 카카오톡 "나에게 보내기" 발송 (토큰 없는 사용자는 인앱 알림만)
  if (input.origin && notificationValues.length > 0) {
    await sendNotice(notice, `${input.origin}/p/${postId}`);
  }
  return postId;
}

export async function getPost(postId: string) {
  const db = await getDb();
  return (await db.select().from(posts).where(eq(posts.id, postId)))[0];
}

export async function countParticipants(postId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(postParticipants)
    .where(eq(postParticipants.postId, postId));
  return row?.count ?? 0;
}

/** 참가자(actor 제외) 목록 조회 — 변경/취소 알림 수신자 */
async function participantIdsExcept(postId: string, actorId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ userId: postParticipants.userId })
    .from(postParticipants)
    .where(and(eq(postParticipants.postId, postId), ne(postParticipants.userId, actorId)));
  return rows.map((r) => r.userId);
}

/** 모임 수정 + 참가자(수정자 제외)에게 변경 알림을 단일 트랜잭션으로 실행 */
export async function updatePost(input: {
  postId: string;
  category: string;
  actorId: string;
  actorName: string;
  title: string | null;
  titleMeta: TitleMeta | null;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  capacity: number | null;
  origin?: string;
}): Promise<void> {
  const db = await getDb();
  const recipients = await participantIdsExcept(input.postId, input.actorId);
  const notice = await buildNotice(recipients, (locale) =>
    pick(locale, N.byActor, {
      text: describeForNotification(
        input.category,
        N.updated,
        input.date,
        input.startTime,
        input.location,
        input.title,
        locale
      ),
      name: input.actorName,
    })
  );

  const set = {
    title: input.title,
    titleMeta: input.titleMeta,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    description: input.description,
    capacity: input.capacity,
  };
  const notificationValues = notice.rows.map((r) => ({
    id: crypto.randomUUID(),
    userId: r.userId,
    postId: input.postId,
    message: r.message,
  }));

  const anyDb = db as any;
  if (typeof anyDb.batch === 'function') {
    const statements: unknown[] = [db.update(posts).set(set).where(eq(posts.id, input.postId))];
    if (notificationValues.length > 0) statements.push(db.insert(notifications).values(notificationValues));
    await anyDb.batch(statements);
  } else {
    await anyDb.transaction(async (tx: typeof db) => {
      await tx.update(posts).set(set).where(eq(posts.id, input.postId));
      if (notificationValues.length > 0) await tx.insert(notifications).values(notificationValues);
    });
  }

  if (input.origin && recipients.length > 0) {
    await sendNotice(notice, `${input.origin}/p/${input.postId}`);
  }
}

/**
 * 모임 삭제(취소) + 참가자(취소자 제외)에게 취소 알림.
 * 취소 알림은 postId를 null로 저장해 포스트 삭제 CASCADE에 지워지지 않게 한다.
 */
export async function deletePost(
  post: { id: string; category: string; date: string; startTime: string; location: string; title?: string | null },
  actorId: string,
  actorName: string,
  origin?: string
): Promise<void> {
  const db = await getDb();
  const recipients = await participantIdsExcept(post.id, actorId);
  const notice = await buildNotice(
    recipients,
    (locale) =>
      pick(locale, N.byActor, {
        text: describeForNotification(post.category, N.cancelled, post.date, post.startTime, post.location, post.title, locale),
        name: actorName,
      }),
    N.btnOther
  );
  const notificationValues = notice.rows.map((r) => ({
    id: crypto.randomUUID(),
    userId: r.userId,
    postId: null,
    message: r.message,
  }));

  const anyDb = db as any;
  if (typeof anyDb.batch === 'function') {
    const statements: unknown[] = [db.delete(posts).where(eq(posts.id, post.id))]; // 참가·기존 알림은 CASCADE
    if (notificationValues.length > 0) statements.unshift(db.insert(notifications).values(notificationValues));
    await anyDb.batch(statements);
  } else {
    await anyDb.transaction(async (tx: typeof db) => {
      if (notificationValues.length > 0) await tx.insert(notifications).values(notificationValues);
      await tx.delete(posts).where(eq(posts.id, post.id));
    });
  }

  // 취소된 모임은 상세 페이지가 사라지므로 카테고리 피드로 링크
  if (origin && recipients.length > 0) {
    // 취소된 모임은 상세 페이지가 없으므로 목록으로 보낸다
    await sendNotice(notice, `${origin}/c/${post.category}`);
  }
}

/**
 * 오늘 모임 리마인더 (Vercel Cron이 매일 아침 호출).
 * 오늘 날짜의 모든 모임 참가자(작성자 포함)에게 인앱 알림 + 카톡 메모 발송.
 *
 * 하루에 여러 번 호출돼도 같은 모임에는 한 번만 보낸다 — 이미 보낸 리마인더 알림이
 * 남아 있으면 건너뛴다 (리마인더 메시지는 REMINDER_PREFIX로 식별).
 */
export async function sendTodayReminders(
  origin: string
): Promise<{ posts: number; recipients: number; skipped: number }> {
  const db = await getDb();
  const today = todayLocal();
  const todayPosts = await db.select().from(posts).where(eq(posts.date, today));
  if (todayPosts.length === 0) return { posts: 0, recipients: 0, skipped: 0 };

  const todayPostIds = todayPosts.map((p) => p.id);
  const alreadySent = new Set(
    (
      await db
        .select({ postId: notifications.postId })
        .from(notifications)
        .where(
          and(inArray(notifications.postId, todayPostIds), like(notifications.message, `${REMINDER_PREFIX}%`))
        )
    ).map((r) => r.postId)
  );

  const participantRows = await db
    .select()
    .from(postParticipants)
    .where(inArray(postParticipants.postId, todayPostIds));
  const byPost = new Map<string, string[]>();
  for (const r of participantRows) {
    if (!byPost.has(r.postId)) byPost.set(r.postId, []);
    byPost.get(r.postId)!.push(r.userId);
  }

  let recipients = 0;
  let skipped = 0;
  let sentPosts = 0;
  for (const post of todayPosts) {
    if (alreadySent.has(post.id)) {
      skipped++;
      continue;
    }
    const userIds = byPost.get(post.id) ?? [];
    if (userIds.length === 0) continue;
    recipients += userIds.length;
    sentPosts++;
    const notice = await buildNotice(
      userIds,
      (locale) =>
        `${REMINDER_PREFIX} ${describeForNotification(post.category, N.today, post.date, post.startTime, post.location, post.title, locale)}`
    );
    await db.insert(notifications).values(
      notice.rows.map((r) => ({ id: crypto.randomUUID(), userId: r.userId, postId: post.id, message: r.message }))
    );
    await sendNotice(notice, `${origin}/p/${post.id}`);
  }
  return { posts: sentPosts, recipients, skipped };
}

/** 참가 등록. 정원이 차 있으면 false 반환 (이미 참가 중이면 항상 true). */
export async function joinPost(postId: string, userId: string, capacity: number | null): Promise<boolean> {
  const db = await getDb();
  const already = await db
    .select()
    .from(postParticipants)
    .where(and(eq(postParticipants.postId, postId), eq(postParticipants.userId, userId)));
  if (already.length > 0) return true;

  if (capacity != null) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(postParticipants)
      .where(eq(postParticipants.postId, postId));
    if ((row?.count ?? 0) >= capacity) return false;
  }
  await db.insert(postParticipants).values({ postId, userId }).onConflictDoNothing();
  return true;
}

export async function leavePost(postId: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(postParticipants).where(and(eq(postParticipants.postId, postId), eq(postParticipants.userId, userId)));
}

export async function getSubscriptions(userId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
  return rows.map((r) => r.category);
}

export async function setSubscription(userId: string, category: string, subscribed: boolean): Promise<void> {
  const db = await getDb();
  if (subscribed) {
    await db.insert(subscriptions).values({ userId, category }).onConflictDoNothing();
  } else {
    await db.delete(subscriptions).where(and(eq(subscriptions.userId, userId), eq(subscriptions.category, category)));
  }
}

export async function listNotifications(userId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: notifications.id,
      postId: notifications.postId,
      message: notifications.message,
      read: notifications.read,
      createdAt: notifications.createdAt,
      category: posts.category,
    })
    .from(notifications)
    .leftJoin(posts, eq(notifications.postId, posts.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function unreadCount(userId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return row?.count ?? 0;
}

export async function markNotificationsRead(userId: string, ids?: string[]): Promise<void> {
  const db = await getDb();
  if (ids && ids.length > 0) {
    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), inArray(notifications.id, ids)));
  } else {
    await db.update(notifications).set({ read: true }).where(eq(notifications.userId, userId));
  }
}
