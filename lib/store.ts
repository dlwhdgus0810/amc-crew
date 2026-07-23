import {Redis} from '@upstash/redis';
import {Selections, Showtime, UserSelection} from './types';
import {SEED_SCHEDULE} from './seed';

const SCHEDULE_KEY = 'odyssey:schedule';
const SELECTIONS_KEY = 'odyssey:selections';

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
  __odysseyMemory?: { schedule: Showtime[] | null; selections: Selections };
};
const memory = (globalMemory.__odysseyMemory ??= { schedule: null, selections: {} });

// 카카오 로그인 도입 이전의 이름 키 데이터(string[])는 걸러낸다
function normalize(raw: Record<string, unknown> | null | undefined): Selections {
  const out: Selections = {};
  for (const [userId, value] of Object.entries(raw ?? {})) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof (value as UserSelection).name === 'string' &&
      Array.isArray((value as UserSelection).showtimeIds)
    ) {
      out[userId] = value as UserSelection;
    }
  }
  return out;
}

export async function getSchedule(): Promise<Showtime[]> {
  if (hasRedis()) {
    const stored = await redis().get<Showtime[]>(SCHEDULE_KEY);
    if (stored && stored.length > 0) return stored;
    await redis().set(SCHEDULE_KEY, SEED_SCHEDULE);
    return SEED_SCHEDULE;
  }
  if (!memory.schedule) memory.schedule = [...SEED_SCHEDULE];
  return memory.schedule;
}

export async function setSchedule(schedule: Showtime[]): Promise<void> {
  if (hasRedis()) {
    await redis().set(SCHEDULE_KEY, schedule);
  } else {
    memory.schedule = schedule;
  }
}

export async function getSelections(): Promise<Selections> {
  if (hasRedis()) {
    return normalize(await redis().get<Record<string, unknown>>(SELECTIONS_KEY));
  }
  return memory.selections;
}

export async function setUserSelection(userId: string, name: string, showtimeIds: string[]): Promise<void> {
  if (hasRedis()) {
    // 간단한 read-modify-write. 소규모 친구 그룹 용도로 충분.
    const all = normalize(await redis().get<Record<string, unknown>>(SELECTIONS_KEY));
    all[userId] = { name, showtimeIds };
    await redis().set(SELECTIONS_KEY, all);
  } else {
    memory.selections[userId] = { name, showtimeIds };
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
