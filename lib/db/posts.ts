import { and, desc, eq, gte, inArray, ne, sql } from 'drizzle-orm';
import { getDb } from './index';
import { notifications, postParticipants, posts, subscriptions, users } from './schema';
import { resolveDisplayName } from '../store';
import { getCategory } from '../categories';

export interface PostView {
  id: string;
  category: string;
  authorId: string;
  authorName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  capacity: number | null;
  createdAt: string;
  participants: { id: string; name: string }[];
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

/** 오늘 이후의 포스트 목록 (참가자·작성자 표시 이름 포함) */
export async function listPosts(category: string): Promise<PostView[]> {
  const db = await getDb();
  const postRows = await db
    .select()
    .from(posts)
    .where(and(eq(posts.category, category), gte(posts.date, todayLocal())))
    .orderBy(posts.date, posts.startTime);
  if (postRows.length === 0) return [];

  const userRows = await db.select().from(users);
  const userById = new Map(userRows.map((u) => [u.id, u]));
  const participantRows = await db.select().from(postParticipants);
  const byPost = new Map<string, { id: string; name: string }[]>();
  for (const p of participantRows) {
    if (!byPost.has(p.postId)) byPost.set(p.postId, []);
    byPost.get(p.postId)!.push({ id: p.userId, name: displayNameOf(userById.get(p.userId), '알 수 없음') });
  }

  return postRows.map((p) => ({
    id: p.id,
    category: p.category,
    authorId: p.authorId,
    authorName: displayNameOf(userById.get(p.authorId), '알 수 없음'),
    date: p.date,
    startTime: p.startTime,
    endTime: p.endTime,
    location: p.location,
    description: p.description,
    capacity: p.capacity,
    createdAt: p.createdAt.toISOString(),
    participants: byPost.get(p.id) ?? [],
  }));
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function describeForNotification(category: string, date: string, startTime: string, location: string): string {
  const cat = getCategory(category);
  const [y, m, d] = date.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const [h, min] = startTime.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${cat?.emoji ?? ''} ${cat?.name ?? category} 새 모임 · ${m}/${d}(${wd}) ${ampm} ${h12}:${String(min).padStart(2, '0')} · ${location}`;
}

/**
 * 포스트 생성 + 작성자 자동 참가 + 구독자(작성자 제외) 알림을 하나의 batch(단일 트랜잭션)로 실행.
 * neon-http는 인터랙티브 트랜잭션을 지원하지 않으므로 id를 앱에서 생성해 batch를 쓴다.
 */
export async function createPost(input: {
  category: string;
  authorId: string;
  authorName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description?: string;
  capacity?: number;
}): Promise<string> {
  const db = await getDb();
  const postId = crypto.randomUUID();

  const subscriberRows = await db
    .select({ userId: subscriptions.userId })
    .from(subscriptions)
    .where(and(eq(subscriptions.category, input.category), ne(subscriptions.userId, input.authorId)));

  const message = `${describeForNotification(input.category, input.date, input.startTime, input.location)} — ${input.authorName}`;

  const postValues = {
    id: postId,
    category: input.category,
    authorId: input.authorId,
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

  // TODO(kakao-memo): 알림 insert 직후가 구독자별 "카카오톡 나에게 보내기" 발송을 붙일 자리 (액세스 토큰 보관 필요)
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
  return postId;
}

export async function getPost(postId: string) {
  const db = await getDb();
  return (await db.select().from(posts).where(eq(posts.id, postId)))[0];
}

export async function deletePost(postId: string): Promise<void> {
  const db = await getDb();
  await db.delete(posts).where(eq(posts.id, postId)); // 참가·알림은 CASCADE
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
