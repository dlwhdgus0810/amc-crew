import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { resolveDisplayName, updateProfile } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** 앱 닉네임 설정. 빈 값이면 해제하고 카카오 닉네임으로 복귀. */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (typeof body?.nickname !== 'string') {
    return NextResponse.json({ error: 'nickname이 필요합니다.' }, { status: 400 });
  }
  const nickname = body.nickname.trim();
  if (nickname.length > 20) {
    return NextResponse.json({ error: '닉네임은 20자 이하로 입력해주세요.' }, { status: 400 });
  }

  const profile = await updateProfile(user.id, { nickname: nickname || null });
  return NextResponse.json({
    ok: true,
    name: resolveDisplayName(profile, user.name),
    nickname: profile.nickname ?? null,
    kakaoName: profile.kakaoName || user.name,
  });
}
