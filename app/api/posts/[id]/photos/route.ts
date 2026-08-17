import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getPostView, isParticipant } from '@/lib/db/posts';
import { isAnonymous } from '@/lib/categories';
import { addPhoto, countPhotos, listPhotos } from '@/lib/db/photos';
import {
  MAX_PHOTOS_PER_POST,
  exifFromBody,
  originalPathAllowed,
  pathAllowed,
  thumbPathAllowed,
} from '@/lib/photos';

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
/**
 * 이 모임의 사진 목록 — 참가자와 관리자만.
 *
 * 모임 상세는 서버가 그리면서 이미 들고 내려가므로 이걸 안 쓴다. 수정 시트가 쓴다 —
 * 거기서는 넣고 빼는 즉시 목록이 달라져야 하는데, 서명된 주소는 서버만 만들 수 있다.
 */
/**
 * 이 모임의 사진 목록. 모아보기의 「전부 받기」가 쓴다 — 거기에는 앞의 스무 장만
 * 실려 있어서, 전부 받으려면 나머지 주소를 여기서 받아 가야 한다.
 *
 * **자격은 post.photos 하나로 가린다.** 예전에는 여기서 참가자·관리자를 따로 봤는데,
 * 그러면 호스트가 사진을 열어 둔 모임(photosPublic)이 화면에는 보이고 이 목록에서는
 * 403이 된다 — 판정하는 자리가 둘이면 언젠가 어긋난다.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const post = await getPostView(id, user.id);
  if (!post) return await errJson(E.postNotFound, 404);
  if (!post.photos) return await errJson(E.photoParticipantOnly, 403);

  // 받기 주소는 갔던 사람과 관리자에게만 (lib/db/photos.ts의 canDownload)
  const photos = await listPhotos(id, {
    anonymous: isAnonymous(post.category),
    viewerId: user.id,
    canDownload: isAdmin(user) || post.participants.some((p) => p.id === user.id),
  });
  return NextResponse.json({
    photos: photos.map((p) => ({ id: p.id, url: p.url, downloadUrl: p.downloadUrl })),
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const banned = await banGuard(user);
  if (banned) return banned;

  const post = await getPostView(id, user.id);
  if (!post) return await errJson(E.postNotFound, 404);
  if (!(await isParticipant(id, user.id)) && !isAdmin(user)) {
    return await errJson(E.photoParticipantOnly, 403);
  }
  if ((await countPhotos(id)) >= MAX_PHOTOS_PER_POST) return await errJson(E.photoFull, 400);

  const body = await req.json().catch(() => null);
  /*
   * 자기가 올린 자리의 경로인지 다시 본다. 토큰을 내줄 때 한 번 봤지만, 여기 오는 값은
   * 브라우저가 보내는 것이라 그대로 믿으면 남이 올린 파일을 자기 모임에 매달 수 있다.
   */
  if (typeof body?.pathname !== 'string' || !pathAllowed(body.pathname, user.id)) {
    return await errJson(E.photoBadUrl, 400);
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

  const photoId = await addPhoto({
    postId: id,
    userId: user.id,
    pathname: body.pathname,
    /*
     * 원본은 있으면 붙이고 없으면 만다. 규칙이 화면용과 달라(형식·크기) 따로 본다.
     * 자기 자리가 아니면 조용히 없는 것으로 친다 — 사진 자체는 이미 멀쩡히 올라왔다.
     */
    originalPathname:
      typeof body.originalPathname === 'string' && originalPathAllowed(body.originalPathname, user.id)
        ? body.originalPathname
        : null,
    // 썸네일은 경로 모양이 달라 따로 본다 (`-thumb`). 자기 자리가 아니면 없는 것으로 친다
    thumbPathname:
      typeof body.thumbPathname === 'string' && thumbPathAllowed(body.thumbPathname, user.id)
        ? body.thumbPathname
        : null,
    width: num(body.width),
    height: num(body.height),
    /*
     * 찍은 시각·자리는 카테고리를 보고 받는다 — 여행이 아니면 브라우저가 뭘 보내든
     * 통째로 버린다. 좌표는 쓸 데가 있는 자리에만 남긴다 (lib/photos.ts).
     */
    exif: exifFromBody(body.exif, post.category),
  });
  return NextResponse.json({ ok: true, photoId });
}
