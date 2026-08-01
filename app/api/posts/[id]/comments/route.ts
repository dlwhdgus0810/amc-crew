import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { addComment, getComment, getPost, notifyComment } from '@/lib/db/posts';
import { getProfiles, resolveDisplayName } from '@/lib/store';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

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
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  if (!text || text.length > 300) {
    return await errJson(E.comment, 400);
  }

  // 답글이면 같은 모임의 댓글이어야 한다 (깊이는 제한하지 않고, 화면에서 들여쓰기만 제한한다)
  let parentId: string | undefined;
  let parentAuthorId: string | undefined;
  if (typeof body?.parentId === 'string' && body.parentId) {
    const parent = await getComment(body.parentId);
    if (!parent || parent.postId !== id) {
      return await errJson(E.commentNotFound, 404);
    }
    parentId = parent.id;
    parentAuthorId = parent.userId;
  }

  await ensureUser(user);
  const anonymous = Boolean(body?.anonymous);
  const commentId = await addComment(id, user.id, text, parentId, anonymous);

  // 참가자(작성자 제외)에게 댓글 알림 — 실패해도 댓글 작성은 성공 처리
  try {
    const profile = (await getProfiles())[user.id];
    await notifyComment(
      post,
      user.id,
      resolveDisplayName(profile, user.name),
      text,
      siteUrl(req.nextUrl.origin),
      parentAuthorId,
      anonymous
    );
  } catch (e) {
    console.error('[comments] notify failed:', e);
  }

  return NextResponse.json({ ok: true, commentId });
}
