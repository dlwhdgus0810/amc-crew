import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getPost } from '@/lib/db/posts';
import { deletePhotoRow, getPhoto } from '@/lib/db/photos';

export const dynamic = 'force-dynamic';

/**
 * 사진 한 장 지우기 — 올린 사람, 그 모임의 호스트, 관리자.
 *
 * 행에 표시만 하고 저장소의 파일은 남긴다. 파일까지 지우면 되살려도 깨진 그림뿐이라
 * 「지운 것을 되돌릴 수 있다」는 말이 사진에서만 거짓이 된다. 청소(blob-sweep)도
 * 지워진 사진을 주인 있는 파일로 세므로 그쪽으로 새어 나가지 않는다.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const banned = await banGuard(user);
  if (banned) return banned;

  const photo = await getPhoto(photoId);
  if (!photo || photo.postId !== id) return await errJson(E.photoNotFound, 404);

  const post = await getPost(id);
  const isHost = Boolean(post && (post.authorId === user.id || post.coHostId === user.id));
  if (photo.userId !== user.id && !isHost && !isAdmin(user)) {
    return await errJson(E.photoOwnerOnly, 403);
  }

  await deletePhotoRow(photoId);
  return NextResponse.json({ ok: true });
}
