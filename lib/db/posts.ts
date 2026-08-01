import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, like, lt, lte, ne, or, sql } from 'drizzle-orm';
import { getDb } from './index';
import { commentLikes, favorites, notifications, postComments, postParticipants, posts, subscriptions, users } from './schema';
import { resolveDisplayName } from '../store';
import { catName, getCategory } from '../categories';
import type { TitleMeta } from '../tmdb';
import { sendKakaoMemos } from '../kakao';
import { sendPush } from '../push';
import { isPastSlot, pastCutoff, todayLocal } from '../dates';
import { adminIds } from '../auth';
import { hostCountsFor } from './hosting';
import { settlementSummaries, type SettlementSummary } from './settlements';
import { DEFAULT_LOCALE, Locale, Msg, pick, toLocale } from '../i18n';
import { NOTIF } from '../notif-kinds';
import { dateLabelShort, timeLabel } from '../datefmt';

export interface PostView {
  id: string;
  category: string;
  authorId: string;
  /** 비로그인에게는 null — 누가 열었는지는 회원끼리만 본다 */
  authorName: string | null;
  title: string | null;
  titleMeta: TitleMeta | null;
  recurringRuleId: string | null; // 정기 모임 회차면 규칙 id
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  capacity: number | null;
  /** 'link'면 링크를 아는 사람만 볼 수 있는 비공개 모임 */
  visibility: 'public' | 'link';
  isPast: boolean; // 종료 후 유예가 지났는지 (앱 시간대 기준, 서버가 판정)
  createdAt: string;
  /** avatar는 모임 카드에서 접힌 상태로 얼굴만 보여줄 때 쓴다 (없으면 이름 첫 글자) */
  /**
   * hostCount는 공개 모임 주최 횟수 — 아바타 스티커(lib/hosting.ts) 용.
   * 비로그인에게는 빈 배열이 나간다. 인원수는 participantCount로 따로 준다.
   */
  participants: { id: string; name: string; avatar: string | null; hostCount: number }[];
  /** 명단과 무관하게 늘 내려가는 참가 인원수 */
  participantCount: number;
  /** 댓글도 이름이 붙으므로 비로그인에게는 개수만 준다 */
  commentCount: number;
  /** 정산이 있으면 카드에 바로 보여줄 요약 (없으면 null) */
  settle: SettlementSummary | null;
  comments: CommentView[];
}

export interface CommentView {
  id: string;
  userId: string;
  /** 익명 댓글이면 null. 화면에서 "익명"으로 그린다 */
  name: string | null;
  /** 닉네임을 감추고 쓴 댓글인지 */
  anonymous: boolean;
  body: string;
  createdAt: string;
  /** 답글이면 원 댓글 id */
  parentId: string | null;
  likeCount: number;
  /** 보고 있는 사람이 이미 눌렀는지 (비로그인이면 항상 false) */
  likedByMe: boolean;
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
export async function listPosts(category: string, past = false, viewerId?: string): Promise<PostView[]> {
  const db = await getDb();
  const { date: cutDate, time: cutTime } = pastCutoff();
  /*
   * 비공개(link) 모임은 목록에서 뺀다. 단, 만든 사람과 이미 참가한 사람은 계속 봐야 한다 —
   * 그러지 않으면 링크를 잃어버린 순간 자기 모임을 찾을 길이 없다.
   */
  const visible = viewerId
    ? or(
        eq(posts.visibility, 'public'),
        eq(posts.authorId, viewerId),
        inArray(
          posts.id,
          db.select({ id: postParticipants.postId }).from(postParticipants).where(eq(postParticipants.userId, viewerId))
        )
      )
    : eq(posts.visibility, 'public');
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
        .where(and(eq(posts.category, category), ended, visible))
        .orderBy(desc(posts.date), desc(posts.startTime))
        .limit(30)
    : await db
        .select()
        .from(posts)
        .where(and(eq(posts.category, category), upcoming, visible))
        .orderBy(posts.date, posts.startTime);
  return buildViews(postRows, viewerId);
}

/** 공유 링크(/p/[id])용 단건 뷰 조회 */
export async function getPostView(postId: string, viewerId?: string): Promise<PostView | null> {
  // 외부에서 들어오는 id이므로 uuid 형태가 아니면 캐스팅 에러 대신 404 처리
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) return null;
  const db = await getDb();
  const row = (await db.select().from(posts).where(eq(posts.id, postId)))[0];
  if (!row) return null;
  return (await buildViews([row], viewerId))[0];
}

async function buildViews(postRows: (typeof posts.$inferSelect)[], viewerId?: string): Promise<PostView[]> {
  if (postRows.length === 0) return [];
  const db = await getDb();
  const postIds = postRows.map((p) => p.id);
  const userRows = await db.select().from(users);
  const userById = new Map(userRows.map((u) => [u.id, u]));
  const participantRows = await db.select().from(postParticipants).where(inArray(postParticipants.postId, postIds));
  const hostCounts = await hostCountsFor([...new Set(participantRows.map((p) => p.userId))]);
  /*
   * 정산은 같이 낸 사람들 사이의 일이다 — 참가자(와 관리자)에게만 요약을 붙인다.
   * 그 밖에는 settle이 null이라, 정산이 있다는 사실조차 응답에 나가지 않는다.
   */
  const viewerIsAdmin = Boolean(viewerId && adminIds().includes(viewerId));
  const myPostIds = viewerIsAdmin
    ? postIds
    : viewerId
      ? [...new Set(participantRows.filter((p) => p.userId === viewerId).map((p) => p.postId))]
      : [];
  const settleByPost = await settlementSummaries(myPostIds, viewerId);
  const byPost = new Map<string, { id: string; name: string; avatar: string | null; hostCount: number }[]>();
  for (const p of participantRows) {
    if (!byPost.has(p.postId)) byPost.set(p.postId, []);
    byPost.get(p.postId)!.push({
      id: p.userId,
      name: displayNameOf(userById.get(p.userId), '알 수 없음'),
      avatar: userById.get(p.userId)?.avatar ?? null,
      hostCount: hostCounts.get(p.userId) ?? 0,
    });
  }

  const commentRows = await db
    .select()
    .from(postComments)
    .where(inArray(postComments.postId, postIds))
    .orderBy(asc(postComments.createdAt));
  // 좋아요는 댓글 수만큼 나오므로 한 번에 모아 집계한다
  const commentIds = commentRows.map((c) => c.id);
  const likeRows = commentIds.length
    ? await db.select().from(commentLikes).where(inArray(commentLikes.commentId, commentIds))
    : [];
  const likeCount = new Map<string, number>();
  const likedByViewer = new Set<string>();
  for (const l of likeRows) {
    likeCount.set(l.commentId, (likeCount.get(l.commentId) ?? 0) + 1);
    if (viewerId && l.userId === viewerId) likedByViewer.add(l.commentId);
  }

  const commentsByPost = new Map<string, PostView['comments']>();
  for (const c of commentRows) {
    if (!commentsByPost.has(c.postId)) commentsByPost.set(c.postId, []);
    // 익명 댓글은 남의 화면에서 닉네임만 가린다 (쓴 본인에게는 그대로 보인다)
    const hideName = c.anonymous && c.userId !== viewerId;
    commentsByPost.get(c.postId)!.push({
      id: c.id,
      userId: c.userId,
      name: hideName ? null : displayNameOf(userById.get(c.userId), '알 수 없음'),
      anonymous: c.anonymous,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      parentId: c.parentId ?? null,
      likeCount: likeCount.get(c.id) ?? 0,
      likedByMe: likedByViewer.has(c.id),
    });
  }

  /*
   * 로그인하지 않은 사람에게는 사람에 관한 것을 내려보내지 않는다 —
   * 시간·장소·인원수까지만. 화면에서 가리는 게 아니라 응답에서 뺀다.
   */
  const signedIn = Boolean(viewerId);

  return postRows.map((p) => ({
    id: p.id,
    category: p.category,
    authorId: p.authorId,
    authorName: signedIn ? displayNameOf(userById.get(p.authorId), '알 수 없음') : null,
    title: p.title,
    titleMeta: p.titleMeta ?? null,
    recurringRuleId: p.recurringRuleId ?? null,
    date: p.date,
    startTime: p.startTime,
    endTime: p.endTime,
    location: p.location,
    description: p.description,
    capacity: p.capacity,
    visibility: p.visibility === 'link' ? 'link' : 'public',
    isPast: isPastSlot(p.date, p.endTime),
    createdAt: p.createdAt.toISOString(),
    participants: signedIn ? (byPost.get(p.id) ?? []) : [],
    participantCount: (byPost.get(p.id) ?? []).length,
    settle: settleByPost.get(p.id) ?? null,
    comments: signedIn ? (commentsByPost.get(p.id) ?? []) : [],
    commentCount: (commentsByPost.get(p.id) ?? []).length,
  }));
}

export async function addComment(
  postId: string,
  userId: string,
  body: string,
  parentId?: string,
  anonymous = false
): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(postComments).values({ id, postId, userId, body, parentId: parentId ?? null, anonymous });
  return id;
}

/** 좋아요 토글 — 누른 뒤 상태와 개수를 돌려준다 */
export async function toggleCommentLike(
  commentId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const db = await getDb();
  const existing = await db
    .select()
    .from(commentLikes)
    .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));

  if (existing.length > 0) {
    await db
      .delete(commentLikes)
      .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, userId)));
  } else {
    await db.insert(commentLikes).values({ commentId, userId }).onConflictDoNothing();
  }

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(commentLikes)
    .where(eq(commentLikes.commentId, commentId));
  return { liked: existing.length === 0, likeCount: row?.n ?? 0 };
}

/** 댓글 알림: 댓글 단 사람을 제외한 참가자 전원에게 인앱 + 카톡 발송 */
export async function notifyComment(
  post: { id: string; category: string; date: string; startTime: string; location: string; title?: string | null },
  commenterId: string,
  commenterName: string,
  body: string,
  origin: string,
  /** 답글이면 원 댓글 작성자 — 참가자가 아니어도 알려준다 */
  parentAuthorId?: string
): Promise<void> {
  const db = await getDb();
  /*
   * 그 모임에 참가하면서 카테고리를 구독한 사람에게만 보낸다.
   *  - 참가자 전원에게 보내면 댓글 하나에 카톡이 우수수 나간다.
   *  - 구독자 전원으로 바꾸면 안 가는 모임의 댓글까지 받게 되고, 정작 참가자는
   *    "장소 바뀌었어요"를 놓친다. 그래서 둘의 교집합이다.
   * 답글은 예외 — 내 댓글에 달린 답글은 구독과 무관하게 알려준다.
   */
  const participants = await participantIdsExcept(post.id, commenterId);
  const subscribed = new Set(await subscriberIds(post.category));
  const recipients = [...new Set([
    ...participants.filter((id) => subscribed.has(id)),
    ...(parentAuthorId && parentAuthorId !== commenterId ? [parentAuthorId] : []),
  ])];
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
  // 친구 알림 — 주어가 모임이 아니라 사람이라 이름이 앞에 온다
  meetup: { ko: '모임', en: 'meetup' },
  friendJoinLine: { ko: '{name}님이 참가했어요 · {text}', en: '{name} joined · {text}' },
  addedLine: { ko: '{name}님이 이 모임에 넣었어요 · {text}', en: '{name} added you · {text}' },
  inviteLine: { ko: '{name}님이 초대했어요 · {text}', en: '{name} invited you · {text}' },
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

/**
 * 언어 그룹별로 카톡 메모 + 앱 푸시 발송.
 * 두 경로는 서로 독립이다 — 카톡을 거부한 사람은 푸시로, 푸시를 안 켠 사람은 카톡으로 받는다.
 */
async function sendNotice(notice: Notice, linkUrl: string): Promise<void> {
  for (const g of notice.groups) {
    await sendKakaoMemos(g.userIds, g.message, linkUrl, g.button);
    await sendPush(g.userIds, {
      title: APP_NAME,
      body: g.message,
      url: linkUrl,
      // 같은 모임의 알림끼리는 덮어쓴다 — 댓글이 연달아 달려도 알림함이 밀리지 않게
      tag: noticeTag(linkUrl),
    });
  }
}

/**
 * 인앱 알림만 남긴다 — 카톡도 푸시도 보내지 않는다.
 *
 * 친구 소식은 알림함에서 확인하면 되는 것이지 폰이 울릴 일이 아니다. 친구가 열 명이면
 * 각자 모임에 들어갈 때마다 진동이 오게 되고, 그러면 사람들이 알림부터 꺼 버린다.
 * 이 경로에는 sendNotice가 아예 없어서 "조용한 알림"이 구조로 지켜진다.
 */
export async function insertInAppNotice(
  recipients: string[],
  postId: string | null,
  kind: string,
  render: (locale: Locale) => string
): Promise<void> {
  const notice = await buildNotice(recipients, render); // 언어별 문구 만들기는 그대로 재사용
  if (notice.rows.length === 0) return;
  const db = await getDb();
  await db
    .insert(notifications)
    .values(notice.rows.map((r) => ({ id: crypto.randomUUID(), userId: r.userId, postId, kind, message: r.message })));
}

/**
 * 친구가 모임에 참가했음을 그 사람의 친구들에게 알린다.
 *
 * 비공개(link) 모임은 알리지 않는다 — 링크를 받은 사람만 알아야 하는 모임인데,
 * 참가 알림이 나가면 "누가 어떤 모임에 갔다"는 사실이 링크 없는 사람에게 새어 나간다.
 */
export async function notifyFriendJoin(
  post: {
    id: string;
    category: string;
    date: string;
    startTime: string;
    location: string;
    title?: string | null;
    visibility?: string | null;
  },
  joinerName: string,
  recipientIds: string[]
): Promise<void> {
  if (post.visibility === 'link' || recipientIds.length === 0) return;
  await insertInAppNotice(
    recipientIds,
    post.id,
    NOTIF.friendJoin,
    (locale) =>
      `🤝 ${pick(locale, N.friendJoinLine, {
        name: joinerName,
        text: describeForNotification(post.category, N.meetup, post.date, post.startTime, post.location, post.title, locale),
      })}`
  );
}

/** 남이 나를 모임에 넣었을 때 — 넣긴 사람에게 한 줄 */
export async function notifyAddedToPost(
  post: { id: string; category: string; date: string; startTime: string; location: string; title?: string | null },
  actorName: string,
  addedUserId: string
): Promise<void> {
  await insertInAppNotice(
    [addedUserId],
    post.id,
    NOTIF.added,
    (locale) =>
      `🤝 ${pick(locale, N.addedLine, {
        name: actorName,
        text: describeForNotification(post.category, N.meetup, post.date, post.startTime, post.location, post.title, locale),
      })}`
  );
}

/** 이미 이 모임의 참가자인지 — 대신 추가에서 중복 알림을 막는 데 쓴다 */
export async function isParticipant(postId: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .select({ userId: postParticipants.userId })
    .from(postParticipants)
    .where(and(eq(postParticipants.postId, postId), eq(postParticipants.userId, userId)));
  return rows.length > 0;
}

/** 알림 제목 — 어느 앱에서 온 알림인지가 먼저 보여야 한다 */
const APP_NAME = 'Kansas Korean';

/** 링크의 경로를 묶음 키로 쓴다 (예: /p/<id>) */
function noticeTag(linkUrl: string): string | undefined {
  try {
    return new URL(linkUrl).pathname;
  } catch {
    return undefined;
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
  amcShowtimeId?: string; // AMC 회차에서 만든 모임이면 그 회차 id
  visibility?: 'public' | 'link'; // 'link'면 구독자 알림을 보내지 않는다
  /** 비공개 모임을 알릴 친구들 — 라우트에서 이미 "내 친구"로 걸러 온다 */
  inviteFriendIds?: string[];
  label?: Msg; // 알림 문구 (기본 '새 모임', 정기 모임은 '이번 주 모임')
  origin?: string; // 카톡 알림의 "모임 보기" 링크 base URL (요청 origin)
}): Promise<string> {
  const db = await getDb();
  const postId = crypto.randomUUID();

  /*
   * 비공개 모임은 구독자에게 알리지 않는다. 알림에 제목·시간·장소가 그대로 담기므로
   * 링크를 받지 않은 사람에게 내용이 새는 통로가 된다.
   */
  const subscriberRows =
    input.visibility === 'link'
      ? []
      : await db
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
    amcShowtimeId: input.amcShowtimeId ?? null,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    description: input.description ?? null,
    capacity: input.capacity ?? null,
    visibility: input.visibility ?? 'public',
  };
  const notificationValues = notice.rows.map((r) => ({
    id: crypto.randomUUID(),
    userId: r.userId,
    postId,
    message: r.message,
  }));

  /*
   * 비공개 모임에 부른 친구들. 구독자 알림과 섞지 않는다 — 저쪽은 카톡·푸시까지 나가는
   * 묶음이고, 이쪽은 인앱 한 줄이다. 모임을 만드는 같은 트랜잭션에 넣어 두면
   * 모임만 생기고 초대는 안 가는 어중간한 상태가 생기지 않는다.
   */
  const inviteNotice =
    input.visibility === 'link' && (input.inviteFriendIds?.length ?? 0) > 0
      ? await buildNotice(input.inviteFriendIds!, (locale) =>
          `🤝 ${pick(locale, N.inviteLine, {
            name: input.authorName,
            text: describeForNotification(
              input.category,
              N.meetup,
              input.date,
              input.startTime,
              input.location,
              input.title,
              locale
            ),
          })}`
        )
      : null;
  const inviteValues = (inviteNotice?.rows ?? []).map((r) => ({
    id: crypto.randomUUID(),
    userId: r.userId,
    postId,
    kind: NOTIF.invite,
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
    if (inviteValues.length > 0) statements.push(db.insert(notifications).values(inviteValues));
    await anyDb.batch(statements);
  } else {
    // PGlite(로컬 폴백): 인터랙티브 트랜잭션 사용
    await anyDb.transaction(async (tx: typeof db) => {
      await tx.insert(posts).values(postValues);
      await tx.insert(postParticipants).values({ postId, userId: input.authorId });
      if (notificationValues.length > 0) await tx.insert(notifications).values(notificationValues);
      if (inviteValues.length > 0) await tx.insert(notifications).values(inviteValues);
    });
  }

  // 구독자에게 카카오톡 "나에게 보내기" 발송 (토큰 없는 사용자는 인앱 알림만)
  if (input.origin && notificationValues.length > 0) {
    await sendNotice(notice, `${input.origin}/p/${postId}`);
  }
  return postId;
}

/** 이 AMC 회차로 이미 만든 모임이 있는지 */
export async function findPostByShowtime(showtimeId: string): Promise<{ id: string } | null> {
  const db = await getDb();
  const [row] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(eq(posts.amcShowtimeId, showtimeId))
    .limit(1);
  return row ?? null;
}

/** 회차 id → 모임 id 매핑 (여러 개를 한 번에) */
export async function postIdsByShowtime(showtimeIds: string[]): Promise<Record<string, string>> {
  if (showtimeIds.length === 0) return {};
  const db = await getDb();
  const rows = await db
    .select({ id: posts.id, showtimeId: posts.amcShowtimeId })
    .from(posts)
    .where(inArray(posts.amcShowtimeId, showtimeIds));
  return Object.fromEntries(rows.filter((r) => r.showtimeId).map((r) => [r.showtimeId as string, r.id]));
}

/** 회차를 고른 사람들을 한 번에 참가자로 넣는다 (이미 있으면 그대로 둔다) */
export async function addParticipants(postId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const db = await getDb();
  await db
    .insert(postParticipants)
    .values(userIds.map((userId) => ({ postId, userId })))
    .onConflictDoNothing();
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
/** 이 카테고리를 구독한 사람 */
async function subscriberIds(category: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(eq(subscriptions.category, category));
  return rows.map((r) => r.userId);
}

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
  /** 주지 않으면 지금 값을 그대로 둔다 */
  visibility?: 'public' | 'link';
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
    ...(input.visibility ? { visibility: input.visibility } : {}),
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

/** 즐겨찾기한 카테고리 — 사용자가 정한 순서대로 */
export async function getFavorites(userId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(favorites)
    .where(eq(favorites.userId, userId))
    .orderBy(asc(favorites.sort), asc(favorites.createdAt));
  // 없어진 카테고리(예전 AMC)의 행은 걸러 낸다 — 지우진 않는다. 화면에 그릴 카드가
  // 없는 슬러그가 목록에 남아 있으면 드래그 정렬이 유령 항목을 잡는다.
  return rows.map((r) => r.category).filter((slug) => getCategory(slug) !== undefined);
}

export async function setFavorite(userId: string, category: string, on: boolean): Promise<void> {
  const db = await getDb();
  if (!on) {
    await db.delete(favorites).where(and(eq(favorites.userId, userId), eq(favorites.category, category)));
    return;
  }
  // 새로 추가하는 건 맨 뒤에 붙인다
  const [row] = await db
    .select({ max: sql<number | null>`max(${favorites.sort})` })
    .from(favorites)
    .where(eq(favorites.userId, userId));
  const sort = (row?.max ?? -1) + 1;
  await db.insert(favorites).values({ userId, category, sort }).onConflictDoNothing();
}

/** 드래그로 바꾼 순서 저장 — 목록에 있는 것만 반영하고 나머지는 뒤에 남는다 */
export async function reorderFavorites(userId: string, order: string[]): Promise<void> {
  const db = await getDb();
  const mine = new Set(await getFavorites(userId));
  const valid = order.filter((c) => mine.has(c));
  for (const [i, category] of valid.entries()) {
    await db
      .update(favorites)
      .set({ sort: i })
      .where(and(eq(favorites.userId, userId), eq(favorites.category, category)));
  }
}

export async function listNotifications(userId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: notifications.id,
      postId: notifications.postId,
      kind: notifications.kind,
      message: notifications.message,
      read: notifications.read,
      createdAt: notifications.createdAt,
      category: posts.category,
    })
    .from(notifications)
    .leftJoin(posts, eq(notifications.postId, posts.id))
    .where(and(eq(notifications.userId, userId), isNull(notifications.deletedAt)))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function unreadCount(userId: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), eq(notifications.read, false), isNull(notifications.deletedAt))
    );
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

/**
 * 알림 지우기 — 실제로 지우지 않고 표시만 한다 (관리자 화면에서 남은 것을 본다).
 * 남의 알림을 지울 수 없도록 소유자까지 조건에 넣는다.
 */
export async function softDeleteNotification(id: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(notifications)
    .set({ deletedAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNull(notifications.deletedAt)))
    .returning();
  return rows.length > 0;
}

/** 관리자 화면용 — 지워진 알림 목록 (누가 무엇을 지웠는지) */
export async function listDeletedNotifications(limit = 100) {
  const db = await getDb();
  const rows = await db
    .select({
      id: notifications.id,
      message: notifications.message,
      createdAt: notifications.createdAt,
      deletedAt: notifications.deletedAt,
      userId: notifications.userId,
      kakaoName: users.kakaoName,
      nickname: users.nickname,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .where(isNotNull(notifications.deletedAt))
    .orderBy(desc(notifications.deletedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    name: displayNameOf({ kakaoName: r.kakaoName, nickname: r.nickname }, '알 수 없음'),
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt!.toISOString(),
  }));
}
