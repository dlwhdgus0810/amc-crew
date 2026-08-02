import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from './index';
import { posts, users } from './schema';
import { resolveDisplayName } from '../store';
import { adminIds } from '../auth';
import { postParticipants } from './schema';

/**
 * 모임 주최 집계.
 *
 * 공개 모임만 센다 — 비공개(link) 모임을 랭킹에 올리면 "무언가 열었다"는 사실이 샌다.
 * 날짜 제한은 두지 않는다: 등급은 쌓아 온 기록에 대한 훈장이지, 이번 주 성적표가 아니다.
 *
 * 관리자는 어느 집계에도 넣지 않는다. 운영하느라 시험 삼아 여는 모임이 섞여 있어서
 * 숫자가 실제 참여를 나타내지 않고, 관리자가 1등인 순위표는 순위표가 아니다.
 */

/** 주어진 사람들의 공개 모임 주최 횟수 (없으면 0 없이 빠진다 — 호출부에서 ?? 0) */
export async function hostCountsFor(userIds: string[]): Promise<Map<string, number>> {
  const admins = new Set(adminIds());
  const targets = userIds.filter((id) => !admins.has(id));
  if (targets.length === 0) return new Map();
  const db = await getDb();
  const rows = await db
    .select({ authorId: posts.authorId, n: sql<number>`count(*)::int` })
    .from(posts)
    .where(and(inArray(posts.authorId, targets), eq(posts.visibility, 'public')))
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
    .select({ id: posts.authorId, n: sql<number>`count(*)::int` })
    .from(posts)
    .where(eq(posts.visibility, 'public'))
    .groupBy(posts.authorId)
    // 동률일 때 순서가 흔들리면 새로고침마다 금·은메달이 서로 바뀐다 — id로 고정한다
    .orderBy(desc(sql`count(*)`), asc(posts.authorId));
  return withProfiles(rows, limit);
}

/**
 * 종합 참가 랭킹 — 공개 모임에 이름을 올린 횟수.
 *
 * 자기가 연 모임도 센다. 만든 사람은 참가자로 들어가고, 여는 것도 나가는 일이라
 * 빼면 "많이 여는 사람"이 참가 순위에서 사라지는 이상한 표가 된다.
 */
export async function joinRanking(limit = 50): Promise<HostRank[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: postParticipants.userId, n: sql<number>`count(*)::int` })
    .from(postParticipants)
    .innerJoin(posts, eq(posts.id, postParticipants.postId))
    .where(eq(posts.visibility, 'public'))
    .groupBy(postParticipants.userId)
    .orderBy(desc(sql`count(*)`), asc(postParticipants.userId));
  return withProfiles(rows, limit);
}

/** 집계 결과에 이름·사진을 붙이고 관리자를 뺀다 (두 랭킹이 같은 규칙을 쓰게) */
async function withProfiles(rows: { id: string; n: number }[], limit: number): Promise<HostRank[]> {
  const admins = new Set(adminIds());
  const kept = rows.filter((r) => !admins.has(r.id)).slice(0, limit);
  if (kept.length === 0) return [];

  const db = await getDb();
  const profiles = await db
    .select({ id: users.id, kakaoName: users.kakaoName, nickname: users.nickname, avatar: users.avatar })
    .from(users)
    .where(inArray(users.id, kept.map((r) => r.id)));
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return kept.map((r) => {
    const p = byId.get(r.id);
    return {
      id: r.id,
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
