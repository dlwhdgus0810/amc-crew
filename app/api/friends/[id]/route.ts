import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { removeFriendship, setPresenceVisible } from '@/lib/db/friends';

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
  const banned = await banGuard(user);
  if (banned) return banned;
  const { id } = await params;
  const was = await removeFriendship(user.id, id);
  if (!was) {
    return await errJson(E.friendNotFound, 404);
  }
  return NextResponse.json({ ok: true, was });
}

/**
 * 이 친구에게 내 접속 상태를 보여줄지 바꾼다.
 *
 * 내 쪽 방향만 바뀐다 — 내가 감춰도 상대가 나에게 보여주는 설정은 그대로다.
 * 상대에게는 알리지 않는다. 감췄다는 걸 알리면 감추는 의미가 없다.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body?.showPresence !== 'boolean') {
    return await errJson(E.badRequest, 400);
  }
  // 맺어진 친구가 아니면 바꿀 것도 없다 (요청 중인 사이는 서로의 접속을 보지 못한다)
  if (!(await setPresenceVisible(user.id, id, body.showPresence))) {
    return await errJson(E.friendNotFound, 404);
  }
  return NextResponse.json({ ok: true, showPresence: body.showPresence });
}
