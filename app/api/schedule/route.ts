import { NextRequest, NextResponse } from 'next/server';
import { getDaySchedule, getProfiles, getSelections, resolveDisplayName } from '@/lib/store';
import { Selections } from '@/lib/types';
import { amcConfigured } from '@/lib/amc';
import { scheduleDates } from '@/lib/seed';
import { postIdsByShowtime } from '@/lib/db/posts';
import { todayLocal } from '@/lib/dates';

export const dynamic = 'force-dynamic';

/**
 * 하루치 상영표 + 전체 선택 현황.
 * ?date=YYYY-MM-DD (없으면 오늘). 고를 수 있는 날짜 목록도 함께 내려준다.
 */
export async function GET(req: NextRequest) {
  const today = todayLocal();
  const dates = scheduleDates(today);
  const requested = req.nextUrl.searchParams.get('date');
  const date = requested && dates.includes(requested) ? requested : today;

  const [selections, profiles] = await Promise.all([getSelections(), getProfiles()]);

  // 표시 이름은 읽기 시점에 프로필 기준으로 해석 (앱 닉네임 → 카카오 닉네임 → 저장 시점 스냅샷)
  const resolved: Selections = {};
  for (const [userId, sel] of Object.entries(selections)) {
    resolved[userId] = { ...sel, name: resolveDisplayName(profiles[userId], sel.name) };
  }

  // AMC 호출이 실패해도 선택 현황은 보여준다
  let movies: Awaited<ReturnType<typeof getDaySchedule>>['movies'] = [];
  let sample = false;
  let error: string | null = null;
  try {
    const day = await getDaySchedule(date);
    movies = day.movies;
    sample = Boolean(day.sample);
  } catch (e) {
    console.error('[schedule] day fetch failed:', e);
    error = e instanceof Error ? e.message : 'AMC 상영표를 불러오지 못했어요.';
  }

  // 어떤 회차가 이미 모임으로 만들어졌는지 (그룹 화면이 버튼 대신 링크를 보여준다)
  const pickedIds = [...new Set(Object.values(selections).flatMap((s) => s.picks.map((p) => p.id)))];
  const meetups = await postIdsByShowtime(pickedIds);

  return NextResponse.json({
    date,
    dates,
    movies,
    selections: resolved,
    meetups,
    sample,
    amcConfigured: amcConfigured(),
    ...(error ? { error } : {}),
  });
}
