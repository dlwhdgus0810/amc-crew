import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getPost } from '@/lib/db/posts';
import { deletePhotoRow, getPhoto } from '@/lib/db/photos';
import { deleteBlobs } from '@/lib/blob';

export const dynamic = 'force-dynamic';

/**
 * 사진 한 장 지우기 — 올린 사람, 그 모임의 호스트, 관리자.
 *
 * 행을 먼저 지우고 파일을 지운다. 반대로 하면 삭제가 도중에 실패했을 때 없는 파일을
 * 가리키는 행이 남아 영영 깨진 그림으로 보인다. 파일이 남는 쪽은 청소가 걷어간다.
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
  await deleteBlobs([photo.pathname]);
  return NextResponse.json({ ok: true });
}
