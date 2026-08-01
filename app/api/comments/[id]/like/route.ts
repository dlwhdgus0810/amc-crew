import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getComment, toggleCommentLike } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

/** 댓글 좋아요 토글 — 누르면 켜지고 다시 누르면 꺼진다 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;
  const { id } = await params;
  const comment = await getComment(id);
  if (!comment) {
    return await errJson(E.commentNotFound, 404);
  }
  await ensureUser(user);
  return NextResponse.json({ ok: true, ...(await toggleCommentLike(id, user.id)) });
}
