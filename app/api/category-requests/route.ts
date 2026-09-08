import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getProfiles, localName } from '@/lib/store';
import { createCategoryRequest, listCategoryRequests } from '@/lib/db/category-requests';
import { isExistingCategoryName } from '@/lib/categories';
import { siteUrl } from '@/lib/site';
import { regionOfRequest } from '@/lib/region-server';

export const dynamic = 'force-dynamic';

const HEX = /^#[0-9a-f]{6}$/i;

/** 관리자는 전체를 본다. ?mine=1이면 관리자도 자기 제안만 (제안 페이지용). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;
  const mineOnly = req.nextUrl.searchParams.get('mine') === '1' || !isAdmin(user);
  const requests = await listCategoryRequests(mineOnly ? user.id : undefined);
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const color = typeof body?.color === 'string' ? body.color.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const featureRequest = typeof body?.featureRequest === 'string' ? body.featureRequest.trim() : '';

  if (!name || name.length > 20) {
    return await errJson(E.catName, 400);
  }
  if (!HEX.test(color)) {
    return await errJson(E.catColor, 400);
  }
  if (!description || description.length > 50) {
    return await errJson(E.catDesc, 400);
  }
  if (featureRequest.length > 1000) {
    return await errJson(E.catFeature, 400);
  }
  if (isExistingCategoryName(name)) {
    return await errJson(E.catExists, 409);
  }

  await ensureUser(user);
  const profile = (await getProfiles())[user.id];
  // 관리자 알림 문구에 실릴 이름 — 받는 관리자의 언어로 정해진다
  const byName = localName(profile, user.name);
  const id = await createCategoryRequest({
    userId: user.id,
    userName: byName,
    name,
    color,
    description,
    ...(featureRequest ? { featureRequest } : {}),
    origin: siteUrl(regionOfRequest(req), req.nextUrl.origin),
    region: regionOfRequest(req),
  });
  return NextResponse.json({ ok: true, id });
}
