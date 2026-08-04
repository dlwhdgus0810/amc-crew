import { getDaySchedule, getProfiles, getSelections, resolveDisplayName } from './store';
import { Selections } from './types';
import { amcConfigured } from './amc';
import { scheduleDates } from './seed';
import { postIdsByShowtime } from './db/posts';
import { todayLocal } from './dates';

/**
 * 하루치 상영표 + 전체 선택 현황.
 *
 * 라우트(/api/schedule)와 서버 렌더가 같이 쓴다. 화면은 첫 하루치를 서버에서 받고,
 * 날짜를 바꿀 때만 라우트를 부른다 — 둘이 다른 것을 만들면 날짜를 한 번 넘겼다
 * 돌아왔을 때 화면이 달라진다.
 */
export async function scheduleDay(requested?: string | null) {
  const today = todayLocal();
  const dates = scheduleDates(today);
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

  return {
    date,
    dates,
    movies,
    selections: resolved,
    meetups,
    sample,
    amcConfigured: amcConfigured(),
    ...(error ? { error } : {}),
  };
}

export type ScheduleDay = Awaited<ReturnType<typeof scheduleDay>>;
