import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getPost, isParticipant, joinPost, leavePost, notifyFriendJoin } from '@/lib/db/posts';
import { friendIds } from '@/lib/db/friends';
import { getProfiles, resolveDisplayName } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  await ensureUser(user);
  // joinPost는 이미 참가 중이어도 true를 준다 — 알림은 처음 들어올 때만 나가야 한다
  const wasIn = await isParticipant(id, user.id);
  const joined = await joinPost(id, user.id, post.capacity);
  if (!joined) {
    return await errJson(E.postFull, 409);
  }

  // 친구들에게 조용히 알린다 (인앱만). 실패해도 참가는 성공 처리
  if (!wasIn) {
    try {
      const myName = resolveDisplayName((await getProfiles())[user.id], user.name);
      await notifyFriendJoin(post, myName, await friendIds(user.id));
    } catch (e) {
      console.error('[join] notify failed:', e);
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  // 정기 모임 회차는 "매주 열리지만 이번 주는 못 감"이 자연스러우므로 작성자도 빠질 수 있다
  if (post.authorId === user.id && !post.recurringRuleId) {
    return await errJson(E.authorCantLeave, 409);
  }
  await leavePost(id, user.id);
  return NextResponse.json({ ok: true });
}
