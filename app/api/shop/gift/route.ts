import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { giftTheme, walletOf } from '@/lib/db/shop';
import { notifyAdmins } from '@/lib/db/admin-notify';
import { insertInAppNotice } from '@/lib/db/posts';
import { getProfiles, localName, nameOf, UNKNOWN_NAME } from '@/lib/store';
import { CARD_THEMES, toCardTheme } from '@/lib/card-theme';
import { priceOf } from '@/lib/shop';
import { pick } from '@/lib/i18n';
import { NOTIF } from '@/lib/notif-kinds';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** 받는 사람에게, 그리고 관리자에게 */
const N = {
  got: {
    ko: '🎁 {by}님이 「{theme}」을 선물했어요. 프로필의 「카드 테마」에서 골라 쓰세요.',
    en: '🎁 {by} gifted you “{theme}” — pick it under “Card theme” in your profile.',
    es: '🎁 {by} te regaló «{theme}»: elígelo en «Tema de tarjetas» de tu perfil.',
  },
  admin: {
    ko: '🎁 {by}님이 {to}님에게 「{theme}」을 선물했어요 ({n} 달란트)',
    en: '🎁 {by} gifted “{theme}” to {to} ({n} talents)',
    es: '🎁 {by} regaló «{theme}» a {to} ({n} talentos)',
  },
  btnShop: { ko: '상점 보기', en: 'Open the shop', es: 'Abrir la tienda' },
};

/**
 * 친구에게 테마 선물하기.
 *
 * 값은 보내는 사람 지갑에서 빠지고 테마는 받는 사람 것이 된다. 누구에게 보낼 수
 * 있는지(친구인지)와 잔액이 되는지는 lib/db/shop.ts의 giftTheme이 판정한다 —
 * 화면이 친구만 보여 주지만 그건 화면일 뿐이라 서버가 다시 본다.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const banned = await banGuard(user);
  if (banned) return banned;

  const body = await req.json().catch(() => null);
  const theme = typeof body?.theme === 'string' ? body.theme : '';
  const to = typeof body?.to === 'string' ? body.to : '';
  if (!theme || !to) return await errJson(E.badRequest, 400);

  const res = await giftTheme(user.id, to, theme);
  if (!res.ok) {
    if (res.reason === 'self') return await errJson(E.giftSelf, 400);
    if (res.reason === 'not-friend') return await errJson(E.giftNotFriend, 403);
    if (res.reason === 'owned') return await errJson(E.giftOwned, 400);
    if (res.reason === 'short') return await errJson(E.shopShort, 400);
    return await errJson(E.badRequest, 400);
  }

  const key = toCardTheme(theme);
  const profiles = await getProfiles();
  const by = localName(profiles[user.id], user.name);
  const origin = siteUrl(req.nextUrl.origin);
  const label = (locale: Parameters<typeof pick>[0]) =>
    pick(locale, N.got, { by: by(locale), theme: pick(locale, CARD_THEMES[key].label) });

  /*
   * 받은 사람에게. 이 알림이 없으면 선물이 온 것을 알 길이 없다 — 상점을 다시 열어
   * 보기 전까지는 화면 어디에도 안 나온다.
   *
   * 인앱 한 줄만이다. 친구 요청과 같은 자리다(lib/db/friends.ts) — 사람이 사람에게
   * 건네는 일은 폰을 울리지 않고 앱을 열 때 보이게 한다. insertInAppNotice가 받는
   * 사람의 언어로 문구를 만든다.
   */
  await insertInAppNotice([to], null, NOTIF.gift, label);

  /* 관리자에게 — 산 것과 같은 자리다 (app/api/shop/buy/route.ts) */
  await notifyAdmins({
    exclude: user.id,
    message: (locale) =>
      pick(locale, N.admin, {
        by: by(locale),
        to: nameOf(profiles[to], UNKNOWN_NAME, locale),
        theme: pick(locale, CARD_THEMES[key].label),
        n: String(priceOf(key) ?? 0),
      }),
    button: (locale) => pick(locale, N.btnShop),
    linkUrl: `${origin}/shop`,
    tag: 'theme-gift',
  });

  return NextResponse.json({ ok: true, wallet: await walletOf(user.id) });
}
