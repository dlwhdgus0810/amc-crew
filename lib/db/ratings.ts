import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from './index';
import { postRatings } from './schema';
import { toScore } from '../ratings';

/**
 * 무비나잇 평점 — DB 쪽.
 *
 * 저장은 0~100 정수, 밖으로는 언제나 10점 만점 소수(8.4)로 나간다. 바꾸는 자리는
 * lib/ratings.ts 하나뿐이다 — 흩어 두면 어디선가 10을 한 번 더 곱하거나 빠뜨린다.
 */

/** 모임 카드·상세에 같이 쓰는 한 줄 요약 */
export interface RatingSummary {
  /** 아무도 안 매겼으면 null */
  average: number | null;
  count: number;
  /** 내가 매긴 점수 (안 매겼으면 null) */
  mine: number | null;
}

/**
 * 여러 모임의 평점 요약을 한 번에.
 *
 * 목록 화면이 모임마다 따로 묻지 않도록 정산 요약(settlementSummaries)과 같은 모양으로 둔다.
 */
export async function ratingSummaries(
  postIds: string[],
  viewerId?: string
): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>();
  if (postIds.length === 0) return out;

  const db = await getDb();
  const rows = await db
    .select({ postId: postRatings.postId, userId: postRatings.userId, score: postRatings.score })
    .from(postRatings)
    .where(inArray(postRatings.postId, postIds));

  const sum = new Map<string, { total: number; n: number; mine: number | null }>();
  for (const r of rows) {
    const acc = sum.get(r.postId) ?? { total: 0, n: 0, mine: null };
    acc.total += r.score;
    acc.n += 1;
    if (viewerId && r.userId === viewerId) acc.mine = r.score;
    sum.set(r.postId, acc);
  }

  for (const id of postIds) {
    const acc = sum.get(id);
    if (!acc) {
      out.set(id, { average: null, count: 0, mine: null });
      continue;
    }
    out.set(id, {
      // 평균은 0.1 단위로 끊는다 — 8.333…을 그대로 두면 화면마다 다른 자릿수로 보인다
      average: toScore(Math.round(acc.total / acc.n)),
      count: acc.n,
      mine: acc.mine == null ? null : toScore(acc.mine),
    });
  }
  return out;
}

/** 누가 몇 점 줬는지 — 모임 상세에서만 쓴다 (이름은 참가자 명단에서 찾는다) */
export async function listRatings(postId: string): Promise<{ userId: string; score: number }[]> {
  const db = await getDb();
  const rows = await db
    .select({ userId: postRatings.userId, score: postRatings.score })
    .from(postRatings)
    .where(eq(postRatings.postId, postId))
    .orderBy(sql`${postRatings.score} desc`);
  return rows.map((r) => ({ userId: r.userId, score: toScore(r.score) }));
}

/** 매기기 / 고쳐 매기기 */
export async function saveRating(postId: string, userId: string, stored: number): Promise<void> {
  const db = await getDb();
  await db
    .insert(postRatings)
    .values({ postId, userId, score: stored, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [postRatings.postId, postRatings.userId],
      set: { score: stored, updatedAt: new Date() },
    });
}

/** 매긴 점수 무르기 */
export async function deleteRating(postId: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(postRatings).where(and(eq(postRatings.postId, postId), eq(postRatings.userId, userId)));
}
