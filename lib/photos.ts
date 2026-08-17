/**
 * 모임 사진의 규칙 — 서버와 화면이 함께 쓴다.
 *
 * 여기에는 DB도 저장소도 부르는 것이 없다. 화면에서 lib/db/photos.ts를 불러오면
 * drizzle까지 브라우저 번들에 딸려 들어간다 (lib/ratings.ts와 같은 이유).
 */

import { getCategory } from './categories';

/** 한 모임에 올릴 수 있는 사진 수 */
export const MAX_PHOTOS_PER_POST = 60;
/** 한 번에 고를 수 있는 장수 — 순차로 올리므로 너무 많으면 기다림이 길어진다 */
export const MAX_PER_BATCH = 10;
/**
 * 화면용 한 장의 상한. 브라우저에서 긴 변 1600으로 줄여 보내면 보통 200~500KB다.
 * 토큰에도 같은 값을 걸어 두므로, 줄이기를 건너뛴 요청은 저장소가 거절한다.
 */
export const MAX_UPLOAD_BYTES = 4_000_000;

/**
 * 원본 한 장의 상한.
 *
 * 아이폰 48MP JPEG가 6~10MB, 파노라마나 스크린샷 묶음이 그보다 크다. 25MB면 폰으로
 * 찍은 것은 사실상 다 들어오고, 그 위는 대개 사진이 아니라 다른 것이다.
 */
export const MAX_ORIGINAL_BYTES = 25_000_000;

/**
 * 원본으로 받아 주는 형식.
 *
 * 화면용(pathname)은 브라우저가 항상 JPEG로 구워 보내지만, 원본은 고른 파일 그대로라
 * 폰이 주는 형식이 그대로 온다 — 아이폰 기본이 HEIC다. 화면에 그릴 수 있는지는 안 따진다.
 * 이건 보여주려는 파일이 아니라 **받아가라고 두는 파일**이다.
 */
export const ORIGINAL_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/avif',
  /*
   * 폰이 형식을 안 알려줄 때가 있다 — 파일 고르는 창이 type을 빈 문자열로 주면
   * 브라우저는 이걸로 올린다. 여기 없으면 저장소가 거절하고, 그러면 원본만 조용히 빠진다.
   * 확장자는 이미 경로 규칙(originalPathAllowed)에서 걸렀으므로 이 자리는 열어 둔다.
   */
  'application/octet-stream',
] as const;

/** 원본 경로에 허용하는 확장자 — 위 형식과 짝이 맞아야 한다 */
const ORIGINAL_EXTS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'avif'];

/** 파일 이름에서 확장자만 — 모르는 것이면 jpg로 둔다 (경로 규칙을 깨지 않게) */
export function originalExt(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return ORIGINAL_EXTS.includes(ext) ? ext : 'jpg';
}

/**
 * 확장자로 형식 이름 짓기 — 폰이 file.type을 안 줄 때 쓴다.
 *
 * 빈 채로 올리면 저장소가 application/octet-stream으로 받는데, 그러면 나중에 받을 때
 * 브라우저가 무엇인지 몰라 그냥 파일로 떨군다. 확장자는 알고 있으니 여기서 채워 준다.
 */
export function contentTypeForExt(ext: string): string {
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'heic' || ext === 'heif') return `image/${ext}`;
  return `image/${ext}`;
}

/*
 * 저장 경로 — 올린 사람 아래에 둔다.
 *
 * 모임이 아니라 사람으로 나누는 이유: 모임을 만들면서 고른 사진은 그 시점에 postId가
 * 없다. 올린 사람의 id는 언제나 있으므로 만들 때든 나중이든 같은 규칙으로 만들 수 있다.
 * 어느 모임의 사진인지는 경로가 아니라 post_photos의 행이 정한다.
 *
 * 여기서 **환경을 보지 않는다.** 한때 개발 중 올린 것을 dev/ 아래로 나누려고
 * process.env.VERCEL_ENV를 봤는데, 그 값은 서버에만 있다 — Next는 NEXT_PUBLIC_* 만
 * 브라우저 번들에 넣는다. 그래서 브라우저는 dev/를 붙이고 서버는 안 붙인 것을 기대해,
 * 로컬에서는 멀쩡하다가 프로덕션에서만 403이 났다. 경로는 브라우저가 만들고 서버가
 * 검사하므로 **양쪽이 똑같이 계산할 수 있는 것만**으로 만들어야 한다.
 */

export function photoPath(userId: string, uuid: string): string {
  return `photos/${userId}/${uuid}.jpg`;
}

/**
 * 원본 자리. 같은 uuid에 `-orig`를 붙여 화면용과 짝을 이룬다 —
 * 행이 사라져도 어느 화면용 사진의 원본인지 경로만 보고 알 수 있다.
 */
export function originalPath(userId: string, uuid: string, ext: string): string {
  return `photos/${userId}/${uuid}-orig.${ext}`;
}

/**
 * 격자용 작은 사진 자리. 원본과 같은 규칙으로 `-thumb`를 붙인다.
 */
export function thumbPath(userId: string, uuid: string): string {
  return `photos/${userId}/${uuid}-thumb.jpg`;
}

/**
 * 썸네일 자리인지. **pathAllowed로 대신할 수 없다** — 처음에 그렇게 했다가 백필이 멈췄다.
 *
 * pathAllowed의 접미사 자리는 하나뿐인데 `-thumb`가 그 자리를 먼저 차지한다. 그래서
 * 올리기 직전(`<uuid>-thumb.jpg`)에는 통과하고, 저장소가 무작위 접미사를 붙여 돌려준
 * `<uuid>-thumb-a1b2c3.jpg`에서 걸린다. 검사하는 시점이 둘이라 앞에서만 통과한 것이다.
 *
 * `-orig`이 이 문제를 안 겪은 이유가 바로 규칙에 `-orig`을 따로 적어 뒀기 때문이고,
 * 여기도 같은 모양으로 적는다 — 접미사 자리를 비워 둔다.
 *
 * 붙는 규칙(JPEG, 4MB)은 화면용과 같다. 갈라지는 것은 경로 모양뿐이다.
 */
export function thumbPathAllowed(pathname: string, ownerId: string): boolean {
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const suffix = '(-[A-Za-z0-9]+)?';
  return new RegExp(`^photos\\/${ownerId}\\/${uuid}-thumb${suffix}\\.jpg$`).test(pathname);
}

/**
 * 경로가 자기 자리인지 확인한다. 두 번 쓴다 — 토큰을 내주기 전(그 경로에 토큰이 묶인다)과
 * 「이 사진을 이 모임에 붙여 주세요」를 받을 때. 뒤쪽은 브라우저가 보내는 값이라 꼭 다시 본다.
 * 남의 자리에 쓰거나 남이 올린 것을 자기 모임에 매다는 것을 여기서 막는다.
 *
 * 끝의 `-xxxxx`는 저장소가 붙이는 무작위 접미사다(addRandomSuffix). 우리가 이미 uuid를
 * 넣으므로 겹칠 일은 없지만, 실수로 같은 경로에 두 번 올려 덮어쓰는 것을 막아 준다.
 * 그래서 켜 두고 여기서 받아들인다 — 빼면 이 검사가 전부 실패한다.
 */
export function pathAllowed(pathname: string, ownerId: string): boolean {
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const suffix = '(-[A-Za-z0-9]+)?';
  return new RegExp(`^photos\\/${ownerId}\\/${uuid}${suffix}\\.jpg$`).test(pathname);
}

/**
 * 원본 자리인지. 화면용과 **따로** 본다 — 붙는 상한과 형식이 다르기 때문이다.
 * (화면용은 JPEG 4MB, 원본은 아무 사진 형식 25MB)
 *
 * `-orig`가 uuid와 무작위 접미사 사이에 오는 것에 주의. 저장소가 접미사를 맨 뒤,
 * 확장자 앞에 붙이므로 `<uuid>-orig-a1b2c3.heic` 같은 모양이 된다.
 */
export function originalPathAllowed(pathname: string, ownerId: string): boolean {
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const suffix = '(-[A-Za-z0-9]+)?';
  const ext = ORIGINAL_EXTS.join('|');
  return new RegExp(`^photos\\/${ownerId}\\/${uuid}-orig${suffix}\\.(${ext})$`).test(pathname);
}

/**
 * 사진 한 장의 찍은 시각·자리. 저장되는 모양 그대로다 (lib/db/schema.ts).
 */
export interface PhotoExifInput {
  takenAt: Date | null;
  takenOffset: number | null;
  lat: number | null;
  lon: number | null;
}

export const NO_EXIF: PhotoExifInput = { takenAt: null, takenOffset: null, lat: null, lon: null };

/** 카메라가 시각을 못 맞춘 채 찍으면 1970년이 박힌다 — 그런 값은 안 받는다 */
const OLDEST_TAKEN = Date.UTC(2000, 0, 1);

/**
 * 브라우저가 보낸 EXIF를 받아들일지 정한다.
 *
 * **타임라인을 쓰는 카테고리가 아니면 통째로 버린다.** 좌표는 「우리집」이라고 안 써도
 * 그 집이 어디인지 말해 버리는 값이라, 쓸 데가 있는 자리에만 남긴다 — 지금은 여행뿐이다
 * (lib/categories.ts의 timeline).
 *
 * 화면이 애초에 안 보내지만 거르는 것은 여기다. 화면이 보내는 값은 화면이 정하는 값이라,
 * 무엇을 담을지는 서버가 정해야 한다. 경로를 다시 보는 것(pathAllowed)과 같은 기준이다.
 */
export function exifFromBody(raw: unknown, category: string): PhotoExifInput {
  if (!getCategory(category)?.timeline) return NO_EXIF;
  if (!raw || typeof raw !== 'object') return NO_EXIF;
  const b = raw as Record<string, unknown>;

  let takenAt: Date | null = null;
  if (typeof b.takenAt === 'string') {
    const at = new Date(b.takenAt);
    const ms = at.getTime();
    // 앞날짜는 시계가 틀어진 기기다. 하루쯤은 시차로 봐준다
    if (!Number.isNaN(ms) && ms >= OLDEST_TAKEN && ms <= Date.now() + 86_400_000) takenAt = at;
  }

  const num = (v: unknown, limit: number) =>
    typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= limit ? v : null;
  const lat = num(b.lat, 90);
  const lon = num(b.lon, 180);

  return {
    takenAt,
    // 오프셋은 시각이 있을 때만 뜻이 있다 (±14시간이 세상의 끝이다)
    takenOffset: takenAt ? num(b.takenOffset, 14 * 60) : null,
    // 둘 중 하나만 온 좌표는 좌표가 아니다. 0,0은 「모름」을 그렇게 적는 기기가 있다
    ...(lat != null && lon != null && !(lat === 0 && lon === 0) ? { lat, lon } : { lat: null, lon: null }),
  };
}
