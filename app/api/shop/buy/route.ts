import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { buyTheme, walletOf } from '@/lib/db/shop';

export const dynamic = 'force-dynamic';

/**
 * 테마 사기.
 *
 * 코인은 자기 활동에서 나온 값을 자기가 쓰는 것이라 로그인만 보면 된다. 무엇을 살 수
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
  return NextResponse.json({ ok: true, wallet: await walletOf(user.id) });
}
