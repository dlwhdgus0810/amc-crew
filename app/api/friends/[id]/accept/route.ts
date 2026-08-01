import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { acceptFriend, notifyFriendAccepted } from '@/lib/db/friends';
import { getProfiles, resolveDisplayName } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * 받은 요청 수락.
 *
 * 수락할 자격(아직 요청 중이고, 내가 건 요청이 아님)은 UPDATE의 조건에 들어 있다.
 * 그래서 두 번 눌러도 두 번째는 404가 되고 알림이 두 줄 생기지 않는다.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const { id } = await params;
  if (!(await acceptFriend(user.id, id))) {
    return await errJson(E.friendNotFound, 404);
  }

  try {
    const myName = resolveDisplayName((await getProfiles())[user.id], user.name);
    await notifyFriendAccepted(id, myName);
  } catch (e) {
    console.error('[friends] notify failed:', e);
  }

  return NextResponse.json({ ok: true });
}
