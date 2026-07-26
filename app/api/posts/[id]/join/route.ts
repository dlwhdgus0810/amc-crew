import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getPost, joinPost, leavePost } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return await errJson(E.postNotFound, 404);
  }
  await ensureUser(user);
  const joined = await joinPost(id, user.id, post.capacity);
  if (!joined) {
    return await errJson(E.postFull, 409);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
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
