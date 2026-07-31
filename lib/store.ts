import {Redis} from '@upstash/redis';
import {DaySchedule, Profiles, Selections, Showtime, UserProfile, UserSelection} from './types';
import {seedDay} from './seed';
import {amcConfigured, fetchAmcDay, theatreId} from './amc';
import {dbGetProfiles, dbUpdateProfile} from './db/users';
import {findMovieMeta, TitleMeta, TMDB_IMG, tmdbEnabled} from './tmdb';

const SELECTIONS_KEY = 'odyssey:selections';
/** 하루치 상영표 캐시 — 극장이 바뀌면 키도 갈라진다 */
const dayKey = (date: string) => `amc:day:${theatreId()}:${date}`;
/** AMC를 매 요청마다 부르지 않도록 짧게 캐시한다 (초) */
const DAY_TTL = 30 * 60;
/**
 * 영화별 TMDB 정보 캐시. 상영표보다 훨씬 오래 둔다 —
 * 같은 영화가 날마다 걸리는데 그때마다 TMDB를 두 번씩 부를 이유가 없다.
 */
const titleKey = (name: string) => `tmdb:title:${name.toLowerCase()}`;
const TITLE_TTL = 7 * 24 * 60 * 60;
/** 찾았지만 결과가 없던 것도 기억한다 (없는 영화를 매번 다시 묻지 않도록) */
type CachedMeta = { meta: TitleMeta | null };

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
  __odysseyMemory?: {
    days: Record<string, DaySchedule>;
    selections: Selections;
    titles: Record<string, CachedMeta>;
  };
};
const memory = (globalMemory.__odysseyMemory ??= { days: {}, selections: {}, titles: {} });
// 예전 인스턴스가 titles 없이 만들어 두었을 수 있다
memory.titles ??= {};

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
/** 영화 한 편의 TMDB 정보 — 캐시를 먼저 보고, 없으면 조회해서 캐시에 넣는다 */
async function titleMetaFor(name: string): Promise<TitleMeta | null> {
  if (!tmdbEnabled()) return null;
  const key = titleKey(name);
  if (hasRedis()) {
    const cached = await redis().get<CachedMeta>(key);
    if (cached) return cached.meta;
  } else if (memory.titles[key]) {
    return memory.titles[key].meta;
  }

  const meta = await findMovieMeta(name);
  const box: CachedMeta = { meta };
  if (hasRedis()) {
    await redis().set(key, box, { ex: TITLE_TTL });
  } else {
    memory.titles[key] = box;
  }
  return meta;
}

/**
 * 상영표의 영화들에 TMDB 평점·감독·출연을 붙인다.
 * 16편을 순서대로 부르면 화면이 그만큼 늦어지므로 한꺼번에 보낸다.
 * 못 찾은 영화는 AMC 정보만으로 그대로 둔다 — 상영표가 비는 것보다 낫다.
 */
async function withTitleMeta(movies: DaySchedule['movies']): Promise<DaySchedule['movies']> {
  if (!tmdbEnabled() || movies.length === 0) return movies;
  const metas = await Promise.all(
    movies.map(async (m) => {
      try {
        return await titleMetaFor(m.movie.name);
      } catch (e) {
        console.error('[tmdb] 보강 실패:', m.movie.name, e instanceof Error ? e.message : e);
        return null;
      }
    })
  );
  return movies.map((m, i) => {
    const meta = metas[i];
    if (!meta) return m;
    return {
      ...m,
      movie: {
        ...m.movie,
        ...(meta.rating != null ? { score: meta.rating } : {}),
        ...(meta.director ? { director: meta.director } : {}),
        ...(meta.cast?.length ? { cast: meta.cast } : {}),
        // AMC 포스터가 없을 때만 TMDB 것으로 채운다 (AMC 쪽이 상영 중인 판본에 맞는다)
        ...(!m.movie.posterUrl && meta.posterPath
          ? {
              posterUrl: `${TMDB_IMG}/w342${meta.posterPath}`,
              posterLargeUrl: `${TMDB_IMG}/w780${meta.posterPath}`,
            }
          : {}),
      },
    };
  });
}

export async function getDaySchedule(date: string): Promise<DaySchedule> {
  // 키가 없거나 아직 활성화되지 않은 동안에는 예시 상영표로 화면을 볼 수 있게 한다.
  // 반드시 sample 플래그를 달아 화면에서 "예시"임을 밝힌다 (실제 상영표로 오해하면 안 된다).
  if (!amcConfigured()) return { ...seedDay(date), sample: true };

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
    // 키가 아직 승인 전이면 403이 온다 — 그동안은 예시 상영표로 대체하고 화면에 밝힌다
    console.error('[amc] 상영표 조회 실패 — 대체 상영표로 표시:', e instanceof Error ? e.message : e);
    return { ...seedDay(date), sample: true };
  }
  // 평점·감독·출연 붙이기. 여기서 실패해도 상영표는 그대로 나가야 하므로 try 밖에서 한다
  day = { ...day, movies: await withTitleMeta(day.movies) };
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
