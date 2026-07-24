import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import { getDb } from './index';
import { notifications, postComments, postParticipants, posts, subscriptions, users } from './schema';
import { resolveDisplayName } from '../store';
import { getCategory } from '../categories';
import type { TitleMeta } from '../tmdb';
import { sendKakaoMemos } from '../kakao';

export interface PostView {
  id: string;
  category: string;
  authorId: string;
  authorName: string;
  title: string | null;
  titleMeta: TitleMeta | null;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  capacity: number | null;
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

function todayLocal(): string {
  // 미국 중부(극장/모임 기준) 근처 사용자 대상 소규모 앱 — 서버 로컬 날짜로 충분
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * 포스트 목록 (참가자·작성자 표시 이름, 댓글 포함).
 * past=false: 오늘 이후, 가까운 순. past=true: 오늘 이전(지난 모임), 최근 순 최대 30개.
 */
export async function listPosts(category: string, past = false): Promise<PostView[]> {
  const db = await getDb();
  const today = todayLocal();
  const postRows = past
    ? await db
        .select()
        .from(posts)
        .where(and(eq(posts.category, category), lt(posts.date, today)))
        .orderBy(desc(posts.date), desc(posts.startTime))
        .limit(30)
    : await db
        .select()
        .from(posts)
        .where(and(eq(posts.category, category), gte(posts.date, today)))
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
    date: p.date,
    startTime: p.startTime,
    endTime: p.endTime,
    location: p.location,
    description: p.description,
    capacity: p.capacity,
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

export async function getComment(commentId: string) {
  const db = await getDb();
  return (await db.select().from(postComments).where(eq(postComments.id, commentId)))[0];
}

export async function deleteComment(commentId: string): Promise<void> {
  const db = await getDb();
  await db.delete(postComments).where(eq(postComments.id, commentId));
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** 알림 메시지용 모임 설명: "🥒 피클볼 {label} · 8/1(토) 오후 6:00 · OP코트" (제목이 있으면 〈제목〉 삽입) */
function describeForNotification(
  category: string,
  label: string,
  date: string,
  startTime: string,
  location: string,
  title?: string | null
): string {
  const cat = getCategory(category);
  const [y, m, d] = date.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const [h, min] = startTime.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const titlePart = title ? ` 〈${title}〉` : '';
  return `${cat?.emoji ?? ''} ${cat?.name ?? category} ${label}${titlePart} · ${m}/${d}(${wd}) ${ampm} ${h12}:${String(min).padStart(2, '0')} · ${location}`;
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
  origin?: string; // 카톡 알림의 "모임 보기" 링크 base URL (요청 origin)
}): Promise<string> {
  const db = await getDb();
  const postId = crypto.randomUUID();

  const subscriberRows = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(and(eq(subscriptions.category, input.category), ne(subscriptions.userId, input.authorId)));

  const message = `${describeForNotification(input.category, '새 모임', input.date, input.startTime, input.location, input.title)} — ${input.authorName}`;

  const postValues = {
    id: postId,
    category: input.category,
    authorId: input.authorId,
    title: input.title ?? null,
    titleMeta: input.titleMeta ?? null,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    description: input.description ?? null,
    capacity: input.capacity ?? null,
  };
  const notificationValues = subscriberRows.map((s) => ({
    id: crypto.randomUUID(),
    userId: s.userId,
    postId,
    message,
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
    await sendKakaoMemos(notificationValues.map((n) => n.userId), message, `${input.origin}/p/${postId}`);
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
  const message = `${describeForNotification(input.category, '모임 변경', input.date, input.startTime, input.location, input.title)} — ${input.actorName}`;

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
  const notificationValues = recipients.map((userId) => ({
    id: crypto.randomUUID(),
    userId,
    postId: input.postId,
    message,
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
    await sendKakaoMemos(recipients, message, `${input.origin}/p/${input.postId}`);
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
  const message = `${describeForNotification(post.category, '모임 취소', post.date, post.startTime, post.location, post.title)} — ${actorName}`;
  const notificationValues = recipients.map((userId) => ({
    id: crypto.randomUUID(),
    userId,
    postId: null,
    message,
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
    await sendKakaoMemos(recipients, message, `${origin}/c/${post.category}`);
  }
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
