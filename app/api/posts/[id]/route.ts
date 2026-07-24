import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { deletePost, getPost } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

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
  if (post.authorId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: '작성자만 삭제할 수 있어요.' }, { status: 403 });
  }
  await deletePost(id);
  return NextResponse.json({ ok: true });
}
