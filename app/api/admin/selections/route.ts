import { NextRequest, NextResponse } from 'next/server';
import { clearSelections, removeUser } from '@/lib/store';
import { getSessionUser, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * 관리자(ADMIN_KAKAO_ID에 등록된 카카오 계정) 전용.
 * DELETE            → 모든 선택 삭제
 * DELETE?userId=xxx → 특정 사용자의 선택만 삭제
 */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return NextResponse.json({ error: '관리자만 사용할 수 있어요.' }, { status: 403 });
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (userId) {
    await removeUser(userId);
    return NextResponse.json({ ok: true, cleared: userId });
  }

  await clearSelections();
  return NextResponse.json({ ok: true, cleared: 'all' });
}
