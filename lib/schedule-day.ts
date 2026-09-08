import { getDaySchedule, getProfiles, getSelections, resolveDisplayName } from './store';
import { getLocale } from './locale';
import { Selections } from './types';
import { amcConfigured } from './amc';
import { scheduleDates } from './seed';
import { postIdsByShowtime } from './db/posts';
import { todayLocal } from './dates';
import type { Region } from './region';

/**
 * 무비나잇 화면이 쓰는 하루치.
 *
 * 두 갈래다. 상영표는 극장이 정해 둔 것이라 아무도 손대지 않아도 그대로고, 선택 현황은
 * 누가 회차를 고를 때마다 바뀐다. 둘을 한 응답에 담으면 상영표까지 매번 다시 받게 되므로
 * 라우트를 나눠 두고(상영표만 브라우저가 잠시 들고 있는다), 서버 렌더는 아래 scheduleDay가
 * 둘을 합쳐 한 번에 쓴다.
 */

/** 고를 수 있는 날짜와, 그 안에서 실제로 보여줄 하루 */
function resolveDate(region: Region, requested?: string | null) {
  const today = todayLocal(region);
  const dates = scheduleDates(today);
  return { dates, date: requested && dates.includes(requested) ? requested : today };
}

/** 상영표 — 사람에 따라 다르지 않고, 하루 동안 거의 바뀌지 않는다 */
export async function scheduleMovies(region: Region, requested?: string | null) {
  const { dates, date } = resolveDate(region, requested);

  // AMC 호출이 실패해도 화면은 떠야 한다 — 상영표만 비우고 까닭을 함께 내려준다
  let movies: Awaited<ReturnType<typeof getDaySchedule>>['movies'] = [];
  let sample = false;
  let error: string | null = null;
  try {
    const day = await getDaySchedule(region, date);
    movies = day.movies;
    sample = Boolean(day.sample);
  } catch (e) {
    console.error('[schedule] day fetch failed:', e);
    error = e instanceof Error ? e.message : 'AMC 상영표를 불러오지 못했어요.';
  }

  return { date, dates, movies, sample, amcConfigured: amcConfigured(region), ...(error ? { error } : {}) };
}

/** 선택 현황 — 누가 무엇을 골랐는지. 회차를 누를 때마다 바뀐다 */
export async function schedulePicks(region: Region, requested?: string | null) {
  const { dates, date } = resolveDate(region, requested);
  const [selections, profiles, locale] = await Promise.all([getSelections(region), getProfiles(), getLocale()]);

  // 표시 이름은 읽기 시점에 프로필 기준으로 해석 (앱 닉네임 → 카카오 닉네임 → 저장 시점 스냅샷)
  const resolved: Selections = {};
  for (const [userId, sel] of Object.entries(selections)) {
    resolved[userId] = { ...sel, name: resolveDisplayName(profiles[userId], sel.name, locale) };
  }

  // 어떤 회차가 이미 모임으로 만들어졌는지 (그룹 화면이 버튼 대신 링크를 보여준다)
  const pickedIds = [...new Set(Object.values(selections).flatMap((s) => s.picks.map((p) => p.id)))];
  const meetups = await postIdsByShowtime(pickedIds);

  return { date, dates, selections: resolved, meetups };
}

/** 서버 렌더용 — 한 요청 안에서 둘을 같이 읽는다 (서로를 안 기다린다) */
export async function scheduleDay(region: Region, requested?: string | null) {
  const [movies, picks] = await Promise.all([scheduleMovies(region, requested), schedulePicks(region, requested)]);
  return { ...movies, ...picks };
}

export type ScheduleDay = Awaited<ReturnType<typeof scheduleDay>>;
