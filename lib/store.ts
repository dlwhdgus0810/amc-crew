import {Redis} from '@upstash/redis';
import {DaySchedule, Profiles, Selections, Showtime, UserProfile, UserSelection} from './types';
import {seedDay} from './seed';
import {amcConfigured, fetchAmcDay, theatreId} from './amc';
import {dbGetProfiles, dbUpdateProfile} from './db/users';

const SELECTIONS_KEY = 'odyssey:selections';
/** 하루치 상영표 캐시 — 극장이 바뀌면 키도 갈라진다 */
const dayKey = (date: string) => `amc:day:${theatreId()}:${date}`;
/** AMC를 매 요청마다 부르지 않도록 짧게 캐시한다 (초) */
const DAY_TTL = 30 * 60;

// ── Upstash Redis가 설정되어 있으면 사용, 아니면 메모리 저장소 (로컬 개발용) ──

// Vercel KV(마켓플레이스) 연동 시에는 KV_REST_API_*, 직접 Upstash 연동 시에는 UPSTASH_REDIS_REST_* 이름으로 들어온다
function redisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
}

function redisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
}

function hasRedis(): boolean {
  return Boolean(redisUrl() && redisToken());
}

function redis(): Redis {
  return new Redis({ url: redisUrl()!, token: redisToken()! });
}

// 메모리 폴백 (로컬 개발 전용 — 서버리스 환경에서는 인스턴스 간 공유 안 됨)
// dev 모드에서 라우트별 번들이 모듈을 각자 로드해도 저장소가 공유되도록 globalThis에 붙인다
const globalMemory = globalThis as typeof globalThis & {
  __odysseyMemory?: { days: Record<string, DaySchedule>; selections: Selections };
};
const memory = (globalMemory.__odysseyMemory ??= { days: {}, selections: {} });

// 오디세이 전용 시절의 데이터({ name, showtimeIds })는 영화 정보가 없어 렌더할 수 없으므로 걸러낸다
function normalize(raw: Record<string, unknown> | null | undefined): Selections {
  const out: Selections = {};
  for (const [userId, value] of Object.entries(raw ?? {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as UserSelection).name === 'string' &&
      Array.isArray((value as UserSelection).picks)
    ) {
      out[userId] = value as UserSelection;
    }
  }
  return out;
}

/**
 * 하루치 상영표. AMC 키가 있으면 API에서 가져와 짧게 캐시하고, 없으면 로컬 시드로 동작한다.
 * AMC 호출이 실패하면 화면 전체가 죽지 않도록 빈 상영표를 돌려준다 (호출부에서 안내).
 */
export async function getDaySchedule(date: string): Promise<DaySchedule> {
  if (!amcConfigured()) return seedDay(date);

  if (hasRedis()) {
    const cached = await redis().get<DaySchedule>(dayKey(date));
    if (cached) return cached;
  } else if (memory.days[date]) {
    return memory.days[date];
  }

  let day: DaySchedule;
  try {
    day = await fetchAmcDay(date);
  } catch (e) {
    // 개발 중에는 키가 없거나 막혀 있어도 화면을 볼 수 있어야 한다.
    // 프로덕션에서는 가짜 상영표를 보여주지 않고 그대로 실패시킨다.
    if (process.env.NODE_ENV === 'production') throw e;
    console.error('[amc] 상영표 조회 실패 — 개발용 시드로 대체:', e instanceof Error ? e.message : e);
    return seedDay(date);
  }
  if (hasRedis()) {
    await redis().set(dayKey(date), day, { ex: DAY_TTL });
  } else {
    memory.days[date] = day;
  }
  return day;
}

/** 캐시를 비운다 (관리자가 강제로 새로고침할 때) */
export async function clearDayCache(dates: string[]): Promise<void> {
  if (hasRedis()) {
    await Promise.all(dates.map((d) => redis().del(dayKey(d))));
  } else {
    for (const d of dates) delete memory.days[d];
  }
}

/** 해당 날짜에 실제로 존재하는 회차만 남긴다 (저장 전 검증용) */
export async function validPicks(picks: Showtime[]): Promise<Showtime[]> {
  const byDate = new Map<string, Showtime[]>();
  for (const p of picks) {
    if (!byDate.has(p.date)) byDate.set(p.date, []);
    byDate.get(p.date)!.push(p);
  }
  const out: Showtime[] = [];
  for (const [date, list] of byDate) {
    const day = await getDaySchedule(date).catch(() => null);
    if (!day) continue;
    const ids = new Set(day.movies.flatMap((m) => m.showtimes.map((s) => s.id)));
    out.push(...list.filter((p) => ids.has(p.id)));
  }
  return out;
}

export async function getSelections(): Promise<Selections> {
  if (hasRedis()) {
    return normalize(await redis().get<Record<string, unknown>>(SELECTIONS_KEY));
  }
  return memory.selections;
}

export async function setUserSelection(userId: string, name: string, picks: Showtime[]): Promise<void> {
  if (hasRedis()) {
    // 간단한 read-modify-write. 소규모 친구 그룹 용도로 충분.
    const all = normalize(await redis().get<Record<string, unknown>>(SELECTIONS_KEY));
    all[userId] = { name, picks };
    await redis().set(SELECTIONS_KEY, all);
  } else {
    memory.selections[userId] = { name, picks };
  }
}

// ── 프로필(닉네임)은 Postgres users 테이블에 저장 (lib/db/users.ts에 위임) ──

export async function getProfiles(): Promise<Profiles> {
  return dbGetProfiles();
}

export async function updateProfile(
  userId: string,
  patch: { kakaoName?: string; nickname?: string | null }
): Promise<UserProfile> {
  return dbUpdateProfile(userId, patch);
}

/** 표시 이름 해석: 앱 닉네임 → 카카오 닉네임 → 저장 시점 스냅샷 */
export function resolveDisplayName(profile: UserProfile | undefined, fallback: string): string {
  const nickname = profile?.nickname?.trim();
  if (nickname) return nickname;
  if (profile?.kakaoName) return profile.kakaoName;
  return fallback;
}

export async function clearSelections(): Promise<void> {
  if (hasRedis()) {
    await redis().set(SELECTIONS_KEY, {});
  } else {
    memory.selections = {};
  }
}

export async function removeUser(userId: string): Promise<void> {
  if (hasRedis()) {
    const all = normalize(await redis().get<Record<string, unknown>>(SELECTIONS_KEY));
    delete all[userId];
    await redis().set(SELECTIONS_KEY, all);
  } else {
    delete memory.selections[userId];
  }
}
