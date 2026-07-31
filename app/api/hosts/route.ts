import { NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { hostRanking } from '@/lib/db/hosting';

export const dynamic = 'force-dynamic';

/**
 * 종합 주최 랭킹 — 로그인한 사람만.
 * 이름과 "누가 모임을 열었는지"가 통째로 담긴 목록이라, 모임 카드에서 주최자를
 * 가려 놓고 여기서 내보내면 가린 의미가 없다.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  return NextResponse.json({ hosts: await hostRanking() });
}
