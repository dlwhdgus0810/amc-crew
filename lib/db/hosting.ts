import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from './index';
import { posts, users } from './schema';
import { resolveDisplayName } from '../store';

/**
 * 모임 주최 집계.
 *
 * 공개 모임만 센다 — 비공개(link) 모임을 랭킹에 올리면 "무언가 열었다"는 사실이 샌다.
 * 날짜 제한은 두지 않는다: 등급은 쌓아 온 기록에 대한 훈장이지, 이번 주 성적표가 아니다.
 */

/** 주어진 사람들의 공개 모임 주최 횟수 (없으면 0 없이 빠진다 — 호출부에서 ?? 0) */
export async function hostCountsFor(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const db = await getDb();
  const rows = await db
    .select({ authorId: posts.authorId, n: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(inArray(posts.authorId, userIds), eq(posts.visibility, 'public')))
    .groupBy(posts.authorId);
  return new Map(rows.map((r) => [r.authorId, Number(r.n)]));
}

export interface HostRank {
  id: string;
  name: string;
  avatar: string | null;
  count: number;
}

/** 종합 주최 랭킹 — 카테고리를 가리지 않고 연 공개 모임 전부를 센다 */
export async function hostRanking(limit = 50): Promise<HostRank[]> {
  const db = await getDb();
  const rows = await db
    .select({ authorId: posts.authorId, n: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.visibility, 'public'))
    .groupBy(posts.authorId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  if (rows.length === 0) return [];

  const profiles = await db
    .select({ id: users.id, kakaoName: users.kakaoName, nickname: users.nickname, avatar: users.avatar })
    .from(users)
    .where(inArray(users.id, rows.map((r) => r.authorId)));
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return rows.map((r) => {
    const p = byId.get(r.authorId);
    return {
      id: r.authorId,
      name: p
        ? resolveDisplayName(
            { kakaoName: p.kakaoName, ...(p.nickname ? { nickname: p.nickname } : {}), kakaoNameHistory: [] },
            '알 수 없음'
          )
        : '알 수 없음',
      avatar: p?.avatar ?? null,
      count: Number(r.n),
    };
  });
}
