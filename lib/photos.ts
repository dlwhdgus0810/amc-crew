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
 * 한 장의 상한. 브라우저에서 긴 변 1600으로 줄여 보내면 보통 200~500KB다.
 * 토큰에도 같은 값을 걸어 두므로, 줄이기를 건너뛴 요청은 저장소가 거절한다.
 */
export const MAX_UPLOAD_BYTES = 4_000_000;

/** 사진을 올릴 수 있는 모임인지 — 끝난 뒤에만 연다 (판정은 언제나 서버의 isPast) */
export function canAddPhotos(post: { isPast: boolean }): boolean {
  return post.isPast;
}

/**
 * 우리 저장소에서 나온 주소인지.
 *
 * 브라우저가 올린 뒤 「이 주소를 붙여 주세요」라고 알려주는 구조라, 주소를 그대로 믿으면
 * 남의 서버 그림을 모임에 걸 수 있다. 저장할 때 이걸로 한 번 거른다.
 */
export function isOurBlobUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch {
    return false;
  }
}

/*
 * 저장 경로.
 *
 * dev/를 앞에 붙이는 이유: 개발 중에는 DB가 인메모리(PGlite)인데 저장소는 진짜다
 * (lib/db/index.ts:33 참고). 그래서 개발 중 올린 것은 전부 주인 없는 파일이 된다 —
 * 청소가 그것만 골라 지울 수 있게 자리를 나눠 둔다.
 */
const devPrefix = () => (process.env.VERCEL_ENV === 'production' ? '' : 'dev/');

export function photoPath(postId: string, uuid: string): string {
  return `${devPrefix()}photos/${postId}/${uuid}.jpg`;
}

/**
 * 플라이어는 모임을 만들기 전에 고른다 — 그때는 postId가 없다.
 * 그래서 올린 사람 아래에 두고, 모임에 매다는 것은 저장할 때 따로 확인한다.
 */
export function flyerPath(userId: string, uuid: string): string {
  return `${devPrefix()}flyers/${userId}/${uuid}.jpg`;
}

/** 토큰을 내주기 전에 경로를 다시 확인한다 — 토큰이 그 경로에 묶이므로 여기가 관문이다 */
export function pathAllowed(pathname: string, kind: 'photo' | 'flyer', ownerId: string): boolean {
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const prefix = devPrefix().replace('/', '\\/');
  const re =
    kind === 'photo'
      ? new RegExp(`^${prefix}photos\\/${ownerId}\\/${uuid}\\.jpg$`)
      : new RegExp(`^${prefix}flyers\\/${ownerId}\\/${uuid}\\.jpg$`);
  return re.test(pathname);
}
