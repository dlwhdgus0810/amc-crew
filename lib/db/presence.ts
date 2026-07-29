import { and, desc, isNotNull, gte } from 'drizzle-orm';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './index';
import { users } from './schema';
import { resolveDisplayName } from '../store';

/**
 * "지금 접속 중" — 서버리스라 연결을 붙들고 있을 수 없어서, 보고 있는 사람이
 * 주기적으로 신호를 보내고(app/presence-beat.tsx) 우리는 마지막 신호 시각만 적어 둔다.
 *
 * 일부러 users.lastSeen 한 칸을 덮어쓰기만 한다 — 이력 테이블을 만들면
 * 회원 활동 로그가 되어버리고, 그건 이 기능이 필요로 하는 것보다 훨씬 많은 정보다.
 */

/** 마지막 신호가 이 시간 안이면 접속 중으로 본다 (신호 주기 60초 + 여유) */
export const ONLINE_WINDOW_MINUTES = 3;

export interface OnlineUser {
  id: string;
  name: string;
  avatar: string | null;
  /** 마지막 신호로부터 지난 초 */
  secondsAgo: number;
}

/** 신호 한 번 — 없는 사용자면 아무 일도 일어나지 않는다 (세션은 있는데 행이 없는 경우) */
export async function touchPresence(userId: string): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ lastSeen: new Date() }).where(eq(users.id, userId));
}

/** 지금 접속 중인 사람들 (최근 신호순) */
export async function listOnline(): Promise<OnlineUser[]> {
  const db = await getDb();
  const since = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60_000);
  const rows = await db
    .select({
      id: users.id,
      kakaoName: users.kakaoName,
      nickname: users.nickname,
      avatar: users.avatar,
      lastSeen: users.lastSeen,
    })
    .from(users)
    .where(and(isNotNull(users.lastSeen), gte(users.lastSeen, since)))
    .orderBy(desc(users.lastSeen));

  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    name: resolveDisplayName(
      { kakaoName: r.kakaoName, ...(r.nickname ? { nickname: r.nickname } : {}), kakaoNameHistory: [] },
      r.kakaoName
    ),
    avatar: r.avatar,
    secondsAgo: Math.max(0, Math.round((now - new Date(r.lastSeen!).getTime()) / 1000)),
  }));
}

/** 회원 수 — "3 / 12명 접속 중"처럼 견줘 보여주려고 */
export async function totalUsers(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return row?.n ?? 0;
}
