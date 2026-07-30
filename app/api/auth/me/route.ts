import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser, IMPERSONATOR_COOKIE, isAdmin, verifySessionToken } from '@/lib/auth';
import { resolveDisplayName } from '@/lib/store';
import { dbGetUser } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  // 관리자가 테스트 계정으로 보는 중이면 원래 세션이 쿠키에 남아 있다
  const realUser = verifySessionToken((await cookies()).get(IMPERSONATOR_COOKIE)?.value);
  if (!user) {
    return NextResponse.json({ user: null, isAdmin: false, needsOnboarding: false });
  }
  const row = await dbGetUser(user.id);
  const profile = row
    ? { kakaoName: row.kakaoName, ...(row.nickname ? { nickname: row.nickname } : {}), kakaoNameHistory: [] }
    : undefined;
  return NextResponse.json({
    user: { id: user.id, name: resolveDisplayName(profile, user.name) },
    nickname: row?.nickname ?? null,
    avatar: row?.avatar ?? null,
    venmo: row?.venmo ?? null,
    zelle: row?.zelle ?? null,
    kakaoName: row?.kakaoName || user.name,
    birthday: row?.birthday ?? null,
    gender: row?.gender ?? null,
    needsOnboarding: !row?.birthday || !row?.gender,
    // 카톡 알림 동의: true=동의, false=미동의, null=미확인 (외부 호출 없이 DB 값만 — nav가 전 페이지에서 호출하는 경로)
    kakaoTalkMessage: row?.kakaoTalkMessage ?? null,
    locale: row?.locale ?? null,
    isAdmin: isAdmin(user),
    ...(realUser ? { viewingAs: { backTo: realUser.name } } : {}),
  });
}
