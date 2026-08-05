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

/*
 * 저장 경로.
 *
 * 여기서 **환경을 보지 않는다.** 한때 개발 중 올린 것을 dev/ 아래로 나누려고
 * process.env.VERCEL_ENV를 봤는데, 그 값은 서버에만 있다 — Next는 NEXT_PUBLIC_* 만
 * 브라우저 번들에 넣는다. 그래서 브라우저는 dev/를 붙이고 서버는 안 붙인 것을 기대해,
 * 로컬에서는 멀쩡하다가 프로덕션에서만 403이 났다.
 *
 * 경로는 브라우저가 만들고 서버가 검사한다 — **양쪽이 똑같이 계산할 수 있는 것만**으로
 * 만들어야 한다. 개발 중 올린 파일은 어차피 주인이 없으므로(개발 DB는 인메모리다)
 * 청소가 하루 뒤에 걷어간다. 자리를 나누지 않아도 그 일은 그대로 된다.
 */

export function photoPath(postId: string, uuid: string): string {
  return `photos/${postId}/${uuid}.jpg`;
}

/**
 * 플라이어는 모임을 만들기 전에 고른다 — 그때는 postId가 없다.
 * 그래서 올린 사람 아래에 두고, 모임에 매다는 것은 저장할 때 따로 확인한다.
 */
export function flyerPath(userId: string, uuid: string): string {
  return `flyers/${userId}/${uuid}.jpg`;
}

/**
 * 경로가 제자리인지 확인한다. 두 번 쓴다 — 토큰을 내주기 전(그 경로에 토큰이 묶인다)과
 * 「이 사진을 이 모임에 붙여 주세요」를 받을 때. 뒤쪽은 브라우저가 보내는 값이라 꼭 다시 본다.
 *
 * 끝의 `-xxxxx`는 저장소가 붙이는 무작위 접미사다(addRandomSuffix). 우리가 이미 uuid를
 * 넣으므로 겹칠 일은 없지만, 실수로 같은 경로에 두 번 올려 덮어쓰는 것을 막아 준다.
 * 그래서 켜 두고 여기서 받아들인다 — 빼면 이 검사가 전부 실패한다.
 */
export function pathAllowed(pathname: string, kind: 'photo' | 'flyer', ownerId: string): boolean {
  const uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  const suffix = '(-[A-Za-z0-9]+)?';
  const folder = kind === 'photo' ? 'photos' : 'flyers';
  return new RegExp(`^${folder}\\/${ownerId}\\/${uuid}${suffix}\\.jpg$`).test(pathname);
}
