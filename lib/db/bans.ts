import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { users } from './schema';
import { adminIds } from '../auth';

/**
 * 이용 정지.
 *
 * 상태는 users.bannedUntil 하나다 — "언제까지"만 적고, 지나간 시각이면 저절로 풀린다.
 * 풀어주는 작업(크론이든 사람이든)이 따로 없어야 "풀렸는데 안 풀린" 상태가 생기지 않는다.
 */

export interface BanState {
  /** 정지 종료 시각 (ISO) */
  until: string;
  /** 남은 초 — 화면 타이머의 출발점 */
  secondsLeft: number;
  reason: string | null;
}

/** 관리자가 고를 수 있는 기간 (분) — 화면 버튼과 서버 검증이 같은 목록을 쓴다 */
export const BAN_DURATIONS = [60, 60 * 6, 60 * 24, 60 * 24 * 3, 60 * 24 * 7, 60 * 24 * 30] as const;

/** 정지 중이면 남은 기간, 아니면 null */
export async function banStateOf(userId: string): Promise<BanState | null> {
  const db = await getDb();
  const [row] = await db
    .select({ until: users.bannedUntil, reason: users.banReason })
    .from(users)
    .where(eq(users.id, userId));
  return toState(row?.until ?? null, row?.reason ?? null);
}

/** 행을 이미 들고 있을 때 — 조회를 한 번 더 하지 않으려고 */
export function toState(until: Date | null, reason: string | null): BanState | null {
  if (!until) return null;
  const left = until.getTime() - Date.now();
  if (left <= 0) return null; // 기간이 지났으면 정지가 아니다
  return { until: until.toISOString(), secondsLeft: Math.ceil(left / 1000), reason: reason ?? null };
}

/**
 * 정지 걸기. minutes가 0 이하면 해제한다.
 *
 * 관리자는 정지할 수 없다 — 관리자끼리 서로 막아 버리면 풀어 줄 사람이 없어진다.
 */
export async function setBan(userId: string, minutes: number, reason: string): Promise<BanState | null> {
  if (adminIds().includes(userId)) throw new Error('admin');
  const db = await getDb();
  if (minutes <= 0) {
    await db.update(users).set({ bannedUntil: null, banReason: null }).where(eq(users.id, userId));
    return null;
  }
  const until = new Date(Date.now() + minutes * 60_000);
  await db
    .update(users)
    .set({ bannedUntil: until, banReason: reason.trim() || null })
    .where(eq(users.id, userId));
  return toState(until, reason.trim() || null);
}

export interface BannedUser {
  id: string;
  name: string;
  avatar: string | null;
  until: string;
  secondsLeft: number;
  reason: string | null;
}
