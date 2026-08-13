/**
 * 올리기 전에 브라우저에서 사진을 줄인다. 브라우저 전용이다.
 *
 * 프로필 사진(app/profile/profile-client.tsx의 shrink)과 같은 얼개인데 셋이 다르다.
 *  - 정사각으로 자르지 않는다. 아바타는 얼굴이라 가운데를 잘라도 되지만, 플라이어는
 *    포스터고 단체사진은 단체다 — 긴 변만 맞추고 비율을 지킨다.
 *  - createImageBitmap을 쓴다. EXIF 회전을 확실히 적용하고(폰을 세로로 들고 찍은 사진이
 *    눕는 것을 막는다) 1200만 화소를 메인 스레드 밖에서 푼다.
 *  - data URL이 아니라 Blob을 준다. 저장소에 그대로 올릴 수 있고 base64의 33% 부풀림이 없다.
 *
 * 덤으로 EXIF가 통째로 떨어져 나간다 — 그 안에 찍은 자리(GPS)가 들어 있다.
 */

import { upload } from '@vercel/blob/client';
import { contentTypeForExt, originalExt, originalPath, photoPath, thumbPath } from './photos';

/** 긴 변 기준. 폰 화면에서 크게 봐도 충분하고, 장당 200~500KB로 떨어진다 */
export const MAX_EDGE = 1600;
const QUALITY = 0.85;

/**
 * 격자에 뿌릴 작은 사진. 긴 변 400px, 화질은 조금 낮춘다.
 *
 * 격자 한 칸이 폰에서 110px 남짓이고 3배 화면이면 330px이라 400이면 넉넉하다.
 * 화질을 0.7로 내리는 것은 이 크기에서는 눈에 안 띄면서 파일이 눈에 띄게 줄기 때문이다 —
 * 크게 볼 때 쓰는 화면용은 0.85 그대로다.
 */
export const THUMB_EDGE = 400;
const THUMB_QUALITY = 0.7;

export interface Shrunk {
  blob: Blob;
  width: number;
  height: number;
}

/** 브라우저가 이 형식을 못 읽을 때 (아이폰 HEIC가 대부분이다) */
export class UnreadableImageError extends Error {}

/**
 * 사진 한 장을 저장소에 올린다 — **세 벌로**.
 *
 *  1. 화면용(1600px): 크게 보기가 쓴다.
 *  2. 원본: 고른 파일 그대로. 「원본 받기」가 이걸 준다.
 *  3. 썸네일(400px): 격자가 쓴다.
 *
 * 원본을 따로 두는 이유: 아이폰 HEIC일 수 있는데 크롬·안드로이드가 못 연다.
 * 썸네일을 따로 두는 이유: 격자 한 칸이 110px인데 거기에 1600px(642KB)을 넣고 있었고,
 * 첫 화면 열두 칸이 7.5MB였다. 화면용을 더 줄이면 크게 보기가 흐려지니 파일을 나눈다.
 *
 * **둘 다 실패해도 사진은 올라간다.** 있으면 좋은 것이지 사진이 걸리는 조건이 아니다 —
 * 폰 데이터가 끊긴 자리에서 화면용까지 같이 버릴 이유가 없다. 썸네일이 없으면 격자가
 * 화면용을 쓴다(느릴 뿐 깨지지 않는다).
 *
 * 원본은 **왜 실패했는지도 돌려준다**. 처음엔 조용히 넘겼는데, 그러면 「원본 받기」가
 * 안 보이는 이유를 아무 데서도 알 수 없다 (실제로 그래서 한 번 헤맸다). 썸네일은
 * 안 돌려준다 — 없어도 화면이 그대로라 쓰는 사람에게 할 말이 없다.
 */
export async function uploadPhoto(
  file: File,
  userId: string,
  postId?: string
): Promise<{
  pathname: string;
  originalPathname: string | null;
  /** 격자용 400px. 못 만들었으면 null이고, 그때는 격자가 화면용을 쓴다 */
  thumbPathname: string | null;
  /** 원본만 실패했을 때 그 이유. 사진 자체는 올라갔다 */
  originalError: string | null;
  width: number;
  height: number;
  /** 화면용으로 구운 JPEG — 만들기 화면의 미리보기가 쓴다 (원본은 HEIC일 수 있어서 못 그린다) */
  display: Blob;
}> {
  const { blob, width, height } = await shrinkToJpeg(file);
  const uuid = crypto.randomUUID();
  const payload = JSON.stringify({ kind: 'photo', ...(postId ? { postId } : {}) });

  const put = await upload(photoPath(userId, uuid), blob, {
    access: 'private',
    handleUploadUrl: '/api/blob/upload',
    contentType: 'image/jpeg',
    clientPayload: payload,
  });

  let originalPathname: string | null = null;
  let originalError: string | null = null;
  try {
    const ext = originalExt(file.name);
    const orig = await upload(originalPath(userId, uuid, ext), file, {
      access: 'private',
      handleUploadUrl: '/api/blob/upload',
      // 폰이 형식을 안 줄 때가 있어서 확장자로 채운다 — 빈 채로 보내면 저장소가 거절한다
      contentType: file.type || contentTypeForExt(ext),
      clientPayload: payload,
    });
    originalPathname = orig.pathname;
  } catch (e) {
    // 원본만 못 올렸다 — 화면용은 이미 올라갔으니 사진은 남는다
    originalError = e instanceof Error ? e.message : String(e);
    console.warn('[photo] 원본 업로드 실패 (화면용만 남긴다):', originalError);
  }

  /*
   * 썸네일은 마지막에 올린다. 화면용·원본이 먼저 자리를 잡아야, 여기서 끊겨도
   * 사진이 남는다 — 순서가 곧 「무엇을 포기할 수 있는가」다.
   */
  let thumbPathname: string | null = null;
  try {
    const thumb = await shrinkToJpeg(file, THUMB_EDGE, THUMB_QUALITY);
    const up = await upload(thumbPath(userId, uuid), thumb.blob, {
      access: 'private',
      handleUploadUrl: '/api/blob/upload',
      contentType: 'image/jpeg',
      clientPayload: payload,
    });
    thumbPathname = up.pathname;
  } catch (e) {
    // 격자가 화면용으로 그린다 — 느릴 뿐 안 깨진다
    console.warn('[photo] 썸네일 업로드 실패 (격자는 화면용을 쓴다):', e);
  }

  return { pathname: put.pathname, originalPathname, thumbPathname, originalError, width, height, display: blob };
}

/**
 * 썸네일 한 장만 저장소에 올린다 — 백필이 쓴다.
 *
 * uploadPhoto와 달리 화면용·원본은 건드리지 않는다. 이미 올라가 있는 사진에 작은
 * 그림만 덧붙이는 자리라서다. 경로는 **올리는 사람 자리**에 만든다 (토큰이 거기 묶인다).
 */
export async function uploadThumbOnly(blob: Blob, userId: string): Promise<string> {
  const up = await upload(thumbPath(userId, crypto.randomUUID()), blob, {
    access: 'private',
    handleUploadUrl: '/api/blob/upload',
    contentType: 'image/jpeg',
    clientPayload: JSON.stringify({ kind: 'photo' }),
  });
  return up.pathname;
}

export async function shrinkToJpeg(file: File, edge = MAX_EDGE, quality = QUALITY): Promise<Shrunk> {
  const bitmap = await decode(file);
  const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UnreadableImageError('canvas 2d context 없음');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality)
  );
  if (!blob) throw new UnreadableImageError('jpeg로 바꾸지 못함');
  return { blob, width, height };
}

/**
 * 그림 풀기.
 *
 * createImageBitmap이 EXIF 회전까지 처리해 주는 정식 경로다. 없는 브라우저를 위해
 * <img> 경로를 남겨 두지만, 그쪽은 회전을 못 맞춘다 — 그래서 폴백이지 기본이 아니다.
 */
async function decode(file: File): Promise<ImageBitmap> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // HEIC 같은 형식이면 여기서 던진다 — 아래 폴백도 대개 같이 실패한다
    }
  }
  return await new Promise<ImageBitmap>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // ImageBitmap과 같은 자리에 쓰이도록 최소한의 모양만 맞춘다
      resolve(img as unknown as ImageBitmap);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new UnreadableImageError('브라우저가 이 형식을 못 읽음'));
    };
    img.src = url;
  });
}
