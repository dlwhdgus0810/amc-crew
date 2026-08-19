import { NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { allWallets } from '@/lib/db/shop';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

/**
 * 누가 무엇을 샀고 코인이 얼마 남았는지 (관리자 전용).
 *
 * 값을 정하는 데 쓰는 화면이라 전체가 필요하다 — 「50코인이면 몇 명이나 살 수 있나」는
 * 상위 몇 명만 봐서는 알 수 없다.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);
  return NextResponse.json({ wallets: await allWallets(await getLocale()) });
}
