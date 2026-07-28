/* ============================================================
   새 파일 — app/api/next-meetups/route.ts 로 저장하세요.
   카드 하단 「다음 일정 한 줄」용 요약을 카테고리별로 한 번에 내려줍니다.

   GET /api/next-meetups
   → { today, summaries: { [slug]: { date, startTime, location, title,
                                     count, capacity, joined, postId } } }

   AMC(kind: 'movie')는 모임(posts)이 아니라 회차 선택에서 만들기 때문에
   내가 고른 회차 중 가장 가까운 것 + 같은 회차를 고른 사람 수로 채웁니다.
   비로그인 사용자에게는 AMC 항목이 내려가지 않습니다.
   ============================================================ */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { CATEGORIES, POST_CATEGORY_SLUGS } from '@/lib/categories';
import { nextMeetupByCategory, type NextMeetup } from '@/lib/db/next-meetups';
import { getSelections } from '@/lib/store';
import { todayLocal } from '@/lib/dates';

export const dynamic = 'force-dynamic';

const MOVIE_SLUG = CATEGORIES.find((c) => c.kind === 'movie')?.slug;

export async function GET() {
  const viewer = await getSessionUser();
  const summaries: Record<string, NextMeetup> = await nextMeetupByCategory(
    POST_CATEGORY_SLUGS,
    viewer?.id
  );

  if (viewer && MOVIE_SLUG) {
    const amc = await nextAmcPick(viewer.id);
    if (amc) summaries[MOVIE_SLUG] = amc;
  }

  return NextResponse.json({ today: todayLocal(), summaries });
}

/** 내가 고른 회차 중 아직 지나지 않은 가장 가까운 것 */
async function nextAmcPick(userId: string): Promise<NextMeetup | null> {
  const today = todayLocal();
  let selections;
  try {
    selections = await getSelections();
  } catch {
    return null; // 선택 저장소를 못 읽어도 카드 요약 때문에 홈이 깨지면 안 된다
  }
  const mine = selections[userId]?.picks ?? [];
  const upcoming = mine
    .filter((p) => p.date >= today)
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
  const pick = upcoming[0];
  if (!pick) return null;

  // 같은 회차를 고른 사람 수 (나 포함) — 매칭 인원이 카드에서 바로 보이게
  let count = 0;
  for (const sel of Object.values(selections)) {
    if (sel.picks.some((p) => p.id === pick.id)) count++;
  }

  return {
    postId: '',
    date: pick.date,
    startTime: pick.time,
    location: pick.format,
    title: pick.movieName,
    count,
    capacity: null,
    joined: true,
  };
}
