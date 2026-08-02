import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { friendMeetups } from '@/lib/db/friend-meetups';
import { listFriendships } from '@/lib/db/friends';

export const dynamic = 'force-dynamic';

/**
 * 친구 한 명의 모임 목록 + 그 친구에 대한 내 설정.
 *
 * 친구가 아니면 404다 — 403으로 "친구만 볼 수 있어요"라고 답하면
 * 그 사람이 회원인지 아닌지가 드러난다.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;
  const { id } = await params;

  const meetups = await friendMeetups(user.id, id);
  if (!meetups) {
    return await errJson(E.friendNotFound, 404);
  }
  // 이름·사진과 내 설정은 이미 만들어 둔 목록에서 꺼낸다 (조회를 한 번 더 하지 않는다)
  const friend = (await listFriendships(user.id)).find((f) => f.id === id && f.status === 'friends');
  if (!friend) {
    return await errJson(E.friendNotFound, 404);
  }

  return NextResponse.json({ friend, ...meetups });
}
