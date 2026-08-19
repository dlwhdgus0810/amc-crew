import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { buyTheme, walletOf } from '@/lib/db/shop';

export const dynamic = 'force-dynamic';

/**
 * 테마 사기.
 *
 * **아직 관리자만이다.** 화면(/shop)도 관리자만 열리는데, 거기 링크가 없다고 이 길이
 * 잠기는 것은 아니라서 여기서도 같은 자격을 본다 — 주소를 아는 사람이 눌러 볼 수 있는
 * 자리이고, 코인은 활동으로 버는 값이라 아무나 쓸 수 있으면 안 된다.
 *
 * 모두에게 열 때 이 줄과 페이지의 같은 줄, 두 곳을 같이 지우면 된다.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);

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
