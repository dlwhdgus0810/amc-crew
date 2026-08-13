/**
 * 모임 사진의 규칙 — 서버와 화면이 함께 쓴다.
 *
 * 여기에는 DB도 저장소도 부르는 것이 없다. 화면에서 lib/db/photos.ts를 불러오면
 * drizzle까지 브라우저 번들에 딸려 들어간다 (lib/ratings.ts와 같은 이유).
 */

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
 *
 * 확장자가 .jpg라서 **pathAllowed가 이미 받아 준다** — 접미사 자리에 `-thumb`가 들어가고,
 * 붙는 규칙(JPEG, 4MB)도 화면용과 같아야 맞다. 그래서 검사 함수를 새로 만들지 않는다.
 */
export function thumbPath(userId: string, uuid: string): string {
  return `photos/${userId}/${uuid}-thumb.jpg`;
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
