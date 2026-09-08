/* ============================================================
   새 파일 — lib/db/next-meetups.ts 로 저장하세요.
   카테고리별 "다음 모임 한 줄"에 필요한 최소 정보만 모아 옵니다.
   쿼리 2번(예정 모임 + 참가자)으로 전체 카테고리를 한꺼번에 처리합니다.
   ============================================================ */

import { unstable_cache } from 'next/cache';
import { and, asc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { getDb } from './index';
import { postParticipants, posts } from './schema';
import { openEndCutoffTime, pastCutoff } from '../dates';
import { POSTS_TAG } from '../cache-tags';
import type { Region } from '../region';

export interface NextMeetup {
  postId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  /** 장소 (AMC는 상영 포맷) */
  location: string;
  /** 제목이 있는 카테고리면 그 제목 (AMC는 영화 이름) */
  title: string | null;
  count: number;
  capacity: number | null;
}

/**
 * 카테고리별 가장 가까운 예정 모임.
 * "지난 모임" 판정은 목록 화면과 같은 기준(종료 시각 + 유예)을 쓴다.
 *
 * 보는 사람이 누구든 같은 답이다 — 비공개 모임은 애초에 빼고 세므로 여기에 개인적인 것이
 * 하나도 없다. 그래서 아래에서 요청 사이에도 캐시할 수 있다.
 */
async function query(region: Region, categories: string[]): Promise<Record<string, NextMeetup>> {
  if (categories.length === 0) return {};
  const db = await getDb();
  const { date: cutDate, time: cutTime } = pastCutoff(region);
  // 종료 시각이 없는 모임은 시작 시각을 당겨 둔 기준과 견준다 (lib/dates.ts 참고)
  const openCut = openEndCutoffTime(region);
  const upcomingToday = openCut
    ? or(gt(posts.endTime, cutTime), and(isNull(posts.endTime), gt(posts.startTime, openCut)))
    : or(gt(posts.endTime, cutTime), isNull(posts.endTime));
  const upcoming = or(gt(posts.date, cutDate), and(eq(posts.date, cutDate), upcomingToday));

  const rows = await db
    .select({
      id: posts.id,
      category: posts.category,
      title: posts.title,
      date: posts.date,
      startTime: posts.startTime,
      location: posts.location,
      capacity: posts.capacity,
    })
    .from(posts)
    // 비공개(link) 모임은 카드 요약에도 올리지 않는다 — 링크 없는 사람 눈에 띄면 안 된다
    .where(
      and(
        eq(posts.region, region),
        inArray(posts.category, categories),
        upcoming,
        eq(posts.visibility, 'public'),
        isNull(posts.deletedAt)
      )
    )
    .orderBy(asc(posts.date), asc(posts.startTime));

  // 날짜순으로 왔으므로 카테고리마다 처음 만난 행이 곧 다음 모임이다
  const firstByCategory = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!firstByCategory.has(r.category)) firstByCategory.set(r.category, r);
  }
  if (firstByCategory.size === 0) return {};

  const ids = [...firstByCategory.values()].map((r) => r.id);
  const participantRows = await db
    .select({ postId: postParticipants.postId, userId: postParticipants.userId })
    .from(postParticipants)
    .where(inArray(postParticipants.postId, ids));

  const count = new Map<string, number>();
  for (const p of participantRows) {
    count.set(p.postId, (count.get(p.postId) ?? 0) + 1);
  }

  const out: Record<string, NextMeetup> = {};
  for (const [category, r] of firstByCategory) {
    out[category] = {
      postId: r.id,
      // upcoming 조건(날짜 비교)이 날짜 미정을 이미 걸러낸다 — 여기 오는 행은 날짜가 있다
      date: r.date!,
      startTime: r.startTime!,
      location: r.location,
      title: r.title,
      count: count.get(r.id) ?? 0,
      capacity: r.capacity,
    };
  }
  return out;
}

/*
 * 홈과 둘러보기가 매번 부르는 두 질의를 요청 사이에도 남긴다.
 *
 * 열두 카테고리를 한 번에 훑는 것이라 사람마다 다르지 않고, 모임을 만들거나
 * 참가자가 바뀌기 전에는 답도 그대로다. 그래서 그 일이 있을 때 태그로 지우고
 * (revalidateTag('posts')), 그 사이에도 60초마다 스스로 한 번 다시 읽는다 —
 * 아무도 아무것도 안 해도 「다음 모임」은 시간이 지나면 지난 모임이 되기 때문이다.
 */
/* 인자(region, categories)가 캐시 키에 들어가므로 지역마다 따로 담긴다 */
export const nextMeetupByCategory = unstable_cache(query, ['next-meetups'], {
  tags: [POSTS_TAG],
  revalidate: 60,
});
