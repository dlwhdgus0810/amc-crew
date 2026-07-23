import { NextResponse } from 'next/server';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getProfiles, resolveDisplayName } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null, isAdmin: false });
  }
  const profile = (await getProfiles())[user.id];
  return NextResponse.json({
    user: { id: user.id, name: resolveDisplayName(profile, user.name) },
    nickname: profile?.nickname ?? null,
    kakaoName: profile?.kakaoName || user.name,
    isAdmin: isAdmin(user),
  });
}
