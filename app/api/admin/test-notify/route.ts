import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { inArray } from 'drizzle-orm';
import { adminIds, getSessionUser, isAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db/index';
import { pushSubscriptions, users } from '@/lib/db/schema';
import { notifyAdmins } from '@/lib/db/admin-notify';
import { siteUrl } from '@/lib/site';
import { pick } from '@/lib/i18n';
import { localStamp } from '@/lib/dates';
import { regionOfRequest } from '@/lib/region-server';
import type { Region } from '@/lib/region';

export const dynamic = 'force-dynamic';

const T = {
  message: {
    ko: '🔔 알림 테스트 ({time}) — 이게 보이면 이 경로는 살아 있어요.',
    en: '🔔 Notification test ({time}) — if you can see this, this channel works.',
    es: '🔔 Prueba de aviso ({time}): si lo ves, este canal funciona.',
  },
  button: { ko: '앱 열기', en: 'Open the app', es: 'Abrir la app' },
};

/** 그 지역 시각 HH:mm:ss — 여러 번 눌렀을 때 어느 것이 방금 것인지 구분하려고 넣는다 */
function stamp(region: Region): string {
  const s = Date.now() % 60_000;
  return `${localStamp(region, new Date()).slice(11)}:${String(Math.floor(s / 1000)).padStart(2, '0')}`;
}

/**
 * 관리자에게만 가는 테스트 알림.
 *
 * 인앱·카카오톡·앱 푸시 세 경로를 한 번에 태워, 어디가 막혔는지 실제 기기에서 확인하는 용도다.
 * 관리자 본인도 받아야 의미가 있으므로 exclude를 주지 않는다.
 */
export async function POST(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);

  const region = regionOfRequest(_req);
  const time = stamp(region);
  await notifyAdmins({
    message: (locale) => pick(locale, T.message, { time }),
    button: (locale) => pick(locale, T.button),
    linkUrl: `${siteUrl(region, _req.nextUrl.origin)}/notifications`,
    region,
    tag: 'test-notify',
  });

  // 무엇이 시도됐는지 돌려준다 — "보냈다"만 알려주는 테스트 버튼은 쓸모가 없다
  const db = await getDb();
  const ids = adminIds();
  const known = ids.length
    ? await db.select({ id: users.id }).from(users).where(inArray(users.id, ids))
    : [];
  const subs = known.length
    ? await db
        .select({ endpoint: pushSubscriptions.endpoint })
        .from(pushSubscriptions)
        .where(inArray(pushSubscriptions.userId, known.map((k) => k.id)))
    : [];

  return NextResponse.json({
    ok: true,
    time,
    // 로그인한 적 없는 ADMIN_KAKAO_ID는 users 행이 없어 알림을 받을 수 없다
    admins: known.length,
    configured: ids.length,
    pushDevices: subs.length,
  });
}
