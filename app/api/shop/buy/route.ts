import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { buyTheme, walletOf } from '@/lib/db/shop';
import { notifyAdmins } from '@/lib/db/admin-notify';
import { getProfiles, localName } from '@/lib/store';
import { CARD_THEMES, toCardTheme } from '@/lib/card-theme';
import { priceOf } from '@/lib/shop';
import { pick } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';

/** 관리자에게 가는 알림 문구 — 받는 관리자의 언어로 그려진다 */
const N = {
  bought: {
    ko: '🎨 {by}님이 「{theme}」을 샀어요 ({n} 달란트)',
    en: '🎨 {by} bought “{theme}” ({n} talents)',
    es: '🎨 {by} compró «{theme}» ({n} talentos)',
  },
  btn: { ko: '상점 보기', en: 'Open the shop', es: 'Abrir la tienda' },
};

export const dynamic = 'force-dynamic';

/**
 * 테마 사기.
 *
 * 달란트는 자기 활동에서 나온 값을 자기가 쓰는 것이라 로그인만 보면 된다. 무엇을 살 수
 * 있는지(THEME_PRICE)와 잔액이 되는지는 lib/db/shop.ts가 판정한다.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const banned = await banGuard(user);
  if (banned) return banned;

  const body = await req.json().catch(() => null);
  const theme = typeof body?.theme === 'string' ? body.theme : '';
  if (!theme) return await errJson(E.badRequest, 400);

  const res = await buyTheme(user.id, theme);
  if (!res.ok) {
    if (res.reason === 'short') return await errJson(E.shopShort, 400);
    if (res.reason === 'owned') return await errJson(E.shopOwned, 400);
    return await errJson(E.badRequest, 400);
  }
  /*
   * 관리자에게만 알린다.
   *
   * 산 사람에게는 화면이 이미 「샀어요」라고 말한다. 이 알림은 값을 정하는 사람이
   * 「팔리고 있나」를 아는 자리다 — 관리자 화면의 달란트 표를 매번 열어 보지 않아도
   * 되게 한다.
   *
   * 자기가 산 것은 자기에게 안 온다(exclude). 관리자도 테마를 사는데, 살 때마다
   * 자기 알림함에 자기가 산 것이 쌓이면 알림함이 못 쓰게 된다.
   *
   * 알림이 실패해도 산 것은 산 것이다 — notifyAdmins가 안에서 삼킨다.
   */
  const theme_ = toCardTheme(theme);
  const profile = (await getProfiles())[user.id];
  const by = localName(profile, user.name);
  await notifyAdmins({
    exclude: user.id,
    message: (locale) =>
      pick(locale, N.bought, {
        by: by(locale),
        theme: pick(locale, CARD_THEMES[theme_].label),
        n: String(priceOf(theme_) ?? 0),
      }),
    button: (locale) => pick(locale, N.btn),
    linkUrl: `${siteUrl(req.nextUrl.origin)}/shop`,
    tag: 'theme-buy',
  });

  return NextResponse.json({ ok: true, wallet: await walletOf(user.id) });
}
