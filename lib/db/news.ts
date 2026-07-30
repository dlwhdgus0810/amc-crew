import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from './index';
import { notifications, users } from './schema';
import { sendKakaoMemos } from '../kakao';
import { sendPush } from '../push';
import { Locale, Msg, pick, toLocale } from '../i18n';

/**
 * 새 소식 알림.
 *
 * 소식은 파일(lib/changelog.ts)이라 "발행됐다"는 런타임 사건이 없다. 그래서 보내는
 * 시점은 관리자가 정한다 — 배포한다고 자동으로 카톡이 나가지는 않는다.
 */

const T = {
  message: { ko: '📣 새 소식: {title}', en: '📣 What’s new: {title}' },
  button: { ko: '보러 가기', en: 'See what changed' },
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
export async function sendNews(title: Msg, linkUrl: string): Promise<NewsSendResult> {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, locale: users.locale })
    .from(users)
    .where(eq(users.newsAlerts, true));
  if (rows.length === 0) return { sent: 0, skipped: 0 };

  // 수신자 언어별로 문구가 달라서, 언어 단위로 묶어 처리한다
  const byLocale = new Map<Locale, string[]>();
  for (const r of rows) {
    const locale = toLocale(r.locale);
    if (!byLocale.has(locale)) byLocale.set(locale, []);
    byLocale.get(locale)!.push(r.id);
  }

  let sent = 0;
  let skipped = 0;
  for (const [locale, ids] of byLocale) {
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
      targets.map((userId) => ({ id: crypto.randomUUID(), userId, postId: null, message }))
    );
    await sendKakaoMemos(targets, message, linkUrl, pick(locale, T.button));
    await sendPush(targets, { title: 'Kansas Korean', body: message, url: linkUrl, tag: 'whats-new' });
    sent += targets.length;
  }
  return { sent, skipped };
}
