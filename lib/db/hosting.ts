import { unstable_cache } from 'next/cache';
import { and, asc, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
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
    WHERE p.visibility = 'public' AND p.deleted_at IS NULL AND ${notAnonymous()} AND ${endedSql()}
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
    .where(and(eq(p.visibility, 'public'), isNull(p.deletedAt), notInArray(p.category, ANONYMOUS_SLUGS), endedSql()))
    .groupBy(postParticipants.userId)
    .orderBy(desc(sql`count(*)`), asc(postParticipants.userId));
  return withProfiles(rows, limit);
}

/**
 * 「기록」 순위의 셈법.
 *
 * 행동마다 값이 다르다. 그냥 더하면 사진이 다 먹는다 — 실제로 재 보니 사진 62·댓글 49에
 * 후기 4·승인된 제안 8이라, 단순 합계는 「사진 많이 올린 사람 순위」가 되고 나머지 셋은
 * 장식이 된다.
 *
 * **모임당 상한이 핵심이다.** 한 모임에 열 장을 몰아 올린 사람이 있었는데, 상한이 없으면
 * 업로드 한 번이 댓글 열 번을 이긴다. 상한을 걸면 몰아 올리는 것보다 **여러 모임에 남기는
 * 것**이 이기고, 이 표가 기리려는 것이 그쪽이다 — 어느 모임에 가든 기록을 남기는 사람.
 *
 * 댓글 상한을 낮게 잡은 이유는 따로 있다. 대화를 점수로 바꾸면 「ㅋㅋ」가 는다.
 */
const CONTRIB = {
  /** 승인된 카테고리 제안 — 앱을 바꾸는 일이고 아주 드물다 */
  proposal: 10,
  photo: 1,
  comment: 1,
  /** 사진·댓글은 **한 모임에서** 이만큼까지만 점수가 된다 */
  photoCap: 5,
  commentCap: 3,
};

/*
 * 후기 수는 **여기에 담지 않는다.**
 *
 * 점수에서 뺐어도 값이 브라우저로 내려가면 개발자 도구를 여는 것만으로 「지유 후기 1」이
 * 읽힌다 — 화면에 안 그리는 것으로는 부족하다. 익명 카테고리의 회원번호를 지우는 것과
 * 같은 이유다 (lib/db/photos.ts).
 */
export interface ContribSeed extends RankSeed {
  photos: number;
  comments: number;
  proposals: number;
}
export interface ContribRank extends HostRank {
  photos: number;
  comments: number;
  proposals: number;
}

/** 담아 둔 재료에 보는 사람의 언어로 이름을 붙인다 — rankNames와 같은 이유로 캐시 밖에서 */
export function contribNames(seeds: ContribSeed[], locale: Locale): ContribRank[] {
  return seeds.map((s) => ({
    ...rankNames([s], locale)[0]!,
    photos: s.photos,
    comments: s.comments,
    proposals: s.proposals,
  }));
}

/**
 * 기록 순위 — 사진·댓글·승인된 카테고리 제안.
 *
 * **후기는 세지 않는다.** 이름 없이 올라가는 글이라(lib/db/reviews.ts) 사람별로 세는
 * 순간 그 숫자가 곧 누가 썼는지가 된다. 후기는 모임당 한 명이 하나뿐이어서 「후기 수 =
 * 후기를 쓴 모임 수」이고, 어느 모임에 후기가 하나 뜬 뒤 누군가의 수가 하나 늘면
 * 그 사람이 쓴 것이다 — 열여섯 명에 후기 넷인 속도에서는 거의 매번 짚힌다.
 *
 * 점수에서만 빼는 것으로는 부족해서 값 자체를 안 담는다 (위 ContribSeed).
 * 후기를 기리고 싶으면 사람에 안 붙는 자리에 세면 된다 — 카테고리 순위의 한 칸 같은 곳.
 *
 * **비공개 모임도 센다.** 호스팅·참여 순위와 다른 점이다. 저쪽은 「몇 명이 모였나」가
 * 곧 점수라 안 보이는 자리에서 점수가 크게 나는 것이 문제지만, 여기서 세는 것은
 * 「기록을 남긴 손」이고 비공개 모임에서 사진을 올린 것도 같은 일이다. 숫자만 오르므로
 * 어디였는지는 안 드러난다. 빼면 사진의 44%와 후기 전부가 사라져(재 보니 62→35, 4→0)
 * 표가 「공개 모임에 사진 올린 사람」이라는 훨씬 좁은 것을 재게 된다.
 *
 * **익명 카테고리는 뺀다.** 거기 활동은 어디에도 이름으로 안 싣기로 한 것이라,
 * 점수 한 점도 예외를 두지 않는다.
 *
 * 끝났는지는 안 본다 — 사진과 댓글은 모임이 끝나야 생기는 것이 아니다.
 */
async function contribQuery(limit: number): Promise<ContribSeed[]> {
  const db = await getDb();
  const rows = resultRows(
    await db.execute(sql`
      WITH ok AS (
        SELECT p.id FROM posts p WHERE p.deleted_at IS NULL AND ${notAnonymous()}
      ), ph AS (
        SELECT user_id, SUM(LEAST(c, ${CONTRIB.photoCap})) AS n FROM (
          SELECT user_id, post_id, count(*) AS c FROM post_photos
          WHERE deleted_at IS NULL AND post_id IN (SELECT id FROM ok) GROUP BY 1, 2
        ) x GROUP BY 1
      ), cm AS (
        SELECT user_id, SUM(LEAST(c, ${CONTRIB.commentCap})) AS n FROM (
          SELECT user_id, post_id, count(*) AS c FROM post_comments
          WHERE deleted_at IS NULL AND post_id IN (SELECT id FROM ok) GROUP BY 1, 2
        ) x GROUP BY 1
      ), rq AS (
        SELECT user_id, count(*) AS n FROM category_requests WHERE status = 'approved' GROUP BY 1
      ), ids AS (
        SELECT user_id FROM ph UNION SELECT user_id FROM cm UNION SELECT user_id FROM rq
      )
      SELECT i.user_id,
        COALESCE(ph.n, 0)::int AS photos,
        COALESCE(cm.n, 0)::int AS comments,
        COALESCE(rq.n, 0)::int AS proposals,
        (COALESCE(ph.n, 0) * ${CONTRIB.photo}
         + COALESCE(cm.n, 0) * ${CONTRIB.comment}
         + COALESCE(rq.n, 0) * ${CONTRIB.proposal})::int AS score
      FROM ids i
      LEFT JOIN ph ON ph.user_id = i.user_id
      LEFT JOIN cm ON cm.user_id = i.user_id
      LEFT JOIN rq ON rq.user_id = i.user_id
      -- 동률일 때 순서가 흔들리면 새로고침마다 자리가 바뀐다 — id로 고정한다
      ORDER BY score DESC, i.user_id ASC
    `)
  );
  const by = new Map(rows.map((r) => [String(r.user_id), r]));
  // 관리자를 빼고 자르는 것은 다른 순위와 같은 함수에 맡긴다 (규칙이 갈리면 안 된다)
  const seeds = await withProfiles(
    rows.map((r) => ({ id: String(r.user_id), n: Number(r.score) })),
    limit
  );
  return seeds.map((s) => {
    const r = by.get(s.id);
    return {
      ...s,
      photos: Number(r?.photos ?? 0),
      comments: Number(r?.comments ?? 0),
      proposals: Number(r?.proposals ?? 0),
    };
  });
}

/** 카테고리 순위 한 줄 — 이름은 화면이 붙인다 (여기는 slug만 안다) */
export interface CategoryRank {
  slug: string;
  /** 끝난 공개 모임 수 */
  meetups: number;
  /** 그 모임들에 이름을 올린 사람 수를 다 더한 것 (연인원) */
  people: number;
}

/**
 * 카테고리 순위 — 어느 종목이 실제로 굴러갔나.
 *
 * 사람 순위와 세는 규칙을 맞춘다: 끝난 것만, 공개 모임만. 비공개 모임(visibility='link')은
 * 링크를 받은 사람만 아는 자리라, 그 수가 순위표에 실리면 「저기서 뭔가 열리고 있다」가
 * 새어 나간다 — 명단이 아니라 숫자만으로도 그렇다.
 *
 * 익명 카테고리는 여기서는 **뺄 이유가 없다.** 사람 순위에서 빼는 것은 이름이 실려서인데
 * 이 표에 실리는 것은 종목과 숫자뿐이고, 그 숫자는 카테고리 화면을 열면 이미 보인다.
 *
 * 순위는 모임 수로 매긴다. 연인원으로 매기면 「열다섯 명이 한 번 모인 것」이
 * 「셋이 열두 번 모인 것」을 이기는데, 이 표가 답해야 하는 것은 「어느 종목이
 * 계속 굴러가나」다. 연인원은 옆에 같이 적어 둔다.
 */
async function categoryQuery(): Promise<CategoryRank[]> {
  const db = await getDb();
  // endedSql()이 posts를 p로 부르므로 여기서도 같은 별칭을 쓴다
  const p = alias(posts, 'p');
  const rows = await db
    .select({
      slug: p.category,
      meetups: sql<number>`count(distinct p.id)::int`,
      people: sql<number>`count(${postParticipants.userId})::int`,
    })
    .from(p)
    .leftJoin(postParticipants, eq(postParticipants.postId, p.id))
    .where(and(eq(p.visibility, 'public'), isNull(p.deletedAt), endedSql()))
    .groupBy(p.category)
    .orderBy(
      desc(sql`count(distinct p.id)`),
      desc(sql`count(${postParticipants.userId})`),
      // 동률이면 slug로 고정한다 — 새로고침마다 순서가 바뀌면 순위표로 안 읽힌다
      asc(p.category)
    );
  return rows.map((r) => ({ slug: r.slug, meetups: r.meetups, people: r.people }));
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
export const categoryRanking = unstable_cache(categoryQuery, ['category-ranking'], {
  tags: [POSTS_TAG],
  revalidate: 300,
});
/*
 * 기록 순위는 POSTS_TAG로 지워지지 않는 것들(사진·댓글·후기·제안)을 센다.
 * 그래서 5분마다 스스로 다시 읽는 것이 사실상 유일한 갱신이다 — 사진을 올리자마자
 * 점수가 오르지는 않는다. 순위표에 그 정도 지연은 괜찮다.
 */
export const contribRanking = unstable_cache(contribQuery, ['contrib-ranking'], {
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
