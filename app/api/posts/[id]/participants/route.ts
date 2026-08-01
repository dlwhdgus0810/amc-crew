import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getPost, isParticipant, joinPost, notifyAddedToPost, notifyFriendJoin } from '@/lib/db/posts';
import { areFriends, friendIds } from '@/lib/db/friends';
import { isPastSlot } from '@/lib/dates';
import { getProfiles, resolveDisplayName } from '@/lib/store';

export const dynamic = 'force-dynamic';

/**
 * 친구를 이 모임에 대신 넣는다.
 *
 * /join에 얹지 않고 따로 둔 이유: /join은 "내가 들어간다"는 뜻이고 본문이 없다.
 * 남을 넣는 일을 같은 자리에 섞으면 그 라우트의 의미가 흐려진다.
 *
 * 상대의 동의를 묻지 않고 바로 넣는다 — 말로 이미 약속하고 오는 일이라서다.
 * 대신 넣긴 사람에게 알림이 가고, 본인이 나가기를 누르면 그만이다.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return await errJson(E.postNotFound, 404);
  }

  const body = await req.json().catch(() => null);
  const friendId = typeof body?.userId === 'string' ? body.userId : '';
  if (!friendId) {
    return await errJson(E.badRequest, 400);
  }
  if (isPastSlot(post.date, post.endTime)) {
    return await errJson(E.friendAddPast, 400);
  }
  // 이 모임에 있는 사람만 남을 부를 수 있다 — 지나가던 사람이 남의 모임 명단을 채우면 안 된다
  if (!(await isParticipant(id, user.id))) {
    return await errJson(E.friendAddOnly, 403);
  }
  if (!(await areFriends(user.id, friendId))) {
    return await errJson(E.friendNotFriend, 403);
  }
  // joinPost는 이미 참가 중이어도 true를 주므로, 중복 알림은 여기서 막는다
  if (await isParticipant(id, friendId)) {
    return await errJson(E.friendAlreadyIn, 409);
  }

  await ensureUser(user);
  if (!(await joinPost(id, friendId, post.capacity))) {
    return await errJson(E.postFull, 409);
  }

  try {
    const profiles = await getProfiles();
    const actorName = resolveDisplayName(profiles[user.id], user.name);
    const friendName = resolveDisplayName(profiles[friendId], '알 수 없음');
    await notifyAddedToPost(post, actorName, friendId);
    // 넣긴 사람의 다른 친구들에게도 알린다. 누른 사람만 뺀다 — 방금 자기가 한 일이다.
    const others = (await friendIds(friendId)).filter((uid) => uid !== user.id);
    await notifyFriendJoin(post, friendName, others);
  } catch (e) {
    console.error('[participants] notify failed:', e);
  }

  return NextResponse.json({ ok: true });
}
