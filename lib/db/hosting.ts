import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from './index';
import { postParticipants, posts, users } from './schema';
import { resolveDisplayName } from '../store';
import { adminIds } from '../auth';

/**
 * 모임 주최 점수.
 *
 * 몇 번 열었는지가 아니라 **몇 명을 모았는지**로 센다. 두 명 모인 모임 열 번보다
 * 열 명 모인 모임 두 번이 더 큰 일이라서다.
 *
 * 같이 연 사람이 있으면 그 모임의 인원을 호스트 수로 나눠 갖는다 —
 * 10명 모임을 둘이 열었으면 각각 5점. 호스트는 최대 둘이라 소수점은 .5까지만 나온다.
 *
 * 공개 모임만 센다 — 비공개(link) 모임을 랭킹에 올리면 "무언가 열었다"는 사실이 샌다.
 * 날짜 제한은 두지 않는다: 등급은 쌓아 온 기록에 대한 훈장이지, 이번 주 성적표가 아니다.
 *
 * 관리자는 어느 집계에도 넣지 않는다. 운영하느라 시험 삼아 여는 모임이 섞여 있어서
 * 숫자가 실제 참여를 나타내지 않고, 관리자가 1등인 순위표는 순위표가 아니다.
 */

/** drizzle의 execute 반환 형태가 드라이버마다 다르다 (neon-http는 { rows }, 배열인 경우도 있다) */
function resultRows(res: unknown): Record<string, unknown>[] {
  return (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
}

/**
 * 사람마다의 주최 점수를 구하는 한 문장.
 *
 * 모임 하나가 호스트 수만큼의 줄로 펼쳐지고(UNION ALL), 각 줄이 인원 ÷ 호스트 수를 갖는다.
 * 행마다 나누므로 모임 크기가 제각각이어도 합이 맞는다.
 */
const POINTS = sql`
  WITH hosted AS (
    SELECT
      p.author_id,
      p.co_host_id,
      (SELECT count(*) FROM post_participants pp WHERE pp.post_id = p.id)::numeric AS people,
      CASE WHEN p.co_host_id IS NULL THEN 1 ELSE 2 END AS hosts
    FROM posts p
    WHERE p.visibility = 'public'
  ), shares AS (
    SELECT author_id AS user_id, people / hosts AS pts FROM hosted
    UNION ALL
    SELECT co_host_id AS user_id, people / hosts AS pts FROM hosted WHERE co_host_id IS NOT NULL
  )
  SELECT user_id, SUM(pts)::float8 AS points
  FROM shares
  GROUP BY user_id
`;

/** 주어진 사람들의 주최 점수 (한 번도 안 열었으면 빠진다 — 호출부에서 ?? 0) */
export async function hostCountsFor(userIds: string[]): Promise<Map<string, number>> {
  const admins = new Set(adminIds());
  const targets = userIds.filter((id) => !admins.has(id));
  if (targets.length === 0) return new Map();
  const db = await getDb();
  const list = sql.join(
    targets.map((id) => sql`${id}`),
    sql`, `
  );
  const rows = resultRows(await db.execute(sql`SELECT user_id, points FROM (${POINTS}) s WHERE user_id IN (${list})`));
  return new Map(rows.map((r) => [String(r.user_id), Number(r.points)]));
}

export interface HostRank {
  id: string;
  name: string;
  avatar: string | null;
  /** 주최 순위는 점수(참가 인원을 호스트끼리 나눈 값의 합, .5 단위), 참가 순위는 횟수 */
  count: number;
}

/** 종합 주최 랭킹 — 카테고리를 가리지 않고 연 공개 모임 전부를 센다 */
export async function hostRanking(limit = 50): Promise<HostRank[]> {
  const db = await getDb();
  const rows = resultRows(
    await db.execute(sql`
      SELECT user_id, points FROM (${POINTS}) s
      WHERE points > 0
      -- 동률일 때 순서가 흔들리면 새로고침마다 금·은메달이 서로 바뀐다 — id로 고정한다
      ORDER BY points DESC, user_id ASC
    `)
  );
  // 자르는 건 withProfiles가 한다 — 관리자를 뺀 뒤에 잘라야 자리가 비지 않는다
  return withProfiles(
    rows.map((r) => ({ id: String(r.user_id), n: Number(r.points) })),
    limit
  );
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
    .select({ id: users.id, kakaoName: users.kakaoName, avatar: users.avatar })
    .from(users)
    .where(inArray(users.id, kept.map((r) => r.id)));
  const byId = new Map(profiles.map((p) => [p.id, p]));

  return kept.map((r) => {
    const p = byId.get(r.id);
    return {
      id: r.id,
      name: p ? resolveDisplayName({ kakaoName: p.kakaoName, kakaoNameHistory: [] }, '알 수 없음') : '알 수 없음',
      avatar: p?.avatar ?? null,
      count: Number(r.n),
    };
  });
}
