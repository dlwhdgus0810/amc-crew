import { unstable_cache } from 'next/cache';
import { and, asc, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from './index';
import { postParticipants, posts, users } from './schema';
import { NameRow, nameOf, UNKNOWN_NAME } from '../store';
import { ANONYMOUS_SLUGS } from '../categories';
import { Locale } from '../i18n';
import { adminIds } from '../auth';
import { openEndCutoffTime, pastCutoff } from '../dates';
import { POSTS_TAG } from '../cache-tags';

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
 * 그리고 **이미 끝난 모임만** 센다. 예정된 모임을 미리 세면 아직 일어나지 않은 일로 점수가
 * 오르고, 취소하거나 아무도 안 오면 다시 내려간다. 등급은 쌓아 온 기록에 대한 훈장이라
 * 오르내리면 안 된다. 오래된 것을 덜어내지는 않는다 — 이번 주 성적표가 아니다.
 *
 * 관리자는 어느 집계에도 넣지 않는다. 운영하느라 시험 삼아 여는 모임이 섞여 있어서
 * 숫자가 실제 참여를 나타내지 않고, 관리자가 1등인 순위표는 순위표가 아니다.
 */

/**
 * 이름이 안 보이는 카테고리(별보러가자)는 어느 집계에도 넣지 않는다.
 *
 * 순위표는 사람 이름 옆에 숫자를 놓는 표다. 「전부 익명」이라고 해 놓고 다녀온 만큼
 * 점수가 오르면 앞뒤가 안 맞는다 — 그 주에 누구 숫자가 올랐는지 견주면 좁혀지기도 한다.
 * 아바타에 붙는 주최 뱃지(hostCountsFor)도 같은 이유로 이 집계를 쓴다.
 */
function notAnonymous() {
  return ANONYMOUS_SLUGS.length === 0
    ? sql`TRUE`
    : sql`p.category NOT IN (${sql.join(ANONYMOUS_SLUGS.map((c) => sql`${c}`), sql`, `)})`;
}

/** drizzle의 execute 반환 형태가 드라이버마다 다르다 (neon-http는 { rows }, 배열인 경우도 있다) */
function resultRows(res: unknown): Record<string, unknown>[] {
  return (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
}

/**
 * 「이미 끝난 모임」을 고르는 조건 — 목록 화면(listPosts)과 같은 기준이다.
 *
 * 날짜가 지났거나, 같은 날인데 종료 시각이 기준을 넘겼을 때. 종료 시각을 안 적은 모임은
 * 시작 시각을 당겨 둔 기준(openCut)과 견준다. openCut이 null이면 오늘은 아직 아무것도
 * 안 넘어갔다는 뜻이라 그 갈래를 아예 뺀다.
 *
 * 시각이 걸려 있어서 함수다 — 모듈을 읽을 때 한 번 굳으면 자정을 넘겨도 어제 기준을 쓴다.
 */
function endedSql() {
  const { date: cutDate, time: cutTime } = pastCutoff();
  const openCut = openEndCutoffTime();
  const endedToday = openCut
    ? sql`(p.end_time <= ${cutTime} OR (p.end_time IS NULL AND p.start_time <= ${openCut}))`
    : sql`p.end_time <= ${cutTime}`;
  return sql`(p.date < ${cutDate} OR (p.date = ${cutDate} AND ${endedToday}))`;
}

/**
 * 사람마다의 주최 점수를 구하는 한 문장.
 *
 * 모임 하나가 호스트 수만큼의 줄로 펼쳐지고(UNION ALL), 각 줄이 인원 ÷ 호스트 수를 갖는다.
 * 행마다 나누므로 모임 크기가 제각각이어도 합이 맞는다.
 */
function points() {
  return sql`
  WITH hosted AS (
    SELECT
      p.author_id,
      p.co_host_id,
      (SELECT count(*) FROM post_participants pp WHERE pp.post_id = p.id)::numeric AS people,
      CASE WHEN p.co_host_id IS NULL THEN 1 ELSE 2 END AS hosts
    FROM posts p
    WHERE p.visibility = 'public' AND ${notAnonymous()} AND ${endedSql()}
  ), shares AS (
    SELECT author_id AS user_id, people / hosts AS pts FROM hosted
    UNION ALL
    SELECT co_host_id AS user_id, people / hosts AS pts FROM hosted WHERE co_host_id IS NOT NULL
  )
  SELECT user_id, SUM(pts)::float8 AS points
  FROM shares
  GROUP BY user_id
`;
}

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
  const rows = resultRows(await db.execute(sql`SELECT user_id, points FROM (${points()}) s WHERE user_id IN (${list})`));
  return new Map(rows.map((r) => [String(r.user_id), Number(r.points)]));
}

export interface HostRank {
  id: string;
  name: string;
  avatar: string | null;
  /** 주최 순위는 점수(참가 인원을 호스트끼리 나눈 값의 합, .5 단위), 참가 순위는 횟수 */
  count: number;
}

/**
 * 담아 두는 모양 — 이름 대신 **이름의 재료**를 들고 있다.
 *
 * 이 두 표는 요청 사이에도 남는데(unstable_cache), 이름은 보는 사람의 언어에 따라
 * 달라진다. 담기 전에 이름을 정해 버리면 이 표를 처음 연 사람의 언어가 5분 동안
 * 모두에게 남는다 — 영어로 보는 사람이 한글 이름을, 한국어로 보는 사람이 영어 이름을 본다.
 * 그래서 이름은 캐시 밖에서, 화면을 그리는 자리에서 고른다 (rankNames).
 */
export interface RankSeed extends NameRow {
  id: string;
  avatar: string | null;
  count: number;
}

/** 담아 둔 재료에 보는 사람의 언어로 이름을 붙인다 — 캐시 밖에서 부른다 */
export function rankNames(seeds: RankSeed[], locale: Locale): HostRank[] {
  return seeds.map((s) => ({ id: s.id, name: nameOf(s, UNKNOWN_NAME, locale), avatar: s.avatar, count: s.count }));
}

/** 종합 주최 랭킹 — 카테고리를 가리지 않고 연 공개 모임 전부를 센다 */
async function hostQuery(limit: number): Promise<RankSeed[]> {
  const db = await getDb();
  const rows = resultRows(
    await db.execute(sql`
      SELECT user_id, points FROM (${points()}) s
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
 *
 * 주최 점수와 같이 끝난 모임만 센다 — 참가 버튼을 눌러 두기만 해도 점수가 오르면
 * 가지 않은 모임으로 순위가 오른다.
 */
async function joinQuery(limit: number): Promise<RankSeed[]> {
  const db = await getDb();
  // endedSql()이 posts를 p로 부르므로 여기서도 같은 별칭으로 조인한다
  const p = alias(posts, 'p');
  const rows = await db
    .select({ id: postParticipants.userId, n: sql<number>`count(*)::int` })
    .from(postParticipants)
    .innerJoin(p, eq(p.id, postParticipants.postId))
    .where(and(eq(p.visibility, 'public'), notInArray(p.category, ANONYMOUS_SLUGS), endedSql()))
    .groupBy(postParticipants.userId)
    .orderBy(desc(sql`count(*)`), asc(postParticipants.userId));
  return withProfiles(rows, limit);
}

/*
 * 두 순위표는 요청 사이에도 남겨 둔다.
 *
 * 회원 전체의 모임을 통째로 세는 것이라 보는 사람이 누구든 같은 답이고, 그만큼 무겁다.
 * 모임·참가자가 바뀌면 태그로 지우고(revalidateTag), 그 사이에도 5분마다 스스로 다시
 * 읽는다 — 점수는 모임이 끝나야 오르는데, 끝나는 것은 아무도 누르지 않아도 일어난다.
 */
export const hostRanking = unstable_cache(hostQuery, ['host-ranking'], {
  tags: [POSTS_TAG],
  revalidate: 300,
});
export const joinRanking = unstable_cache(joinQuery, ['join-ranking'], {
  tags: [POSTS_TAG],
  revalidate: 300,
});

/** 집계 결과에 이름 재료·사진을 붙이고 관리자를 뺀다 (두 랭킹이 같은 규칙을 쓰게) */
async function withProfiles(rows: { id: string; n: number }[], limit: number): Promise<RankSeed[]> {
  const admins = new Set(adminIds());
  const kept = rows.filter((r) => !admins.has(r.id)).slice(0, limit);
  if (kept.length === 0) return [];

  const db = await getDb();
  const profiles = await db
    .select({ id: users.id, kakaoName: users.kakaoName, nickname: users.nickname, nameEn: users.nameEn, avatar: users.avatar })
    .from(users)
    .where(inArray(users.id, kept.map((r) => r.id)));
  const byId = new Map(profiles.map((p) => [p.id, p]));

  /*
   * 순위표는 닉네임을 정해 둔 사람은 닉네임으로 부른다.
   *
   * 모임 안에서는 그 모임의 규칙(allowNicknames)을 따르지만, 이 표는 여러 모임을
   * 합친 결과라 따를 규칙이 없다. 그래서 본인이 프로필에 적어 둔 이름을 쓴다 —
   * 닉네임을 안 정한 사람은 그대로 실명이다. 어느 이름으로 부를지는 rankNames가 정한다.
   */
  return kept.map((r) => {
    const p = byId.get(r.id);
    return {
      id: r.id,
      kakaoName: p?.kakaoName ?? '',
      nickname: p?.nickname ?? null,
      nameEn: p?.nameEn ?? null,
      avatar: p?.avatar ?? null,
      count: Number(r.n),
    };
  });
}
