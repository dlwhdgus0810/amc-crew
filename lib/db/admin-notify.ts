import { inArray } from 'drizzle-orm';
import { getDb } from './index';
import { notifications, users } from './schema';
import { sendPush } from '../push';
import { adminIds } from '../auth';
import { Locale, toLocale } from '../i18n';
import type { Region } from '../region';
import { appName } from '../site';

/**
 * 관리자에게 인앱 알림 + 카카오톡 메모를 보낸다.
 * 아직 한 번도 로그인한 적 없는 ADMIN_KAKAO_ID는 users 행이 없어 FK 위반이 나므로 걸러낸다.
 * 알림 실패가 본 작업(가입·제안 등)을 막으면 안 되므로 여기서 삼킨다.
 */
export async function notifyAdmins(opts: {
  /** 본인이 관리자일 때 자기 자신에게 보내지 않기 위한 제외 대상 */
  exclude?: string;
  message: (locale: Locale) => string;
  button: (locale: Locale) => string;
  linkUrl: string;
  /** 일이 난 지역 — 「어느 동네 소식인가」가 제목에 먼저 보인다 (관리자는 양쪽을 다 본다) */
  region: Region;
  /** 로그 태그 */
  tag: string;
}): Promise<void> {
  const candidates = adminIds().filter((adminId) => adminId !== opts.exclude);
  if (candidates.length === 0) return;
  const db = await getDb();
  try {
    // 관리자가 여러 명이면 각자의 언어로 (보통 1명이라 순차 처리로 충분)
    const rows = await db
      .select({ id: users.id, locale: users.locale })
      .from(users)
      .where(inArray(users.id, candidates));
    for (const r of rows) {
      const locale = toLocale(r.locale);
      const message = opts.message(locale);
      await db.insert(notifications).values({ id: crypto.randomUUID(), userId: r.id, postId: null, message });
      await sendPush([r.id], { title: appName(opts.region), body: message, url: opts.linkUrl });
    }
  } catch (e) {
    console.error(`[${opts.tag}] admin notify failed:`, e);
  }
}
