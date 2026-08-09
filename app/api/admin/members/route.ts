import { NextResponse } from 'next/server';
import { asc } from 'drizzle-orm';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db/index';
import { users } from '@/lib/db/schema';
import { nameOf } from '@/lib/store';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

/**
 * 회원 전체 명단 (관리자 전용).
 *
 * 모임 명단을 고칠 때 친구가 아닌 사람도 넣어야 해서 필요하다.
 * 이름은 실명으로 준다 — 어느 모임에 넣을지 고르는 자리라 모임의 닉네임 규칙과 무관하고,
 * 관리자가 누가 누군지 알아야 하는 화면이다.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }
  const locale = await getLocale();
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, kakaoName: users.kakaoName, nameEn: users.nameEn, avatar: users.avatar })
    .from(users)
    .orderBy(asc(users.kakaoName));
  return NextResponse.json({
    members: rows.map((r) => ({
      id: r.id,
      name: nameOf(r, r.kakaoName, locale, true),
      avatar: r.avatar,
    })),
  });
}
