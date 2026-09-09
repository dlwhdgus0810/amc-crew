import { and, desc, isNotNull, gte } from 'drizzle-orm';
import { eq, sql } from 'drizzle-orm';
import { getDb } from './index';
import { pushSubscriptions, users } from './schema';
import { nameOf } from '../store';
import { getLocale } from '../locale';
import { addDays, instantAt, localStamp } from '../dates';
import { isRegion, type Region } from '../region';

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

/**
 * 사람들이 실제로 앱을 보는 시간대 — 그 지역 시간으로 오전 7시부터 다음날 새벽 1시까지.
 *
 * 예전에는 「최근 24시간」이었는데, 그 창은 새벽 1~7시를 끼고 있어서 아무도 안 쓰는
 * 여섯 시간이 늘 섞여 들어왔다. 게다가 굴러가는 창이라 아침에 본 것과 저녁에 본 것이
 * 같은 하루를 가리키지 않는다. 하루의 경계를 자정이 아니라 새벽 1시에 두면
 * 밤늦게까지 논 것도 그날 것으로 묶인다.
 */
const ACTIVE_FROM = '07:00';
const ACTIVE_TO = '01:00';

/**
 * 지금이 속한 활동 시간대의 시작·끝.
 *
 * 새벽 1시부터 아침 7시 사이에는 열려 있는 창이 없다 — 그때는 방금 닫힌 창을 준다.
 * (그 시간에 표를 열어 놓고 숫자가 0으로 보이면 기록이 날아간 줄 안다)
 */
export function activeWindow(region: Region, now = new Date()): { start: Date; end: Date } {
  const stamp = localStamp(region, now);
  const day = stamp.slice(0, 10);
  const hour = Number(stamp.slice(11, 13));
  const base = hour < Number(ACTIVE_FROM.slice(0, 2)) ? addDays(day, -1) : day;
  return { start: instantAt(region, base, ACTIVE_FROM), end: instantAt(region, addDays(base, 1), ACTIVE_TO) };
}

export interface OnlineUser {
  id: string;
  name: string;
  avatar: string | null;
  /** 마지막 신호로부터 지난 초 */
  secondsAgo: number;
  /** 접속 표시를 꺼 둔 사람 — 친구들에게는 안 보이지만 이 표에는 그대로 나온다 */
  hidden: boolean;
  /** 마지막 신호가 온 지역 (구간 기록이 없으면 null) */
  region: Region | null;
}

/**
 * 신호 한 번.
 *
 * users.lastSeen을 갱신하고(= 지금 접속 중 판정용), 접속 구간도 함께 이어 붙인다.
 * 구간 갱신은 SQL 한 문장으로 처리한다 — neon-http에는 트랜잭션이 없어서,
 * "찾아보고 없으면 넣는다"를 두 번에 나눠 하면 신호가 겹칠 때 구간이 둘로 갈라진다.
 */
export async function touchPresence(userId: string, region: Region): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ lastSeen: new Date() }).where(eq(users.id, userId));

  const newId = crypto.randomUUID();
  await db.execute(sql`
    WITH latest AS (
      SELECT id FROM presence_sessions
      WHERE user_id = ${userId}
        AND region = ${region}
        AND ended_at > now() - (${SESSION_GAP_MINUTES} * interval '1 minute')
      ORDER BY ended_at DESC
      LIMIT 1
    ), extended AS (
      UPDATE presence_sessions SET ended_at = now()
      WHERE id IN (SELECT id FROM latest)
      RETURNING id
    )
    INSERT INTO presence_sessions (id, user_id, region, started_at, ended_at)
    SELECT ${newId}::uuid, ${userId}, ${region}, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM extended)
  `);
}

export interface PresenceStat {
  id: string;
  name: string;
  avatar: string | null;
  /** 이번 활동 시간대(오전 7시~새벽 1시)에 머문 시간(초) */
  activeSeconds: number;
  /** 최근 7일 머문 시간(초) */
  weekSeconds: number;
  /** 최근 7일 접속 횟수 — 표에서는 뺐지만 기록은 그대로 둔다 */
  visits: number;
  /** 마지막 신호로부터 지난 초 (한 번도 없었으면 null) */
  lastSeenSecondsAgo: number | null;
  /** 마지막 접속 시각, 앱 시간대의 'YYYY-MM-DDTHH:mm' (한 번도 없었으면 null) */
  lastSeenAt: string | null;
  /** 앱 푸시 알림을 켠 기기 수 (0이면 꺼짐) */
  pushDevices: number;
}

/**
 * 회원별 접속 기록 (최근 7일) — 이 지역 도메인에서 온 신호만.
 *
 * 구간 길이는 최소 1분으로 올려 잡는다 — 신호 한 번짜리 방문이 0분으로 보이면 안 된다.
 * 접속한 적 없는 회원도 0으로 함께 내려준다 (명단에서 빠지면 "아직 안 왔다"를 알 수 없다).
 *
 * 정렬은 화면에서 한다 — 열두 명짜리 표라 다시 물어보러 갈 일이 아니다.
 * 여기서는 보기 좋은 기본 순서(7일 많은 순)만 정해 준다.
 */
export async function listPresenceStats(region: Region): Promise<PresenceStat[]> {
  const locale = await getLocale();
  const db = await getDb();
  const min = sql`(${MIN_SESSION_MINUTES} * interval '1 minute')`;
  // 활동 시간대는 보는 관리자가 있는 호스트의 시계로 — 한 시간 어긋나는 것은 표의 정밀도 안이다
  const { start, end } = activeWindow(region);
  const from = sql`${start.toISOString()}::timestamptz`;
  const to = sql`${end.toISOString()}::timestamptz`;
  const rows = await db.execute(sql`
    SELECT
      u.id,
      u.kakao_name,
      u.name_en,
      u.nickname,
      u.avatar,
      u.last_seen,
      -- 창 밖으로 삐져나온 부분은 잘라 낸다. 새벽 1시를 넘겨 논 사람의 구간을
      -- 통째로 버리면 자정까지 논 시간까지 같이 사라진다.
      COALESCE(SUM(
        EXTRACT(EPOCH FROM GREATEST(LEAST(s.ended_at, ${to}) - GREATEST(s.started_at, ${from}), ${min}))
      ) FILTER (WHERE s.ended_at > ${from} AND s.started_at < ${to}), 0) AS active_seconds,
      -- GREATEST는 NULL을 무시해서, 접속 기록이 없는 회원(LEFT JOIN의 빈 행)도
      -- 최소 길이만큼 세어버린다. 실제 구간이 있는 행만 더한다.
      COALESCE(SUM(
        EXTRACT(EPOCH FROM GREATEST(s.ended_at - s.started_at, ${min}))
      ) FILTER (WHERE s.id IS NOT NULL), 0) AS week_seconds,
      COUNT(s.id) AS visits
    FROM users u
    LEFT JOIN presence_sessions s
      ON s.user_id = u.id AND s.region = ${region} AND s.ended_at > now() - interval '7 days'
    GROUP BY u.id, u.kakao_name, u.name_en, u.nickname, u.avatar, u.last_seen
    ORDER BY week_seconds DESC, u.kakao_name ASC
  `);

  /*
   * 푸시 구독은 따로 센다. 위 질의에 조인을 하나 더 붙이면 접속 구간이 기기 수만큼
   * 복제되어 머문 시간이 부풀려진다 (구독 2대면 7일 합계가 두 배가 된다).
   */
  const subRows = await db
    .select({ userId: pushSubscriptions.userId, n: sql<number>`count(*)::int` })
    .from(pushSubscriptions)
    .groupBy(pushSubscriptions.userId);
  const devices = new Map(subRows.map((r) => [r.userId, r.n]));

  const now = Date.now();
  // drizzle의 execute 반환 형태가 드라이버마다 다르다 (neon-http는 { rows }, 배열인 경우도 있다)
  const list = (Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? [])) as Record<
    string,
    unknown
  >[];

  return list.map((r) => ({
    id: String(r.id),
    name: nameOf(
      {
        kakaoName: String(r.kakao_name),
        ...(r.nickname ? { nickname: String(r.nickname) } : {}),
        ...(r.name_en ? { nameEn: String(r.name_en) } : {}),
      },
      String(r.kakao_name),
      locale
    ),
    avatar: (r.avatar as string) ?? null,
    activeSeconds: Math.round(Number(r.active_seconds)),
    weekSeconds: Math.round(Number(r.week_seconds)),
    visits: Number(r.visits),
    lastSeenSecondsAgo: r.last_seen
      ? Math.max(0, Math.round((now - new Date(r.last_seen as string).getTime()) / 1000))
      : null,
    lastSeenAt: r.last_seen ? localStamp(region, new Date(r.last_seen as string)) : null,
    pushDevices: devices.get(String(r.id)) ?? 0,
  }));
}

/**
 * 지금 접속 중인 사람들 (최근 신호순).
 *
 * 접속 표시를 꺼 둔 사람도 뺴지 않고 hidden으로 표시한다 — 이 표는 관리자가 보는
 * "실제로 누가 앱을 보고 있나"이고, 스위치를 껐다고 여기서까지 사라지면 스위치가
 * 켜졌는지 꺼졌는지 확인할 방법이 없어진다. 친구 화면에서 빼는 것은 friends.ts가 한다.
 */
export async function listOnline(): Promise<OnlineUser[]> {
  const locale = await getLocale();
  const db = await getDb();
  const since = new Date(Date.now() - ONLINE_WINDOW_MINUTES * 60_000);
  const rows = await db
    .select({
      id: users.id,
      kakaoName: users.kakaoName,
      nickname: users.nickname,
      nameEn: users.nameEn,
      avatar: users.avatar,
      lastSeen: users.lastSeen,
      showPresence: users.showPresence,
      // 표 이름을 글자로 쓴다 — ${users.id}는 한 표짜리 select 안에서 "id"로만 찍혀 서브쿼리의 id를 가리킨다
      region: sql<string | null>`(SELECT region FROM presence_sessions WHERE user_id = users.id ORDER BY ended_at DESC LIMIT 1)`,
    })
    .from(users)
    .where(and(isNotNull(users.lastSeen), gte(users.lastSeen, since)))
    .orderBy(desc(users.lastSeen));

  const now = Date.now();
  return rows.map((r) => ({
    id: r.id,
    name: nameOf(r, r.kakaoName, locale),
    avatar: r.avatar,
    secondsAgo: Math.max(0, Math.round((now - new Date(r.lastSeen!).getTime()) / 1000)),
    hidden: !r.showPresence,
    region: isRegion(r.region) ? r.region : null,
  }));
}

/** 회원 수 — "3 / 12명 접속 중"처럼 견줘 보여주려고 */
export async function totalUsers(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  return row?.n ?? 0;
}
