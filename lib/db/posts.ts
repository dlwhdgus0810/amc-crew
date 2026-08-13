import { revalidateTag } from 'next/cache';
import { cache } from 'react';
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, like, lt, lte, ne, or, sql } from 'drizzle-orm';
import { getDb } from './index';
import { commentLikes, favorites, notifications, postComments, postParticipants, posts, recurringRules, subscriptions, users } from './schema';
import { LocalName, NameRow, nameOf, UNKNOWN_NAME } from '../store';
import { getLocale } from '../locale';
import { catName, getCategory, isAnonymous } from '../categories';
import type { TitleMeta } from '../tmdb';
import { sendPush } from '../push';
import { isPastSlot, openEndCutoffTime, pastCutoff, todayLocal } from '../dates';
import { adminIds } from '../auth';
import { POSTS_TAG } from '../cache-tags';
import { hostCountsFor } from './hosting';
import { settlementSummaries, type SettlementSummary } from './settlements';
import { ratingSummaries, type RatingSummary } from './ratings';
import { photoStrips, type PhotoStrip } from './photos';
import { signedUrls } from '../blob';
import { ratable } from '../ratings';
import { DEFAULT_LOCALE, Locale, Msg, pick, toLocale } from '../i18n';
import { NOTIF } from '../notif-kinds';
import { dateLabelShort, timeLabel, whenLabelShort } from '../datefmt';

export interface PostView {
  id: string;
  category: string;
  authorId: string;
  /** 비로그인에게는 null — 누가 열었는지는 회원끼리만 본다 */
  authorName: string | null;
  title: string | null;
  titleMeta: TitleMeta | null;
  recurringRuleId: string | null; // 정기 모임 회차면 규칙 id
  /**
   * 그 규칙이 아직 살아 있는지 — 「매주 수」 딱지와 「반복 중단」 버튼은 이걸 본다.
   *
   * recurringRuleId로 판단하면 안 된다. 반복을 중단해도 이미 열린 회차의 id는 그대로
   * 남기 때문에(규칙만 끄고 회차는 살려 둔다), 끊고 나서도 딱지와 중단 버튼이 계속 보인다.
   * id는 id대로 필요하다 — 정기 회차의 주최자는 그 주만 빠질 수 있어서, 참가 버튼이
   * 「내가 연 모임인가」가 아니라 「정기 회차인가」로 갈린다.
   */
  repeatsOn: boolean;
  /** 같이 연 사람 — 없으면 null. 이름은 화면에 그대로 쓴다 */
  coHost: { id: string; name: string } | null;
  /** 이 모임에서 닉네임으로 보여도 되는지 (수정 화면이 그대로 되살리려면 필요하다) */
  allowNicknames: boolean;
  /**
   * null이면 「날짜 미정」 — 사람부터 모으는 모임이다 (독서나눔처럼 번개가 안 되는 종목).
   * 화면은 날짜 자리에 「날짜 미정」을 그리고, 캘린더·순위·오늘 알림에서는 아예 빠진다.
   */
  date: string | null;
  /** 날짜가 미정이면 이것도 null — 둘은 늘 같이 있거나 같이 없다 */
  startTime: string | null;
  /** 안 적었으면 null — 화면에서 시작 시각만 보여준다 */
  endTime: string | null;
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
  /** 무비나잇이고 끝난 모임일 때만 — 우리 평점 요약 (그 밖에는 null) */
  rating: RatingSummary | null;
  /**
   * 이 모임의 사진 — **참가자와 관리자에게만**. 그 밖에는 null (비로그인 포함).
   * urls는 카드에서 넘겨 볼 몇 장이고(앞에서 자른다), count는 실제 전체 장수다.
   * 서명된 주소라 유효기간이 있다 — 담아 두지 말 것.
   */
  photos: PhotoStrip | null;
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

/**
 * 이 모임에서 보여줄 이름.
 *
 * 기본은 실명이다. 모임을 만들 때 닉네임을 허용해 둔 경우에만 각자의 닉네임으로 보인다 —
 * 닉네임을 안 정한 사람은 그대로 실명이다.
 * 같은 사람이 모임마다 다른 이름으로 보일 수 있다는 뜻이고, 그게 이 설정의 목적이다.
 */
function displayNameOf(
  row: NameRow | undefined,
  fallback: string,
  locale: Locale,
  allowNicknames = false
): string {
  return nameOf(row, fallback, locale, !allowNicknames);
}

/**
 * 포스트 목록 (참가자·작성자 표시 이름, 댓글 포함).
 * 기준은 날짜가 아니라 (종료 시각 + 유예)이므로, 오늘 낮에 끝난 모임도 그날 바로 지난 모임이 된다.
 * past=false: 아직 안 끝난 모임, 가까운 순. past=true: 끝난 모임, 최근 순 최대 30개.
 */
export const listPosts = cache(
  async (category: string, past = false, viewerId?: string, showPastPrivate = false): Promise<PostView[]> => {
  const db = await getDb();
  const { date: cutDate, time: cutTime } = pastCutoff();
  /*
   * 비공개(link) 모임은 목록에서 뺀다. 단, 만든 사람과 이미 참가한 사람은 계속 봐야 한다 —
   * 그러지 않으면 링크를 잃어버린 순간 자기 모임을 찾을 길이 없다.
   */
  /*
   * 지난 모임을 볼 때는 비공개를 뺀다 — 끝난 뒤에는 대개 남길 이유가 없는 기록이라
   * 기본이 「안 보임」이다. 프로필에서 켠 사람에게만 예전처럼 보인다.
   */
  const hidePastPrivate = past && !showPastPrivate;
  const visible =
    viewerId && !hidePastPrivate
      ? or(
          eq(posts.visibility, 'public'),
          eq(posts.authorId, viewerId),
          inArray(
            posts.id,
            db.select({ id: postParticipants.postId }).from(postParticipants).where(eq(postParticipants.userId, viewerId))
          )
        )
      : eq(posts.visibility, 'public');
  /*
   * 끝난 모임: 날짜가 지났거나, 같은 날인데 종료 시각이 기준 시각을 넘겼을 때.
   * 종료 시각을 안 적은 모임은 시작 시각을 당겨 둔 기준(openCut)과 견준다 —
   * openCut이 null이면 오늘은 아직 아무것도 안 넘어갔다는 뜻이다.
   */
  const openCut = openEndCutoffTime();
  const endedToday = openCut
    ? or(lte(posts.endTime, cutTime), and(isNull(posts.endTime), lte(posts.startTime, openCut)))
    : lte(posts.endTime, cutTime);
  const upcomingToday = openCut
    ? or(gt(posts.endTime, cutTime), and(isNull(posts.endTime), gt(posts.startTime, openCut)))
    : or(gt(posts.endTime, cutTime), isNull(posts.endTime));
  const ended = or(lt(posts.date, cutDate), and(eq(posts.date, cutDate), endedToday));
  /*
   * 날짜 미정(date IS NULL)은 「아직 안 끝난 모임」에 들어간다.
   *
   * 여기만 따로 적어 주면 된다 — 날짜를 견주는 다른 곳(캘린더, 다음 모임 요약, 순위,
   * 오늘 알림)은 null과의 비교가 참이 되지 않아 저절로 빠진다. 그게 우리가 원하는 것이다:
   * 날짜가 없는 모임은 달력에 찍을 수도, 끝났다고 셀 수도 없다.
   *
   * 정렬은 미정을 맨 위로. 「언제인지 아직 모르니 사람부터 모읍니다」가 이 목록에서
   * 제일 먼저 눈에 띄어야 하는 말이고, 뒤에 두면 예정된 모임들에 묻힌다.
   * (Postgres는 오름차순에서 NULL을 뒤로 보내므로 NULLS FIRST를 적어 준다)
   */
  const upcoming = or(
    isNull(posts.date),
    gt(posts.date, cutDate),
    and(eq(posts.date, cutDate), upcomingToday)
  );
  const postRows = past
    ? await db
        .select()
        .from(posts)
        .where(and(eq(posts.category, category), ended, visible, isNull(posts.deletedAt)))
        .orderBy(desc(posts.date), desc(posts.startTime))
        .limit(30)
    : await db
        .select()
        .from(posts)
        .where(and(eq(posts.category, category), upcoming, visible, isNull(posts.deletedAt)))
        .orderBy(sql`${posts.date} ASC NULLS FIRST`, sql`${posts.startTime} ASC NULLS FIRST`);
    return buildViews(postRows, viewerId);
  }
);

/**
 * 공유 링크(/p/[id])용 단건 뷰 조회.
 *
 * generateMetadata와 페이지가 같은 요청 안에서 각각 부른다 — cache가 그걸 하나로 묶는다.
 * 다만 **인자가 같아야** 묶인다. 한쪽이 viewerId를 빼고 부르면 두 번 읽는다.
 */
export const getPostView = cache(async (postId: string, viewerId?: string): Promise<PostView | null> => {
  // 외부에서 들어오는 id이므로 uuid 형태가 아니면 캐스팅 에러 대신 404 처리
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId)) return null;
  const db = await getDb();
  // 지운 모임은 링크를 알고 있어도 404다 (되살리기 전까지)
  const row = (await db.select().from(posts).where(and(eq(posts.id, postId), isNull(posts.deletedAt))))[0];
  if (!row) return null;
  return (await buildViews([row], viewerId))[0];
});

/*
 * 뷰를 만들 때 사람에 대해 필요한 칸.
 *
 * 예전에는 users를 통째로(select *) 읽었는데, avatar가 256px data URL이라
 * 회원 한 명이 수십 KB다. 한 사람 이름을 붙이려고 안 나온 사람의 사진까지
 * 전부 끌고 오던 셈이다. kakao_name_history(jsonb)와 카카오 토큰도 함께 딸려왔다.
 */
const NAME_COLS = {
  id: users.id,
  kakaoName: users.kakaoName,
  nickname: users.nickname,
  nameEn: users.nameEn,
  avatar: users.avatar,
};

async function buildViews(postRows: (typeof posts.$inferSelect)[], viewerId?: string): Promise<PostView[]> {
  if (postRows.length === 0) return [];
  /*
   * 이름은 보는 사람의 언어에 따라 달라진다 (영어 이름을 적어 둔 회원).
   * 이 함수를 부르는 곳은 전부 요청 안이라 쿠키를 읽을 수 있고, cache로 묶여 한 번만 읽는다.
   */
  const locale = await getLocale();
  const db = await getDb();
  const postIds = postRows.map((p) => p.id);

  /*
   * neon-http는 쿼리 하나에 왕복 하나다(파이프라이닝이 없다). 그래서 순서가 곧 지연이다 —
   * 서로를 안 기다리는 것끼리 묶어 두 파로 나눈다. 예전에는 여섯 번을 줄줄이 기다렸다.
   */
  /*
   * 정기 회차가 하나도 없으면 규칙을 물어보지 않는다 — 대부분의 목록이 그렇다.
   * 물어볼 때도 이 파에 같이 실어서 왕복은 그대로 한 번이다.
   */
  const ruleIds = [...new Set(postRows.map((p) => p.recurringRuleId).filter((id): id is string => Boolean(id)))];
  const [participantRows, commentRows, liveRules] = await Promise.all([
    db.select().from(postParticipants).where(inArray(postParticipants.postId, postIds)),
    db
      .select()
      .from(postComments)
      .where(and(inArray(postComments.postId, postIds), isNull(postComments.deletedAt)))
      .orderBy(asc(postComments.createdAt)),
    ruleIds.length
      ? db
          .select({ id: recurringRules.id })
          .from(recurringRules)
          .where(and(inArray(recurringRules.id, ruleIds), eq(recurringRules.active, true)))
      : [],
  ]);
  const liveRuleIds = new Set(liveRules.map((r) => r.id));
  const repeatsOn = (p: typeof posts.$inferSelect) => Boolean(p.recurringRuleId && liveRuleIds.has(p.recurringRuleId));

  /*
   * 로그인하지 않은 사람에게는 사람에 관한 것을 내려보내지 않는다 —
   * 시간·장소·인원수까지만. 화면에서 가리는 게 아니라 응답에서 뺀다.
   */
  const signedIn = Boolean(viewerId);

  const countOf = (m: Map<string, unknown[]>, id: string) => (m.get(id) ?? []).length;
  const partByPostId = new Map<string, { userId: string }[]>();
  for (const p of participantRows) {
    if (!partByPostId.has(p.postId)) partByPostId.set(p.postId, []);
    partByPostId.get(p.postId)!.push(p);
  }
  const cmtByPostId = new Map<string, unknown[]>();
  for (const c of commentRows) {
    if (!cmtByPostId.has(c.postId)) cmtByPostId.set(c.postId, []);
    cmtByPostId.get(c.postId)!.push(c);
  }

  /*
   * 로그아웃 상태에서는 이름·사진·호스트 횟수·댓글을 다 만들어 놓고 마지막에 버렸다.
   * 여기서 끊으면 남은 네 질의가 통째로 사라진다 — 카톡 링크를 받은 사람이 밟는 바로 그 길이다.
   */
  if (!signedIn) {
    return postRows.map((p) => ({
      ...shellOf(p, repeatsOn(p)),
      authorName: null,
      coHost: null,
      participants: [],
      participantCount: countOf(partByPostId as Map<string, unknown[]>, p.id),
      settle: null,
      rating: null,
      photos: null,
      comments: [],
      commentCount: countOf(cmtByPostId, p.id),
    }));
  }

  /*
   * 정산과 사진은 같이 논 사람들 사이의 일이다 — 참가자(와 관리자)에게만 붙인다.
   * 그 밖에는 null이라, 정산이나 사진이 있다는 사실조차 응답에 나가지 않는다.
   */
  const viewerIsAdmin = Boolean(viewerId && adminIds().includes(viewerId));
  const myPostIds = viewerIsAdmin
    ? postIds
    : [...new Set(participantRows.filter((p) => p.userId === viewerId).map((p) => p.postId))];
  // 이름이 필요한 사람만 모은다 — 참가자, 댓글 쓴 사람, 주최자, 같이 여는 사람
  const nameIds = new Set<string>();
  for (const p of participantRows) nameIds.add(p.userId);
  for (const c of commentRows) nameIds.add(c.userId);
  for (const p of postRows) {
    nameIds.add(p.authorId);
    if (p.coHostId) nameIds.add(p.coHostId);
  }
  const commentIds = commentRows.map((c) => c.id);
  // 평점은 끝난 무비나잇에만 붙는다 — 나머지 모임까지 세면 대부분 빈 답을 받으러 가는 셈이다
  const ratableIds = postRows.filter((p) => ratable(shellOf(p, repeatsOn(p)))).map((p) => p.id);

  const [userRows, hostCounts, settleByPost, likeRows, ratingByPost, photoByPost] = await Promise.all([
    nameIds.size ? db.select(NAME_COLS).from(users).where(inArray(users.id, [...nameIds])) : [],
    hostCountsFor([...new Set(participantRows.map((p) => p.userId))]),
    settlementSummaries(myPostIds, viewerId),
    commentIds.length ? db.select().from(commentLikes).where(inArray(commentLikes.commentId, commentIds)) : [],
    ratingSummaries(ratableIds, viewerId),
    photoStrips(myPostIds),
  ]);
  const userById = new Map(userRows.map((u) => [u.id, u]));

  // 모임마다 닉네임 허용 여부가 다르다 — 참가자 이름은 그 모임의 규칙으로 만든다
  const nickOk = new Map(postRows.map((p) => [p.id, p.allowNicknames]));
  /*
   * 이름이 하나도 안 나가는 모임 (별보러가자처럼 anonymous를 켠 카테고리).
   *
   * 이름만 「익명」으로 바꾸고 끝내면 안 된다 — 회원번호가 그대로 딸려 나가면
   * 개발자 도구를 여는 것만으로 누구인지 읽힌다(친구 목록·관리자 명부에 같은 번호가 있다).
   * 그래서 보고 있는 본인 것만 진짜 번호를 남기고, 남의 것은 자리 번호로 바꾼다.
   * 본인 것을 남기는 이유: 명단의 「나」 표시와 참가/나가기 버튼이 그걸로 판단한다.
   */
  const anonPost = new Map(postRows.map((p) => [p.id, isAnonymous(p.category)]));
  const anonLabel = pick(locale, N.anon);
  const byPost = new Map<string, { id: string; name: string; avatar: string | null; hostCount: number }[]>();
  for (const p of participantRows) {
    if (!byPost.has(p.postId)) byPost.set(p.postId, []);
    const list = byPost.get(p.postId)!;
    const hidden = (anonPost.get(p.postId) ?? false) && p.userId !== viewerId;
    list.push({
      id: hidden ? `anon:${list.length}` : p.userId,
      name: anonPost.get(p.postId)
        ? anonLabel
        : displayNameOf(userById.get(p.userId), UNKNOWN_NAME, locale, nickOk.get(p.postId) ?? false),
      // 얼굴과 주최 횟수 뱃지도 사람을 가리킨다 — 이름만 가리면 가린 게 아니다
      avatar: hidden ? null : (userById.get(p.userId)?.avatar ?? null),
      hostCount: anonPost.get(p.postId) ? 0 : (hostCounts.get(p.userId) ?? 0),
    });
  }

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
    const mine = c.userId === viewerId;
    const anon = c.anonymous || (anonPost.get(c.postId) ?? false);
    const hideName = anon && !mine;
    commentsByPost.get(c.postId)!.push({
      id: c.id,
      // 참가자 명단과 같은 이유로 남의 회원번호는 안 내보낸다
      userId: hideName ? '' : c.userId,
      name: hideName ? null : displayNameOf(userById.get(c.userId), UNKNOWN_NAME, locale, nickOk.get(c.postId) ?? false),
      anonymous: anon,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
      parentId: c.parentId ?? null,
      likeCount: likeCount.get(c.id) ?? 0,
      likedByMe: likedByViewer.has(c.id),
    });
  }

  return postRows.map((p) => ({
    ...shellOf(p, repeatsOn(p)),
    /*
     * 연 사람의 회원번호도 가린다 — 이름을 「익명」으로 바꿔 놓고 번호를 남기면
     * 누가 열었는지 그대로 읽힌다. 본인에게는 남긴다: 수정·삭제 버튼이 이걸로 판단한다.
     */
    ...(anonPost.get(p.id) && p.authorId !== viewerId ? { authorId: '' } : {}),
    authorName: anonPost.get(p.id)
      ? anonLabel
      : displayNameOf(userById.get(p.authorId), UNKNOWN_NAME, locale, p.allowNicknames),
    coHost: p.coHostId
      ? {
          id: anonPost.get(p.id) && p.coHostId !== viewerId ? '' : p.coHostId,
          name: anonPost.get(p.id)
            ? anonLabel
            : displayNameOf(userById.get(p.coHostId), UNKNOWN_NAME, locale, p.allowNicknames),
        }
      : null,
    participants: byPost.get(p.id) ?? [],
    participantCount: (byPost.get(p.id) ?? []).length,
    settle: settleByPost.get(p.id) ?? null,
    rating: ratingByPost.get(p.id) ?? null,
    photos: photoByPost.get(p.id) ?? null,
    comments: commentsByPost.get(p.id) ?? [],
    commentCount: (commentsByPost.get(p.id) ?? []).length,
  }));
}

/**
 * 사람과 무관한 칸들 — 로그인 여부와 상관없이 똑같이 나간다.
 *
 * 로그아웃 뷰어용 응답과 로그인 뷰어용 응답이 같은 모양이어야 해서 한 군데서 만든다.
 * 두 군데에 적어 두면 칸을 하나 더할 때 한쪽만 고치게 된다.
 */
function shellOf(p: typeof posts.$inferSelect, repeatsOn: boolean) {
  return {
    id: p.id,
    category: p.category,
    authorId: p.authorId,
    title: p.title,
    titleMeta: p.titleMeta ?? null,
    recurringRuleId: p.recurringRuleId ?? null,
    repeatsOn,
    allowNicknames: p.allowNicknames,
    date: p.date,
    startTime: p.startTime,
    endTime: p.endTime,
    location: p.location,
    description: p.description,
    capacity: p.capacity,
    visibility: (p.visibility === 'link' ? 'link' : 'public') as 'link' | 'public',
    isPast: isPastSlot(p.date, p.startTime, p.endTime),
    createdAt: p.createdAt.toISOString(),
  };
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
  post: { id: string; category: string; date: string | null; startTime: string | null; location: string; title?: string | null },
  commenterId: string,
  commenterName: LocalName,
  body: string,
  origin: string,
  /** 답글이면 원 댓글 작성자 — 참가자가 아니어도 알려준다 */
  parentAuthorId?: string,
  /** 익명 댓글이면 이름 자리에 "익명"이 들어간다 */
  anonymous = false
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
        /*
         * 익명으로 단 댓글은 알림에서도 익명이어야 한다.
         * 이 문자열 하나가 인앱·카톡·푸시로 그대로 나가므로(sendNotice), 여기서 막으면 세 곳이 함께 막힌다.
         * 화면에서는 가려지는데 알림에는 이름이 찍히면, 익명으로 적은 사람은 가려진 줄 알고 적는다.
         */
        name: anonymous || isAnonymous(post.category) ? pick(locale, N.anon) : commenterName(locale),
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
  return (await db.select().from(postComments).where(and(eq(postComments.id, commentId), isNull(postComments.deletedAt))))[0];
}

/**
 * 댓글 지우기 — 표시만 한다.
 *
 * 하트(comment_likes)와 답글은 그대로 남는다. 답글은 parent_id로 붙는데, 지운 댓글은
 * 목록에서 빠지므로 답글이 부모 없이 뜬다 — 지금도 원 댓글이 없으면 같은 줄에 그냥
 * 놓이는 모양이라 화면이 깨지지는 않는다.
 */
export async function deleteComment(commentId: string): Promise<void> {
  const db = await getDb();
  await db.update(postComments).set({ deletedAt: new Date() }).where(eq(postComments.id, commentId));
}

/** 리마인더 알림 식별용 접두사 — 중복 발송 방지에 쓰이므로 메시지 앞부분을 바꾸지 말 것 */
const REMINDER_PREFIX = '⏰';

/** 알림 문구 조각 (수신자 언어로 렌더된다) */
const N = {
  newPost: { ko: '새 모임', en: 'new meetup', es: 'nueva quedada' },
  weekly: { ko: '이번 주 모임', en: 'this week', es: 'esta semana' },
  updated: { ko: '모임 변경', en: 'updated', es: 'actualizada' },
  cancelled: { ko: '모임 취소', en: 'cancelled', es: 'cancelada' },
  comment: { ko: '새 댓글', en: 'new comment', es: 'nuevo comentario' },
  /** 익명 댓글의 이름 자리 (app/comment-thread.tsx의 표기와 같아야 한다) */
  anon: { ko: '익명', en: 'Anonymous', es: 'Anónimo' },
  today: { ko: '오늘 모임', en: 'today', es: 'hoy' },
  byActor: { ko: '{text} — {name}', en: '{text} — {name}', es: '{text} — {name}' },
  commentLine: { ko: '{text} — {name}: {body}', en: '{text} — {name}: {body}', es: '{text} — {name}: {body}' },
  btnPost: { ko: '모임 보기', en: 'View meetup', es: 'Ver la quedada' },
  /*
   * 「무엇이 바뀌었나」 — 변경 알림에 붙는 조각들.
   *
   * 예전에는 바뀐 **결과**만 적었다(「피클볼 모임 변경 · 8/9(토) 오후 7:00 · 스타디움」).
   * 받는 사람은 그게 원래 그랬는지 방금 바뀐 것인지 알 수가 없어서, 결국 모임을 열어
   * 기억과 맞춰봐야 했다. 무엇이 어떻게 바뀌었는지 그 자리에서 읽히게 한다.
   */
  chDate: { ko: '날짜', en: 'Date', es: 'Fecha' },
  chTime: { ko: '시간', en: 'Time', es: 'Hora' },
  chPlace: { ko: '장소', en: 'Place', es: 'Lugar' },
  chTitle: { ko: '제목', en: 'Title', es: 'Título' },
  chCapacity: { ko: '정원', en: 'Capacity', es: 'Aforo' },
  /** 메모는 길어서 본문을 싣지 않는다 — 바뀌었다는 사실만 */
  chMemo: { ko: '메모가 바뀌었어요', en: 'The note changed', es: 'La nota cambió' },
  chFromTo: { ko: '{label} {from} → {to}', en: '{label} {from} → {to}', es: '{label} {from} → {to}' },
  chNone: { ko: '없음', en: 'none', es: 'ninguno' },
  chNoLimit: { ko: '무제한', en: 'no limit', es: 'sin límite' },
  chPeople: { ko: '{n}명', en: '{n}', es: '{n}' },
  btnComment: { ko: '댓글 보기', en: 'View comments', es: 'Ver comentarios' },
  btnOther: { ko: '다른 모임 보기', en: 'See other meetups', es: 'Ver otras quedadas' },
  // 친구 알림 — 주어가 모임이 아니라 사람이라 이름이 앞에 온다
  meetup: { ko: '모임', en: 'meetup', es: 'quedada' },
  friendJoinLine: { ko: '{name}님이 참가했어요 · {text}', en: '{name} joined · {text}', es: '{name} se apuntó · {text}' },
  coHostLine: {
    ko: '{name}님이 회원님을 공동 호스트로 정했어요 · {text}',
    en: '{name} made you a co-host · {text}',
    es: '{name} te hizo co-anfitrión · {text}',
  },
  addedLine: { ko: '{name}님이 이 모임에 넣었어요 · {text}', en: '{name} added you · {text}', es: '{name} te añadió · {text}' },
  inviteLine: { ko: '{name}님이 초대했어요 · {text}', en: '{name} invited you · {text}', es: '{name} te invitó · {text}' },
};

/** 알림 메시지용 모임 설명: "🥒 피클볼 새 모임 · 8/1(토) 오후 6:00 · OP코트" (제목이 있으면 〈제목〉 삽입) */
function describeForNotification(
  category: string,
  label: Msg,
  date: string | null,
  startTime: string | null,
  location: string,
  title: string | null | undefined,
  locale: Locale
): string {
  const cat = getCategory(category);
  const titlePart = title ? ` 〈${title}〉` : '';
  const when = whenLabelShort(date, startTime, locale);
  return `${cat?.emoji ?? ''} ${catName(category, locale)} ${pick(locale, label)}${titlePart} · ${when} · ${location}`;
}

/** 수정 전후를 견줄 때 보는 칸들 — updatePost가 넘긴다 */
interface PostShape {
  title: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string;
  description: string | null;
  capacity: number | null;
}

/**
 * 「오후 7:00–9:00」 — 오전·오후가 같으면 한 번만 적는다.
 *
 * 그냥 이어 붙이면 「오후 7:00–오후 9:00」이 되어 한 줄에 같은 말이 두 번 들어간다.
 * 영어는 뒤에 붙는 자리라(7:00 PM) 앞쪽에서 뗀다.
 */
function timeSpan(start: string | null, end: string | null, locale: Locale): string {
  if (!start) return pick(locale, N.chNone);
  const a = timeLabel(start, locale);
  if (!end) return a;
  const b = timeLabel(end, locale);
  const [aHead, aRest] = a.split(' ');
  const [bHead, bRest] = b.split(' ');
  // ko: 「오후 7:00」 — 앞이 오전/오후
  if (aRest && bRest && aHead === bHead) return `${aHead} ${aRest}–${bRest}`;
  // en: 「7:00 PM」 — 뒤가 AM/PM
  if (aRest && bRest && aRest === bRest) return `${aHead}–${b}`;
  return `${a}–${b}`;
}

/**
 * 무엇이 어떻게 바뀌었는지 한 줄로.
 *
 * 참가자가 다시 확인해야 하는 것만 본다 — 날짜·시간·장소·제목·정원, 그리고 메모는
 * 바뀌었다는 사실만. 비공개 여부나 닉네임 허용은 「가야 하나」를 바꾸지 않으므로 뺀다.
 *
 * 아무것도 못 알아보면 빈 문자열을 준다. 그때는 부르는 쪽이 예전처럼 결과만 적는다 —
 * 「모임 변경」이라고만 하고 마는 것보다는 지금 값이라도 보이는 편이 낫다.
 */
function describeChanges(before: PostShape, after: PostShape, locale: Locale): string {
  const parts: string[] = [];
  const fromTo = (label: Msg, from: string, to: string) =>
    parts.push(pick(locale, N.chFromTo, { label: pick(locale, label), from, to }));

  if (before.date !== after.date) {
    const none = pick(locale, N.chNone);
    fromTo(
      N.chDate,
      before.date ? dateLabelShort(before.date, locale) : none,
      after.date ? dateLabelShort(after.date, locale) : none
    );
  }
  // 끝 시각만 바뀐 것도 시간이 바뀐 것이다 (「몇 시까지」를 보고 일정을 잡는다)
  if (before.startTime !== after.startTime || before.endTime !== after.endTime) {
    fromTo(
      N.chTime,
      timeSpan(before.startTime, before.endTime, locale),
      timeSpan(after.startTime, after.endTime, locale)
    );
  }
  if (before.location !== after.location) fromTo(N.chPlace, before.location, after.location);
  if ((before.title ?? '') !== (after.title ?? '')) {
    const none = pick(locale, N.chNone);
    fromTo(N.chTitle, before.title || none, after.title || none);
  }
  if (before.capacity !== after.capacity) {
    const cap = (n: number | null) => (n == null ? pick(locale, N.chNoLimit) : pick(locale, N.chPeople, { n }));
    fromTo(N.chCapacity, cap(before.capacity), cap(after.capacity));
  }
  if ((before.description ?? '') !== (after.description ?? '')) parts.push(pick(locale, N.chMemo));

  return parts.join(' · ');
}

/** 「무엇이 바뀌었나」를 실은 한 줄 — describeForNotification과 머리말은 같고 꼬리만 다르다 */
function describeChangeLine(category: string, title: string | null, changes: string, locale: Locale): string {
  const cat = getCategory(category);
  const titlePart = title ? ` 〈${title}〉` : '';
  return `${cat?.emoji ?? ''} ${catName(category, locale)} ${pick(locale, N.updated)}${titlePart} · ${changes}`;
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
    date: string | null;
    startTime: string | null;
    location: string;
    title?: string | null;
    visibility?: string | null;
  },
  joinerName: LocalName,
  recipientIds: string[],
  /**
   * 참가한 사람의 id — 관리자면 알리지 않는다.
   *
   * 관리자는 이 앱을 만들면서 하루에도 여러 번 들어갔다 나갔다 한다. 그때마다
   * 친구들 알림함에 「○○님이 참가했어요」가 쌓이면, 정작 봐야 할 알림이 그 사이에 묻힌다.
   * 관리자가 아닌 사람의 참가는 예전 그대로 알린다.
   */
  joinerId?: string
): Promise<void> {
  /*
   * 이름이 안 보이는 카테고리에서는 이 알림 자체가 나가지 않는다.
   *
   * 「○○님이 참가했어요 · 🌌 별보러가자」는 문구를 바꿔서 될 일이 아니다 —
   * 이름을 「익명」으로 바꿔도 **받은 사람이 자기 친구 목록과 맞춰 보면** 누구인지 좁혀진다.
   * 알림이 간다는 사실 자체가 「내 친구 중 누군가가 저기 있다」는 말이다.
   */
  if (post.visibility === 'link' || recipientIds.length === 0 || isAnonymous(post.category)) return;
  if (joinerId && adminIds().includes(joinerId)) return;
  await insertInAppNotice(
    recipientIds,
    post.id,
    NOTIF.friendJoin,
    (locale) =>
      `🤝 ${pick(locale, N.friendJoinLine, {
        name: joinerName(locale),
        text: describeForNotification(post.category, N.meetup, post.date, post.startTime, post.location, post.title, locale),
      })}`
  );
}

/** 남이 나를 모임에 넣었을 때 — 넣긴 사람에게 한 줄 */
export async function notifyAddedToPost(
  post: { id: string; category: string; date: string | null; startTime: string | null; location: string; title?: string | null },
  actorName: LocalName,
  addedUserId: string
): Promise<void> {
  // 이 카테고리에서는 대신 넣기 자체가 막혀 있지만(라우트), 여기서도 이름을 안 흘린다
  if (isAnonymous(post.category)) return;
  await insertInAppNotice(
    [addedUserId],
    post.id,
    NOTIF.added,
    (locale) =>
      `🤝 ${pick(locale, N.addedLine, {
        name: actorName(locale),
        text: describeForNotification(post.category, N.meetup, post.date, post.startTime, post.location, post.title, locale),
      })}`
  );
}

/**
 * 공동 호스트로 세워졌다고 알린다 — 그 사람에게만, 인앱 한 줄로.
 *
 * 남이 나를 모임에 넣었을 때(notifyAddedToPost)와 같은 결이라 같은 방식으로 보낸다:
 * 폰을 울리지는 않는다. 알아두면 되는 일이지 당장 손댈 일이 아니다.
 */
export async function notifyCoHost(
  post: { id: string; category: string; date: string | null; startTime: string | null; location: string; title?: string | null },
  actorName: LocalName,
  coHostId: string
): Promise<void> {
  await insertInAppNotice(
    [coHostId],
    post.id,
    NOTIF.added,
    (locale) =>
      `🤝 ${pick(locale, N.coHostLine, {
        name: actorName(locale),
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
/**
 * 모임·참가자가 바뀌었다고 알린다.
 *
 * 여러 모임을 가로질러 세어 둔 것들(카테고리별 다음 모임, 주최·참가 순위)이 태그로 걸려
 * 있어서, 하나라도 바뀌면 같이 버려야 한다. 라우트마다 부르지 않고 바꾸는 함수 안에서
 * 부른다 — 새 라우트를 만들면서 한 줄을 빠뜨리면 화면이 옛날 값을 들고 있게 되는데,
 * 그건 눈에 잘 안 띈다.
 */
function postsChanged(): void {
  revalidateTag(POSTS_TAG);
}

export async function createPost(input: {
  category: string;
  authorId: string;
  /** 알림 문구에 실을 이름 — 받는 사람의 언어로 정해진다 */
  authorName: LocalName;
  /** 같이 여는 사람 (최대 한 명) — 참가자로도 함께 들어간다 */
  coHostId?: string | null;
  /** 이 모임에서 닉네임으로 보여도 되는지 (기본 실명) */
  allowNicknames?: boolean;
  title?: string;
  titleMeta?: TitleMeta;
  /** null이면 날짜 미정 — 사람부터 모으는 모임 (startTime도 함께 null) */
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string;
  description?: string;
  capacity?: number;
  recurringRuleId?: string; // 정기 모임 규칙에서 생성된 회차면 규칙 id
  amcShowtimeId?: string; // AMC 회차에서 만든 모임이면 그 회차 id
  visibility?: 'public' | 'link'; // 'link'면 구독자 알림을 보내지 않는다
  /**
   * 아무에게도 알리지 않고 넣는다 — 관리자가 이미 끝난 모임을 기록으로 채워 넣을 때.
   * 어제 있었던 일에 「새 모임」 알림이 가면 그건 안내가 아니라 오해다.
   */
  silent?: boolean;
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
    input.visibility === 'link' || input.silent
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
        // 이름이 안 보이는 카테고리에서는 알림 문구에도 안 나간다
        name: isAnonymous(input.category) ? pick(locale, N.anon) : input.authorName(locale),
      })
  );

  const postValues = {
    id: postId,
    category: input.category,
    authorId: input.authorId,
    coHostId: input.coHostId ?? null,
    allowNicknames: input.allowNicknames ?? false,
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
    input.visibility === 'link' && !input.silent && (input.inviteFriendIds?.length ?? 0) > 0
      ? await buildNotice(input.inviteFriendIds!, (locale) =>
          `🤝 ${pick(locale, N.inviteLine, {
            name: isAnonymous(input.category) ? pick(locale, N.anon) : input.authorName(locale),
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
    // 여는 사람은 둘 다 참가자로 들어간다 — 호스트 점수도 참가 인원으로 세므로 명단이 곧 인원이다
    const hostRows = [{ postId, userId: input.authorId }];
    if (input.coHostId && input.coHostId !== input.authorId) hostRows.push({ postId, userId: input.coHostId });
    const statements: unknown[] = [
      db.insert(posts).values(postValues),
      db.insert(postParticipants).values(hostRows),
    ];
    if (notificationValues.length > 0) statements.push(db.insert(notifications).values(notificationValues));
    if (inviteValues.length > 0) statements.push(db.insert(notifications).values(inviteValues));
    await anyDb.batch(statements);
  } else {
    // PGlite(로컬 폴백): 인터랙티브 트랜잭션 사용
    await anyDb.transaction(async (tx: typeof db) => {
      await tx.insert(posts).values(postValues);
      const rows = [{ postId, userId: input.authorId }];
      if (input.coHostId && input.coHostId !== input.authorId) rows.push({ postId, userId: input.coHostId });
      await tx.insert(postParticipants).values(rows);
      if (notificationValues.length > 0) await tx.insert(notifications).values(notificationValues);
      if (inviteValues.length > 0) await tx.insert(notifications).values(inviteValues);
    });
  }

  // 알림 발송보다 먼저 — 발송이 실패해도 모임은 이미 생겼다
  postsChanged();

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
    .where(and(eq(posts.amcShowtimeId, showtimeId), isNull(posts.deletedAt)))
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
    .where(and(inArray(posts.amcShowtimeId, showtimeIds), isNull(posts.deletedAt)));
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
  postsChanged();
}

/**
 * 단건 조회 — 라우트들이 권한과 정원을 보는 데 쓴다.
 * 지운 모임은 없는 것으로 친다. 부르는 쪽이 전부 「없으면 404」라 그대로 맞는다.
 */
export async function getPost(postId: string) {
  const db = await getDb();
  return (await db.select().from(posts).where(and(eq(posts.id, postId), isNull(posts.deletedAt))))[0];
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
  /** 알림 문구에 실을 이름 — 받는 사람의 언어로 정해진다 */
  actorName: LocalName;
  title: string | null;
  titleMeta: TitleMeta | null;
  /** null이면 날짜 미정 — 나중에 날짜를 정하면 여기로 값이 들어온다 */
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  location: string;
  description: string | null;
  capacity: number | null;
  /** 주지 않으면 지금 값을 그대로 둔다 */
  visibility?: 'public' | 'link';
  /** undefined면 그대로 두고, null이면 같이 여는 사람을 뗀다 */
  coHostId?: string | null;
  /** 주지 않으면 지금 값을 그대로 둔다 */
  allowNicknames?: boolean;
  /**
   * 변경 알림을 보내지 않는다.
   *
   * 지난 모임을 손볼 때 쓴다 — 이미 끝난 모임의 장소나 명단을 바로잡는 일이라,
   * 「모임 변경」이 날아가면 받는 사람은 다시 확인할 것이 있는 줄 안다.
   */
  silent?: boolean;
  origin?: string;
}): Promise<void> {
  const db = await getDb();
  const recipients = input.silent ? [] : await participantIdsExcept(input.postId, input.actorId);
  /*
   * 무엇이 바뀌었는지 적으려면 **고치기 전 값**이 있어야 한다. 아래 update 전에 읽는다.
   * 보낼 사람이 없으면 읽지 않는다 — 아무도 못 볼 문장을 만들려고 왕복을 늘리지 않는다.
   */
  const before = recipients.length > 0 ? await getPost(input.postId) : undefined;
  const after = {
    title: input.title,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    description: input.description,
    capacity: input.capacity,
  };
  const notice = await buildNotice(recipients, (locale) => {
    const changes = before ? describeChanges(before, after, locale) : '';
    return pick(locale, N.byActor, {
      // 알아본 변경이 없으면 예전처럼 지금 값을 적는다 (「모임 변경」만 남기는 것보다 낫다)
      text: changes
        ? describeChangeLine(input.category, input.title, changes, locale)
        : describeForNotification(
            input.category,
            N.updated,
            input.date,
            input.startTime,
            input.location,
            input.title,
            locale
          ),
      name: isAnonymous(input.category) ? pick(locale, N.anon) : input.actorName(locale),
    });
  });

  const set = {
    title: input.title,
    titleMeta: input.titleMeta,
    date: input.date,
    startTime: input.startTime,
    endTime: input.endTime,
    location: input.location,
    ...(input.visibility ? { visibility: input.visibility } : {}),
    ...(input.coHostId !== undefined ? { coHostId: input.coHostId } : {}),
    ...(input.allowNicknames !== undefined ? { allowNicknames: input.allowNicknames } : {}),
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
  /*
   * 새로 지정된 사람은 참가자로도 들어간다 — 호스트 점수를 참가 인원으로 세기 때문에,
   * 명단에 없는 호스트는 자기가 연 모임의 인원에서 자기만 빠진 값을 받게 된다.
   * 이미 참가 중이면 아무 일도 일어나지 않는다.
   */
  const joinCoHost =
    input.coHostId && input.coHostId !== input.actorId
      ? db
          .insert(postParticipants)
          .values({ postId: input.postId, userId: input.coHostId })
          .onConflictDoNothing()
      : null;

  if (typeof anyDb.batch === 'function') {
    const statements: unknown[] = [db.update(posts).set(set).where(eq(posts.id, input.postId))];
    if (joinCoHost) statements.push(joinCoHost);
    if (notificationValues.length > 0) statements.push(db.insert(notifications).values(notificationValues));
    await anyDb.batch(statements);
  } else {
    await anyDb.transaction(async (tx: typeof db) => {
      await tx.update(posts).set(set).where(eq(posts.id, input.postId));
      if (input.coHostId && input.coHostId !== input.actorId) {
        await tx
          .insert(postParticipants)
          .values({ postId: input.postId, userId: input.coHostId })
          .onConflictDoNothing();
      }
      if (notificationValues.length > 0) await tx.insert(notifications).values(notificationValues);
    });
  }

  if (input.origin && recipients.length > 0) {
    await sendNotice(notice, `${input.origin}/p/${input.postId}`);
  }
  postsChanged();
}

/**
 * 모임 삭제(취소) + 참가자(취소자 제외)에게 취소 알림.
 *
 * 행을 지우지 않고 deleted_at에 시각을 적는다. 예전에는 진짜로 지웠고, CASCADE가
 * 그 모임의 참가 명단·댓글·사진·정산·평점까지 함께 데려갔다. 잘못 누르면 끝이었다.
 * 이제 자식들은 자리에 그대로 있고, 모임이 안 보이니 따라서 안 보인다. 되살리면 같이 돌아온다.
 *
 * 사진 파일도 지우지 않는다 — 지우면 되살려 봐야 깨진 그림이다.
 *
 * 취소 알림의 postId는 여전히 null이다. 없어진 화면으로 보내지 않으려는 것이라
 * 소프트 딜리트가 되어도 이유가 그대로다 (getPostView가 지운 모임에 404를 준다).
 */
export async function deletePost(
  post: { id: string; category: string; date: string | null; startTime: string | null; location: string; title?: string | null },
  actorId: string,
  actorName: LocalName,
  origin?: string,
  /**
   * 취소 알림을 보내지 않는다.
   *
   * 지난 모임을 치울 때 쓴다 — 이미 지나간 일에 "모임이 취소됐어요"가 날아가면
   * 받는 사람은 무슨 모임이 취소됐다는 건지 알 수 없다.
   */
  silent = false
): Promise<void> {
  const db = await getDb();
  const recipients = silent ? [] : await participantIdsExcept(post.id, actorId);
  const notice = await buildNotice(
    recipients,
    (locale) =>
      pick(locale, N.byActor, {
        text: describeForNotification(post.category, N.cancelled, post.date, post.startTime, post.location, post.title, locale),
        name: isAnonymous(post.category) ? pick(locale, N.anon) : actorName(locale),
      }),
    N.btnOther
  );
  const notificationValues = notice.rows.map((r) => ({
    id: crypto.randomUUID(),
    userId: r.userId,
    postId: null,
    message: r.message,
  }));

  const softDelete = db.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, post.id));
  const anyDb = db as any;
  if (typeof anyDb.batch === 'function') {
    const statements: unknown[] = [softDelete];
    if (notificationValues.length > 0) statements.unshift(db.insert(notifications).values(notificationValues));
    await anyDb.batch(statements);
  } else {
    await anyDb.transaction(async (tx: typeof db) => {
      if (notificationValues.length > 0) await tx.insert(notifications).values(notificationValues);
      await tx.update(posts).set({ deletedAt: new Date() }).where(eq(posts.id, post.id));
    });
  }

  postsChanged();

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
  const todayPosts = await db.select().from(posts).where(and(eq(posts.date, today), isNull(posts.deletedAt)));
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
  postsChanged();
  return true;
}

export async function leavePost(postId: string, userId: string): Promise<void> {
  const db = await getDb();
  await db.delete(postParticipants).where(and(eq(postParticipants.postId, postId), eq(postParticipants.userId, userId)));
  postsChanged();
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
      /*
       * 알림에 적힌 id가 아니라 **붙은 모임의 id**를 쓴다. 지워진 모임은 아래 join이
       * 걸러내므로 여기가 null이 되고, 화면은 그 줄을 눌리지 않게 둔다 — 눌러 봐야
       * 없는 모임 화면이다. 예전 하드 딜리트에서 저절로 그랬던 것과 같은 모양이다.
       */
      postId: posts.id,
      kind: notifications.kind,
      message: notifications.message,
      read: notifications.read,
      createdAt: notifications.createdAt,
      category: posts.category,
    })
    .from(notifications)
    .leftJoin(posts, and(eq(notifications.postId, posts.id), isNull(posts.deletedAt)))
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

/**
 * 내가 지운 알림 — 지운 사람 본인이 다시 모아 볼 수 있게.
 *
 * 지우는 건 되돌릴 수 없는 일처럼 느껴지지만 실제로는 표시만 하는 것이라(deleted_at),
 * 잘못 지웠을 때 찾아볼 자리가 있어야 한다.
 */
export async function listMyDeletedNotifications(userId: string, limit = 100) {
  const db = await getDb();
  const rows = await db
    .select({
      id: notifications.id,
      postId: notifications.postId,
      kind: notifications.kind,
      message: notifications.message,
      createdAt: notifications.createdAt,
      deletedAt: notifications.deletedAt,
    })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNotNull(notifications.deletedAt)))
    .orderBy(desc(notifications.deletedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    postId: r.postId,
    kind: r.kind,
    message: r.message,
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt!.toISOString(),
  }));
}

/** 지운 알림을 되살린다 (본인 것만) */
export async function restoreNotification(id: string, userId: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(notifications)
    .set({ deletedAt: null })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId), isNotNull(notifications.deletedAt)))
    .returning();
  return rows.length > 0;
}

/** 관리자 화면용 — 지워진 알림 목록 (누가 무엇을 지웠는지) */
export async function listDeletedNotifications(limit = 100) {
  const locale = await getLocale();
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
      nameEn: users.nameEn,
    })
    .from(notifications)
    .innerJoin(users, eq(notifications.userId, users.id))
    .where(isNotNull(notifications.deletedAt))
    .orderBy(desc(notifications.deletedAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    message: r.message,
    name: displayNameOf({ kakaoName: r.kakaoName, nickname: r.nickname, nameEn: r.nameEn }, UNKNOWN_NAME, locale),
    createdAt: r.createdAt.toISOString(),
    deletedAt: r.deletedAt!.toISOString(),
  }));
}

