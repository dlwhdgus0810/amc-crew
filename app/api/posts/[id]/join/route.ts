import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getPost, joinPost, leavePost } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return NextResponse.json({ error: '포스트를 찾을 수 없어요.' }, { status: 404 });
  }
  await ensureUser(user);
  const joined = await joinPost(id, user.id, post.capacity);
  if (!joined) {
    return NextResponse.json({ error: '정원이 가득 차서 마감된 모임이에요.' }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return NextResponse.json({ error: '포스트를 찾을 수 없어요.' }, { status: 404 });
  }
  if (post.authorId === user.id) {
    return NextResponse.json({ error: '작성자는 참가를 취소할 수 없어요. 대신 포스트를 삭제해주세요.' }, { status: 409 });
  }
  await leavePost(id, user.id);
  return NextResponse.json({ ok: true });
}
