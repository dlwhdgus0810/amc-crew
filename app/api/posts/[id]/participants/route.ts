import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getPost, isParticipant, joinPost, leavePost, notifyAddedToPost, notifyFriendJoin } from '@/lib/db/posts';
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
  const banned = await banGuard(user);
  if (banned) return banned;
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
  /*
   * 관리자는 명단을 고치는 사람이라 위 조건들을 지나간다.
   * 지난 모임에 빠진 사람을 넣거나, 친구가 아닌 사람을 넣는 일이 실제로 생긴다 —
   * 그걸 못 하면 명단이 틀린 채로 굳고, 호스트 점수까지 같이 틀어진다.
   */
  const asAdmin = isAdmin(user);
  if (!asAdmin) {
    if (isPastSlot(post.date, post.startTime, post.endTime)) {
      return await errJson(E.friendAddPast, 400);
    }
    // 이 모임에 있는 사람만 남을 부를 수 있다 — 지나가던 사람이 남의 모임 명단을 채우면 안 된다
    if (!(await isParticipant(id, user.id))) {
      return await errJson(E.friendAddOnly, 403);
    }
    if (!(await areFriends(user.id, friendId))) {
      return await errJson(E.friendNotFriend, 403);
    }
  }
  // joinPost는 이미 참가 중이어도 true를 주므로, 중복 알림은 여기서 막는다
  if (await isParticipant(id, friendId)) {
    return await errJson(E.friendAlreadyIn, 409);
  }

  await ensureUser(user);
  if (!(await joinPost(id, friendId, asAdmin ? null : post.capacity))) {
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

/**
 * 명단에서 뺀다 — 관리자만.
 *
 * 본인이 나가는 것은 /join의 DELETE가 맡는다. 이쪽은 "남을 뺀다"라서 따로 둔다.
 * 뺀 사람에게는 알리지 않는다. 대개 잘못 올라간 이름을 바로잡는 일이라,
 * 알림이 가면 오히려 무슨 일인가 싶어진다.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return await errJson(E.postNotFound, 404);
  }
  const body = await req.json().catch(() => null);
  const targetId = typeof body?.userId === 'string' ? body.userId : '';
  if (!targetId) {
    return await errJson(E.badRequest, 400);
  }
  if (!(await isParticipant(id, targetId))) {
    return await errJson(E.notParticipant, 404);
  }
  await leavePost(id, targetId);
  return NextResponse.json({ ok: true });
}
