import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getFavorites, setFavorite } from '@/lib/db/posts';
import { getCategory } from '@/lib/categories';

export const dynamic = 'force-dynamic';

/** 즐겨찾기 — 홈에 먼저 띄울 카테고리 (알림을 받는 구독과는 별개) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ favorites: [] });
  }
  return NextResponse.json({ favorites: await getFavorites(user.id) });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const body = await req.json().catch(() => null);
  const category = typeof body?.category === 'string' ? body.category : '';
  const favorite = Boolean(body?.favorite);
  // 즐겨찾기는 영화(AMC)를 포함한 모든 카테고리에 걸 수 있다
  if (!getCategory(category)) {
    return await errJson(E.badCategory, 400);
  }
  await ensureUser(user);
  await setFavorite(user.id, category, favorite);
  return NextResponse.json({ ok: true, favorites: await getFavorites(user.id) });
}
