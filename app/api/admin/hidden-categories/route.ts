import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { POST_CATEGORY_SLUGS } from '@/lib/categories';
import { hiddenSlugs, setHiddenSlugs } from '@/lib/db/hidden';
import { regionOfRequest } from '@/lib/region-server';

export const dynamic = 'force-dynamic';

/** 목록에서 내려 둔 카테고리 (관리자 전용) — 지금 보고 있는 지역 것 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);
  return NextResponse.json({ hidden: await hiddenSlugs(regionOfRequest(req)) });
}

/** 통째로 맞바꾼다 — 화면이 켜고 끈 결과를 그대로 보낸다 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);

  const body = await req.json().catch(() => null);
  const asked = Array.isArray(body?.hidden) ? body.hidden : null;
  // 있는 카테고리만 받는다 — 없는 slug가 쌓이면 나중에 왜 안 지워지나를 찾게 된다
  if (!asked || asked.some((s: unknown) => typeof s !== 'string' || !POST_CATEGORY_SLUGS.includes(s))) {
    return await errJson(E.badRequest, 400);
  }
  await setHiddenSlugs(regionOfRequest(req), asked);
  return NextResponse.json({ ok: true, hidden: asked });
}
