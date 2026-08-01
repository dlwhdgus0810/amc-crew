import { and, desc, isNotNull, gte } from 'drizzle-orm';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './index';
import { users } from './schema';
import { resolveDisplayName } from '../store';
import { localStamp } from '../dates';

/**
 * 접속 현황 — 서버리스라 연결을 붙들고 있을 수 없어서, 앱을 보고 있는 사람이
 * 주기적으로 신호를 보낸다(app/presence-beat.tsx).
 *
 * 신호는 두 군데에 남는다.
 *  - users.lastSeen: 마지막 신호 시각 하나. "지금 접속 중" 판정에 쓴다.
 *  - presence_sessions: 신호가 이어지는 구간. 회원별 접속 시간·횟수를 보려고 남긴다.
 */

/** 마지막 신호가 이 시간 안이면 접속 중으로 본다 (신호 주기 60초 + 여유) */
export const ONLINE_WINDOW_MINUTES = 3;

/**
 * 신호가 이만큼 끊기면 "나갔다 다시 들어온 것"으로 보고 접속 구간을 새로 시작한다.
 * 접속 중 판정(3분)보다 넉넉해야 화면에서 사라졌다 돌아온 사람이 한 구간으로 이어진다.
 */
const SESSION_GAP_MINUTES = 5;

/**
 * 신호 한 번을 접속 구간으로 치는 최소 길이.
 * 잠깐 열었다 닫으면 신호가 한 번뿐이라 started_at == ended_at이 되는데,
 * 그걸 0분으로 세면 "열어본 적 없음"처럼 보인다.
 */
const MIN_SESSION_MINUTES = 1;

export interface OnlineUser {
  id: string;
  name: string;
  avatar: string | null;
  /** 마지막 신호로부터 지난 초 */
  secondsAgo: number;
}

/**
 * 신호 한 번.
 *
 * users.lastSeen을 갱신하고(= 지금 접속 중 판정용), 접속 구간도 함께 이어 붙인다.
 * 구간 갱신은 SQL 한 문장으로 처리한다 — neon-http에는 트랜잭션이 없어서,
 * "찾아보고 없으면 넣는다"를 두 번에 나눠 하면 신호가 겹칠 때 구간이 둘로 갈라진다.
 */
export async function touchPresence(userId: string): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ lastSeen: new Date() }).where(eq(users.id, userId));

  const newId = crypto.randomUUID();
  await db.execute(sql`
    WITH latest AS (
      SELECT id FROM presence_sessions
      WHERE user_id = ${userId}
        AND ended_at > now() - (${SESSION_GAP_MINUTES} * interval '1 minute')
      ORDER BY ended_at DESC
      LIMIT 1
    ), extended AS (
      UPDATE presence_sessions SET ended_at = now()
      WHERE id IN (SELECT id FROM latest)
      RETURNING id
    )
    INSERT INTO presence_sessions (id, user_id, started_at, ended_at)
    SELECT ${newId}::uuid, ${userId}, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM extended)
  `);
}

export interface PresenceStat {
  id: string;
  name: string;
  avatar: string | null;
  /** 최근 24시간 머문 시간(초) */
  daySeconds: number;
  /** 최근 7일 머문 시간(초) */
  weekSeconds: number;
  /** 최근 7일 접속 횟수 */
  visits: number;
  /** 마지막 신호로부터 지난 초 (한 번도 없었으면 null) */
  lastSeenSecondsAgo: number | null;
  /** 마지막 접속 시각, 앱 시간대의 'YYYY-MM-DDTHH:mm' (한 번도 없었으면 null) */
  lastSeenAt: string | null;
}

/**
 * 회원별 접속 기록 (최근 7일).
 *
 * 구간 길이는 최소 1분으로 올려 잡는다 — 신호 한 번짜리 방문이 0분으로 보이면 안 된다.
 * 접속한 적 없는 회원도 0으로 함께 내려준다 (명단에서 빠지면 "아직 안 왔다"를 알 수 없다).
 */
export async function listPresenceStats(): Promise<PresenceStat[]> {
  const db = await getDb();
  const min = sql`(${MIN_SESSION_MINUTES} * interval '1 minute')`;
  const rows = await db.execute(sql`
    SELECT
      u.id,
      u.kakao_name,
      u.nickname,
      u.avatar,
      u.last_seen,
      COALESCE(SUM(
        EXTRACT(EPOCH FROM GREATEST(s.ended_at - s.started_at, ${min}))
      ) FILTER (WHERE s.ended_at > now() - interval '24 hours'), 0) AS day_seconds,
      -- GREATEST는 NULL을 무시해서, 접속 기록이 없는 회원(LEFT JOIN의 빈 행)도
      -- 최소 길이만큼 세어버린다. 실제 구간이 있는 행만 더한다.
      COALESCE(SUM(
        EXTRACT(EPOCH FROM GREATEST(s.ended_at - s.started_at, ${min}))
      ) FILTER (WHERE s.id IS NOT NULL), 0) AS week_seconds,
      COUNT(s.id) AS visits
    FROM users u
    LEFT JOIN presence_sessions s
      ON s.user_id = u.id AND s.ended_at > now() - interval '7 days'
    GROUP BY u.id, u.kakao_name, u.nickname, u.avatar, u.last_seen
    ORDER BY week_seconds DESC, u.kakao_name ASC
  `);

  const now = Date.now();
  // drizzle의 execute 반환 형태가 드라이버마다 다르다 (neon-http는 { rows }, 배열인 경우도 있다)
  const list = (Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? [])) as Record<
    string,
    unknown
  >[];

  return list.map((r) => ({
    id: String(r.id),
    name: resolveDisplayName(
      {
        kakaoName: String(r.kakao_name),
        ...(r.nickname ? { nickname: String(r.nickname) } : {}),
        kakaoNameHistory: [],
      },
      String(r.kakao_name)
    ),
    avatar: (r.avatar as string) ?? null,
    daySeconds: Math.round(Number(r.day_seconds)),
    weekSeconds: Math.round(Number(r.week_seconds)),
    visits: Number(r.visits),
    lastSeenSecondsAgo: r.last_seen
      ? Math.max(0, Math.round((now - new Date(r.last_seen as string).getTime()) / 1000))
      : null,
    lastSeenAt: r.last_seen ? localStamp(new Date(r.last_seen as string)) : null,
  }));
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
