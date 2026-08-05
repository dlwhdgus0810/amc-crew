import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getPostView, isParticipant } from '@/lib/db/posts';
import { addPhoto, countPhotos } from '@/lib/db/photos';
import { canAddPhotos, isOurBlobUrl, MAX_PHOTOS_PER_POST } from '@/lib/photos';

export const dynamic = 'force-dynamic';

/**
 * 올린 사진을 모임에 매단다.
 *
 * 바이트는 이미 저장소에 가 있다(app/api/blob/upload). 여기는 「그 주소를 이 모임에 붙여
 * 주세요」를 받는 자리다. 그래서 권한을 한 번 더 본다 — 토큰을 받은 뒤 모임이 지워졌거나
 * 명단에서 빠졌을 수 있고, 무엇보다 주소는 브라우저가 보내는 값이라 그냥 믿으면 안 된다.
 *
 * 조회는 없다. 모임 상세가 서버에서 그려지면서 이미 들고 내려간다.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const banned = await banGuard(user);
  if (banned) return banned;

  const post = await getPostView(id, user.id);
  if (!post) return await errJson(E.postNotFound, 404);
  if (!canAddPhotos(post)) return await errJson(E.photoClosed, 403);
  if (!(await isParticipant(id, user.id)) && !isAdmin(user)) {
    return await errJson(E.photoParticipantOnly, 403);
  }
  if ((await countPhotos(id)) >= MAX_PHOTOS_PER_POST) return await errJson(E.photoFull, 400);

  const body = await req.json().catch(() => null);
  if (!isOurBlobUrl(body?.url) || typeof body?.pathname !== 'string') {
    return await errJson(E.photoBadUrl, 400);
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

  const photoId = await addPhoto({
    postId: id,
    userId: user.id,
    url: body.url,
    pathname: body.pathname,
    width: num(body.width),
    height: num(body.height),
  });
  return NextResponse.json({ ok: true, photoId });
}
