import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import {
  friendsOf,
  incomingOf,
  listFriendships,
  notifyFriendAccepted,
  notifyFriendRequest,
  outgoingOf,
  requestFriend,
  sharesMeetup,
} from '@/lib/db/friends';
import { ONLINE_WINDOW_MINUTES } from '@/lib/db/presence';
import { getProfiles, resolveDisplayName } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** 내 친구·받은 요청·보낸 요청. 접속 여부는 친구에 대해서만 계산된다. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const all = await listFriendships(user.id);
  return NextResponse.json({
    friends: friendsOf(all),
    incoming: incomingOf(all),
    outgoing: outgoingOf(all),
    windowMinutes: ONLINE_WINDOW_MINUTES,
  });
}

/** 친구 요청 보내기 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const body = await req.json().catch(() => null);
  const targetId = typeof body?.userId === 'string' ? body.userId : '';
  if (!targetId) {
    return await errJson(E.badRequest, 400);
  }
  if (targetId === user.id) {
    return await errJson(E.friendSelf, 400);
  }

  /*
   * 같은 모임에서 만난 사이인지부터 본다. 사람을 찾아보기 전에 하는 검사라,
   * 없는 아이디를 넣어도 같은 답이 돌아간다 — 누가 회원인지 떠볼 수 없다.
   */
  if (!(await sharesMeetup(user.id, targetId))) {
    return await errJson(E.friendNoShared, 403);
  }

  await ensureUser(user);
  const result = await requestFriend(user.id, targetId);
  if (result === 'exists') {
    return await errJson(E.friendExists, 409);
  }

  try {
    const myName = resolveDisplayName((await getProfiles())[user.id], user.name);
    if (result === 'accepted') {
      // 상대가 먼저 보낸 요청이 있어서 그 자리에서 맺어졌다
      await notifyFriendAccepted(targetId, myName);
    } else {
      await notifyFriendRequest(targetId, myName);
    }
  } catch (e) {
    console.error('[friends] notify failed:', e);
  }

  return NextResponse.json({ ok: true, status: result });
}
