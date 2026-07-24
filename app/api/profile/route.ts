import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { resolveDisplayName } from '@/lib/store';
import { dbGetUser, dbUpdateProfile, ensureUser } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

function todayLocal(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 프로필 부분 업데이트: 닉네임(빈 값이면 해제) / 생년월일 / 성별 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 });
  }

  const patch: { nickname?: string | null; birthday?: string; gender?: string } = {};

  if (body.nickname !== undefined) {
    if (typeof body.nickname !== 'string') {
      return NextResponse.json({ error: 'nickname이 올바르지 않습니다.' }, { status: 400 });
    }
    const nickname = body.nickname.trim();
    if (nickname.length > 20) {
      return NextResponse.json({ error: '닉네임은 20자 이하로 입력해주세요.' }, { status: 400 });
    }
    patch.nickname = nickname || null;
  }

  if (body.birthday !== undefined) {
    const birthday = typeof body.birthday === 'string' ? body.birthday : '';
    const [y, m, d] = birthday.split('-').map(Number);
    const parsed = new Date(y, (m ?? 1) - 1, d ?? 1);
    const isRealDate =
      /^\d{4}-\d{2}-\d{2}$/.test(birthday) &&
      parsed.getFullYear() === y &&
      parsed.getMonth() === m - 1 &&
      parsed.getDate() === d;
    if (!isRealDate || birthday < '1900-01-01' || birthday > todayLocal()) {
      return NextResponse.json({ error: '생년월일을 올바르게 입력해주세요.' }, { status: 400 });
    }
    patch.birthday = birthday;
  }

  if (body.gender !== undefined) {
    if (body.gender !== 'male' && body.gender !== 'female') {
      return NextResponse.json({ error: '성별을 선택해주세요.' }, { status: 400 });
    }
    patch.gender = body.gender;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 });
  }

  await ensureUser(user); // 프로필 row가 없으면 세션의 카카오 닉네임으로 생성
  const profile = await dbUpdateProfile(user.id, patch);
  const row = await dbGetUser(user.id);
  return NextResponse.json({
    ok: true,
    name: resolveDisplayName(profile, user.name),
    nickname: profile.nickname ?? null,
    kakaoName: profile.kakaoName || user.name,
    birthday: row?.birthday ?? null,
    gender: row?.gender ?? null,
  });
}
