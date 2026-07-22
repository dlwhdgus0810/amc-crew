import { Redis } from '@upstash/redis';
import { Showtime, Selections } from './types';
import { SEED_SCHEDULE } from './seed';

const SCHEDULE_KEY = 'odyssey:schedule';
const SELECTIONS_KEY = 'odyssey:selections';

// ── Upstash Redis가 설정되어 있으면 사용, 아니면 메모리 저장소 (로컬 개발용) ──

function hasRedis(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function redis(): Redis {
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

// 메모리 폴백 (로컬 개발 전용 — 서버리스 환경에서는 인스턴스 간 공유 안 됨)
const memory: { schedule: Showtime[] | null; selections: Selections } = {
  schedule: null,
  selections: {},
};

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
    return (await redis().get<Selections>(SELECTIONS_KEY)) ?? {};
  }
  return memory.selections;
}

export async function setUserSelection(name: string, showtimeIds: string[]): Promise<void> {
  if (hasRedis()) {
    // 간단한 read-modify-write. 소규모 친구 그룹 용도로 충분.
    const all = (await redis().get<Selections>(SELECTIONS_KEY)) ?? {};
    all[name] = showtimeIds;
    await redis().set(SELECTIONS_KEY, all);
  } else {
    memory.selections[name] = showtimeIds;
  }
}

export async function removeUser(name: string): Promise<void> {
  if (hasRedis()) {
    const all = (await redis().get<Selections>(SELECTIONS_KEY)) ?? {};
    delete all[name];
    await redis().set(SELECTIONS_KEY, all);
  } else {
    delete memory.selections[name];
  }
}
