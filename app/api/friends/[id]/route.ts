import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { removeFriendship } from '@/lib/db/friends';

export const dynamic = 'force-dynamic';

/**
 * 거절 · 요청 취소 · 친구 끊기 — 셋 다 같은 동작이라 라우트도 하나다.
 * 어느 쪽이든 상대에게는 알리지 않는다. "거절당했어요"는 굳이 전할 소식이 아니다.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const { id } = await params;
  const was = await removeFriendship(user.id, id);
  if (!was) {
    return await errJson(E.friendNotFound, 404);
  }
  return NextResponse.json({ ok: true, was });
}
