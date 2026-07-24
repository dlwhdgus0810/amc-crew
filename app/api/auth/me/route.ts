import { NextResponse } from 'next/server';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { resolveDisplayName } from '@/lib/store';
import { dbGetUser } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
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
    kakaoName: row?.kakaoName || user.name,
    birthday: row?.birthday ?? null,
    gender: row?.gender ?? null,
    needsOnboarding: !row?.birthday || !row?.gender,
    isAdmin: isAdmin(user),
  });
}
