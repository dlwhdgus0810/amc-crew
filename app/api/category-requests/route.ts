import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getProfiles, resolveDisplayName } from '@/lib/store';
import { createCategoryRequest, listCategoryRequests } from '@/lib/db/category-requests';
import { CATEGORIES } from '@/lib/categories';

export const dynamic = 'force-dynamic';

const HEX = /^#[0-9a-f]{6}$/i;

/** 관리자는 전체를 본다. ?mine=1이면 관리자도 자기 제안만 (제안 페이지용). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  const mineOnly = req.nextUrl.searchParams.get('mine') === '1' || !isAdmin(user);
  const requests = await listCategoryRequests(mineOnly ? user.id : undefined);
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const color = typeof body?.color === 'string' ? body.color.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const featureRequest = typeof body?.featureRequest === 'string' ? body.featureRequest.trim() : '';

  if (!name || name.length > 20) {
    return NextResponse.json({ error: '카테고리 이름은 1~20자로 입력해주세요.' }, { status: 400 });
  }
  if (!HEX.test(color)) {
    return NextResponse.json({ error: '색상을 골라주세요.' }, { status: 400 });
  }
  if (!description || description.length > 50) {
    return NextResponse.json({ error: '부제목은 1~50자로 입력해주세요.' }, { status: 400 });
  }
  if (featureRequest.length > 1000) {
    return NextResponse.json({ error: '원하는 기능은 1000자 이하로 입력해주세요.' }, { status: 400 });
  }
  if (CATEGORIES.some((c) => c.name === name || c.slug === name)) {
    return NextResponse.json({ error: '이미 있는 카테고리예요.' }, { status: 409 });
  }

  await ensureUser(user);
  const profile = (await getProfiles())[user.id];
  const id = await createCategoryRequest({
    userId: user.id,
    userName: resolveDisplayName(profile, user.name),
    name,
    color,
    description,
    ...(featureRequest ? { featureRequest } : {}),
    origin: req.nextUrl.origin,
  });
  return NextResponse.json({ ok: true, id });
}
