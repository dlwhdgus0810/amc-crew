import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { users } from './schema';
import { adminIds } from '../auth';
import { dbGetUser } from './users';
import { insertInAppNotice } from './posts';
import { sendPush } from '../push';
import { NOTIF } from '../notif-kinds';
import { Locale, pick, toLocale } from '../i18n';
import { regionOfRow } from '../region';
import { appName, siteUrl } from '../site';

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
export const BAN_DURATIONS = [5, 60, 60 * 6, 60 * 24, 60 * 24 * 3, 60 * 24 * 7, 60 * 24 * 30] as const;

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

const N = {
  banned: { ko: '⛔ {dur} 동안 앱을 쓸 수 없어요', en: '⛔ You can’t use the app for {dur}', es: '⛔ No puedes usar la app durante {dur}' },
  withReason: { ko: '⛔ {dur} 동안 앱을 쓸 수 없어요 — {reason}', en: '⛔ You can’t use the app for {dur} — {reason}', es: '⛔ No puedes usar la app durante {dur} — {reason}' },
  lifted: { ko: '✅ 정지가 풀렸어요. 다시 쓸 수 있어요!', en: '✅ Your suspension is over — welcome back!', es: '✅ Tu suspensión terminó. ¡Bienvenido de vuelta!' },
  min: { ko: '{n}분', en: '{n} minutes', es: '{n} minutos' },
  hour: { ko: '{n}시간', en: '{n} hours', es: '{n} horas' },
  day: { ko: '{n}일', en: '{n} days', es: '{n} días' },
  // 영어만 단수형이 따로 필요하다 ("for 1 hours"는 눈에 걸린다)
  hourOne: { ko: '{n}시간', en: 'an hour', es: 'una hora' },
  dayOne: { ko: '{n}일', en: 'a day', es: 'un día' },
};

function durLabel(minutes: number, locale: Locale): string {
  if (minutes < 60) return pick(locale, N.min, { n: minutes });
  if (minutes < 60 * 24) {
    const h = minutes / 60;
    return pick(locale, h === 1 ? N.hourOne : N.hour, { n: h });
  }
  const d = minutes / (60 * 24);
  return pick(locale, d === 1 ? N.dayOne : N.day, { n: d });
}

/**
 * 정지됐다(또는 풀렸다)고 본인에게 알린다 — 인앱 한 줄 + 폰 푸시.
 *
 * 앱을 열어 두고 있었다면 화면이 곧 정지 안내로 바뀌지만, 대개는 앱을 닫아 둔 상태다.
 * 그때 아무 소식이 없으면 다음에 열어 보고서야 알게 되고, 그사이 모임 약속이 어그러진다.
 *
 * 카톡으로는 보내지 않는다. "나와의 채팅"에 남는 기록이라 지워지지 않는데,
 * 몇 분짜리 정지까지 그렇게 남길 일은 아니다.
 */
export async function notifyBan(userId: string, minutes: number, reason: string, originFallback: string): Promise<void> {
  const row = await dbGetUser(userId);
  const locale = toLocale(row?.locale ?? null);
  // 사람에게 가는 알림이라 그 사람의 동네 앱 이름·주소로
  const region = regionOfRow(row?.homeRegion ?? 'kansas');
  const text =
    minutes <= 0
      ? pick(locale, N.lifted)
      : reason.trim()
        ? pick(locale, N.withReason, { dur: durLabel(minutes, locale), reason: reason.trim() })
        : pick(locale, N.banned, { dur: durLabel(minutes, locale) });

  // 인앱 줄을 먼저 넣는다 — 푸시가 아이콘 뱃지 숫자를 이 표에서 읽어 간다
  await insertInAppNotice([userId], null, NOTIF.ban, () => text);
  await sendPush([userId], { title: appName(region), body: text, url: `${siteUrl(region, originFallback)}/`, tag: 'ban' });
}

export interface BannedUser {
  id: string;
  name: string;
  avatar: string | null;
  until: string;
  secondsLeft: number;
  reason: string | null;
}
