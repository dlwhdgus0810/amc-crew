import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from './index';
import { notifications, users } from './schema';
import { sendPush } from '../push';
import { Locale, Msg, pick, toLocale } from '../i18n';
import { NOTIF } from '../notif-kinds';
import { isRegion, type Region } from '../region';
import { appName, siteUrl } from '../site';

/**
 * 새 소식 알림.
 *
 * 소식은 파일(lib/changelog.ts)이라 "발행됐다"는 런타임 사건이 없다. 그래서 보내는
 * 시점은 관리자가 정한다 — 배포한다고 자동으로 카톡이 나가지는 않는다.
 */

const T = {
  message: { ko: '📣 새 소식: {title}', en: '📣 What’s new: {title}', es: '📣 Novedades: {title}' },
  button: { ko: '보러 가기', en: 'See what changed', es: 'Ver qué cambió' },
};

/** 이 사람이 새 소식 알림을 켰는지 */
export async function getNewsAlerts(userId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db.select({ on: users.newsAlerts }).from(users).where(eq(users.id, userId));
  return Boolean(row?.on);
}

export async function setNewsAlerts(userId: string, on: boolean): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ newsAlerts: on }).where(eq(users.id, userId));
}

export interface NewsSendResult {
  /** 실제로 보낸 사람 수 */
  sent: number;
  /** 이미 같은 소식을 받아 건너뛴 사람 수 */
  skipped: number;
}

/**
 * 켜 둔 사람들에게 소식 하나를 보낸다 (인앱 알림 + 카카오톡).
 *
 * 같은 문구를 이미 받은 사람은 건너뛴다 — 관리자가 버튼을 두 번 눌러도 두 번 가지 않는다.
 * 소식 제목이 곧 문구라, 발송 이력 테이블을 따로 두지 않고 알림 자체를 표식으로 쓴다.
 */
export async function sendNews(
  title: Msg,
  /** 앱 안 경로 (`/whats-new`) — 주소는 받는 사람의 동네 도메인으로 만든다 */
  path: string,
  at: string | undefined,
  /** 공개 주소를 못 정했을 때 쓸 요청 주소 */
  originFallback: string
): Promise<NewsSendResult> {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, locale: users.locale, homeRegion: users.homeRegion })
    .from(users)
    .where(eq(users.newsAlerts, true));
  if (rows.length === 0) return { sent: 0, skipped: 0 };

  /*
   * 수신자 언어별로 문구가, 동네별로 앱 이름과 주소가 달라서 (언어, 지역) 단위로 묶는다.
   * 소식 자체는 하나다 — 코드로 배포되는 것이라 지역을 안 가린다.
   */
  const groups = new Map<string, { locale: Locale; region: Region; ids: string[] }>();
  for (const r of rows) {
    const locale = toLocale(r.locale);
    const region: Region = isRegion(r.homeRegion) ? r.homeRegion : 'kansas';
    const key = `${locale}|${region}`;
    if (!groups.has(key)) groups.set(key, { locale, region, ids: [] });
    groups.get(key)!.ids.push(r.id);
  }

  let sent = 0;
  let skipped = 0;
  for (const { locale, region, ids } of groups.values()) {
    // 소식 자리로 바로 열리게 (whats-new의 각 항목이 at를 id로 갖는다)
    const linkUrl = `${siteUrl(region, originFallback)}${path}`;
    const url = at ? `${linkUrl}#${encodeURIComponent(at)}` : linkUrl;
    const message = pick(locale, T.message, { title: pick(locale, title) });
    const already = await db
      .select({ userId: notifications.userId })
      .from(notifications)
      .where(and(inArray(notifications.userId, ids), eq(notifications.message, message)));
    const done = new Set(already.map((a) => a.userId));
    const targets = ids.filter((id) => !done.has(id));
    skipped += ids.length - targets.length;
    if (targets.length === 0) continue;

    await db.insert(notifications).values(
      /*
       * kind로 「새 소식」임을 남긴다 — 알림을 눌렀을 때 그 소식 자리로 보내려면 필요하다.
       * 어느 소식인지는 message에 제목이 들어 있어 화면에서 찾는다 (at는 링크에만 쓴다).
       */
      targets.map((userId) => ({ id: crypto.randomUUID(), userId, postId: null, kind: NOTIF.news, message }))
    );
    await sendPush(targets, { title: appName(region), body: message, url, tag: 'whats-new' });
    sent += targets.length;
  }
  return { sent, skipped };
}
