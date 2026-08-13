import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { getDb } from './index';
import { postReviews, posts, users } from './schema';
import { nameOf, UNKNOWN_NAME } from '../store';
import { isAnonymous } from '../categories';
import { Locale, Msg, pick } from '../i18n';

/**
 * 모임 한줄 후기 — DB 쪽.
 *
 * 다녀온 사람이 남기는 글이다. 점수는 없다 (schema.ts의 post_reviews 주석 참고).
 * 한 사람이 한 모임에 한 줄이라 저장은 언제나 upsert다.
 *
 * 이 파일은 **누가 쓸 수 있는지를 보지 않는다.** 「끝난 모임의 참가자만」은 라우트가
 * 정한다 (app/api/posts/[id]/review/route.ts) — 평점과 같은 나눔이다.
 */

/** 「익명」 — 참가자 명단·댓글에서 쓰는 말과 같아야 한다 (lib/db/posts.ts) */
const ANON: Msg = { ko: '익명', en: 'Anonymous', es: 'Anónimo' };

export interface ReviewView {
  /** 익명 모임에서 남의 것이면 빈 문자열 — 회원번호는 이름만큼이나 사람을 가리킨다 */
  userId: string;
  name: string;
  avatar: string | null;
  body: string;
  updatedAt: string;
  /** 보고 있는 사람이 쓴 글인지 — 고치기·지우기를 여기서 가른다 */
  mine: boolean;
}

/** 모아보기 한 줄 — 어느 모임의 후기인지까지 들고 간다 */
export interface RecentReview extends ReviewView {
  postId: string;
  category: string;
  title: string | null;
  date: string | null;
  startTime: string | null;
}

const NAME_COLS = {
  id: users.id,
  kakaoName: users.kakaoName,
  nickname: users.nickname,
  nameEn: users.nameEn,
  avatar: users.avatar,
};

/**
 * 후기 남기기 — 이미 쓴 게 있으면 덮어쓴다.
 *
 * 지웠던 자리에 다시 쓰는 경우도 여기로 온다. 그래서 deletedAt을 null로 되돌린다 —
 * 안 그러면 저장은 되는데 아무 데서도 안 보이는 글이 된다.
 */
export async function saveReview(postId: string, userId: string, body: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(postReviews)
    .values({ postId, userId, body })
    .onConflictDoUpdate({
      target: [postReviews.postId, postReviews.userId],
      set: { body, updatedAt: new Date(), deletedAt: null },
    });
}

/** 후기 지우기 — 표시만 한다 (이 저장소의 규칙, schema.ts 참고) */
export async function deleteReview(postId: string, userId: string): Promise<void> {
  const db = await getDb();
  await db
    .update(postReviews)
    .set({ deletedAt: new Date() })
    .where(and(eq(postReviews.postId, postId), eq(postReviews.userId, userId)));
}

/**
 * 그 모임의 후기 전부 — 모임 상세에서 쓴다.
 *
 * 익명 카테고리에서는 이름을 「익명」으로 바꾸고 **회원번호와 얼굴도 같이 가린다.**
 * 이름만 가리면 개발자 도구로 번호를 읽어 다른 화면의 명단과 맞춰볼 수 있다
 * (lib/db/posts.ts의 참가자 명단이 같은 이유로 그렇게 한다).
 * 보고 있는 본인 것은 가리지 않는다 — 고치기·지우기가 그걸로 판단한다.
 */
export async function listReviews(postId: string, viewerId: string | undefined, locale: Locale): Promise<ReviewView[]> {
  const db = await getDb();
  const rows = await db
    .select({
      userId: postReviews.userId,
      body: postReviews.body,
      updatedAt: postReviews.updatedAt,
      category: posts.category,
      allowNicknames: posts.allowNicknames,
      user: NAME_COLS,
    })
    .from(postReviews)
    .innerJoin(posts, eq(posts.id, postReviews.postId))
    .innerJoin(users, eq(users.id, postReviews.userId))
    .where(and(eq(postReviews.postId, postId), isNull(postReviews.deletedAt), isNull(posts.deletedAt)))
    .orderBy(desc(postReviews.updatedAt));

  return rows.map((r) => mask(r, viewerId, locale));
}

/** 모임별 후기 개수 — 목록·카드가 한 번에 묻도록 (평점 요약과 같은 모양) */
export async function reviewCounts(postIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (postIds.length === 0) return out;
  const db = await getDb();
  const rows = await db
    .select({ postId: postReviews.postId, n: sql<number>`count(*)::int` })
    .from(postReviews)
    .where(and(inArray(postReviews.postId, postIds), isNull(postReviews.deletedAt)))
    .groupBy(postReviews.postId);
  for (const r of rows) out.set(r.postId, r.n);
  return out;
}

/**
 * 모아보기(/reviews)에 실을 최근 후기.
 *
 * **공개 모임만.** 비공개(link) 모임은 어느 경우에도 안 올린다 — 후기 한 줄이
 * 「누가 무언가를 열었다」를 말해 버린다. 친구 모임 목록·순위표와 같은 규칙이다
 * (lib/db/friend-meetups.ts, lib/db/hosting.ts).
 *
 * 익명 카테고리는 빼지 않고 **이름을 가려서** 넣는다. 별보러가자에 다녀온 이야기도
 * 남을 자리가 있어야 한다는 판단이고, 누가 썼는지는 위 mask가 지운다.
 *
 * 이름은 보는 사람의 언어로 짓는다 — 그래서 이 함수는 캐시에 담지 않는다.
 */
export async function recentReviews(
  limit: number,
  viewerId: string | undefined,
  locale: Locale
): Promise<RecentReview[]> {
  const db = await getDb();
  const rows = await db
    .select({
      userId: postReviews.userId,
      body: postReviews.body,
      updatedAt: postReviews.updatedAt,
      postId: posts.id,
      category: posts.category,
      title: posts.title,
      date: posts.date,
      startTime: posts.startTime,
      allowNicknames: posts.allowNicknames,
      user: NAME_COLS,
    })
    .from(postReviews)
    .innerJoin(posts, eq(posts.id, postReviews.postId))
    .innerJoin(users, eq(users.id, postReviews.userId))
    .where(
      and(
        isNull(postReviews.deletedAt),
        isNull(posts.deletedAt),
        eq(posts.visibility, 'public')
      )
    )
    .orderBy(desc(postReviews.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    ...mask(r, viewerId, locale),
    postId: r.postId,
    category: r.category,
    title: r.title,
    date: r.date,
    startTime: r.startTime,
  }));
}

/** 한 줄을 화면에 내보낼 모양으로 — 익명 가리기가 여기 한 곳에만 있다 */
function mask(
  r: {
    userId: string;
    body: string;
    updatedAt: Date;
    category: string;
    allowNicknames: boolean;
    user: { id: string; kakaoName: string; nickname: string | null; nameEn: string | null; avatar: string | null };
  },
  viewerId: string | undefined,
  locale: Locale
): ReviewView {
  const mine = Boolean(viewerId && r.userId === viewerId);
  const hidden = isAnonymous(r.category) && !mine;
  return {
    userId: hidden ? '' : r.userId,
    name: hidden ? pick(locale, ANON) : nameOf(r.user, UNKNOWN_NAME, locale, !r.allowNicknames),
    avatar: hidden ? null : r.user.avatar,
    body: r.body,
    updatedAt: r.updatedAt.toISOString(),
    mine,
  };
}
