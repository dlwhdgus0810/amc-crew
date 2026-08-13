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
import { originalExt, originalPath, photoPath } from './photos';

/** 긴 변 기준. 폰 화면에서 크게 봐도 충분하고, 장당 200~500KB로 떨어진다 */
export const MAX_EDGE = 1600;
const QUALITY = 0.85;

export interface Shrunk {
  blob: Blob;
  width: number;
  height: number;
}

/** 브라우저가 이 형식을 못 읽을 때 (아이폰 HEIC가 대부분이다) */
export class UnreadableImageError extends Error {}

/**
 * 사진 한 장을 저장소에 올린다 — **두 벌로**.
 *
 *  1. 화면용: 아래 shrinkToJpeg가 줄여 구운 JPEG. 격자와 크게 보기가 이걸 쓴다.
 *  2. 원본: 고른 파일 그대로. 「원본 받기」가 이걸 준다.
 *
 * 두 벌을 두는 이유가 둘이다. 원본은 아이폰 HEIC일 수 있는데 크롬·안드로이드가 못 열고,
 * 격자의 작은 네모 하나를 그리려고 8MB를 받게 할 수는 없다.
 *
 * **원본이 실패해도 사진은 올라간다.** 원본은 있으면 좋은 것이지 사진이 걸리는 조건이
 * 아니다 — 25MB를 넘겼거나 폰 데이터가 끊긴 경우에 화면용까지 같이 버릴 이유가 없다.
 */
export async function uploadPhoto(
  file: File,
  userId: string,
  postId?: string
): Promise<{
  pathname: string;
  originalPathname: string | null;
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
  try {
    const orig = await upload(originalPath(userId, uuid, originalExt(file.name)), file, {
      access: 'private',
      handleUploadUrl: '/api/blob/upload',
      ...(file.type ? { contentType: file.type } : {}),
      clientPayload: payload,
    });
    originalPathname = orig.pathname;
  } catch (e) {
    // 원본만 못 올렸다 — 화면용은 이미 올라갔으니 사진은 남는다
    console.warn('[photo] 원본 업로드 실패 (화면용만 남긴다):', e instanceof Error ? e.message : e);
  }

  return { pathname: put.pathname, originalPathname, width, height, display: blob };
}

export async function shrinkToJpeg(file: File): Promise<Shrunk> {
  const bitmap = await decode(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
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
    canvas.toBlob(resolve, 'image/jpeg', QUALITY)
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
