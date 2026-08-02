import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { MEETUP_SCOPES, removeFriendship, setMeetupScope, setPresenceVisible, type MeetupScope } from '@/lib/db/friends';

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
 * 이 친구에게 보여줄 범위를 바꾼다 — 접속 상태(showPresence)와 모임(meetupScope).
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
  const scope = typeof body?.meetupScope === 'string' ? body.meetupScope : null;
  const presence = typeof body?.showPresence === 'boolean' ? body.showPresence : null;
  if (presence === null && scope === null) {
    return await errJson(E.badRequest, 400);
  }
  if (scope !== null && !MEETUP_SCOPES.includes(scope as MeetupScope)) {
    return await errJson(E.badRequest, 400);
  }

  // 맺어진 친구가 아니면 바꿀 것도 없다 (요청 중인 사이는 서로의 접속·모임을 보지 못한다)
  if (presence !== null && !(await setPresenceVisible(user.id, id, presence))) {
    return await errJson(E.friendNotFound, 404);
  }
  if (scope !== null && !(await setMeetupScope(user.id, id, scope as MeetupScope))) {
    return await errJson(E.friendNotFound, 404);
  }
  return NextResponse.json({ ok: true, ...(presence !== null ? { showPresence: presence } : {}), ...(scope !== null ? { meetupScope: scope } : {}) });
}
