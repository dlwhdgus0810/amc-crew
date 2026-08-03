import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser, IMPERSONATOR_COOKIE, isAdmin, verifySessionToken } from '@/lib/auth';
import { resolveDisplayName } from '@/lib/store';
import { dbGetUser } from '@/lib/db/users';
import { toState } from '@/lib/db/bans';

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
    ? { kakaoName: row.kakaoName, kakaoNameHistory: [] }
    : undefined;
  return NextResponse.json({
    user: { id: user.id, name: resolveDisplayName(profile, user.name) },
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
    /*
     * 정지 중이면 남은 기간. 화면을 덮는 안내(app/ban-screen.tsx)가 이 값으로 타이머를 돌린다.
     * 로그아웃 처리하지 않는 이유 — "로그인하세요"만 뜨면 왜 막혔는지 알 길이 없다.
     */
    ban: toState(row?.bannedUntil ?? null, row?.banReason ?? null),
    ...(realUser ? { viewingAs: { backTo: realUser.name } } : {}),
  });
}
