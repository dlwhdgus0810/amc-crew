import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { deleteComment, getComment } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const { id } = await params;
  const comment = await getComment(id);
  if (!comment) {
    return await errJson(E.commentNotFound, 404);
  }
  if (comment.userId !== user.id && !isAdmin(user)) {
    return await errJson(E.commentOwnerOnly, 403);
  }
  await deleteComment(id);
  return NextResponse.json({ ok: true });
}
