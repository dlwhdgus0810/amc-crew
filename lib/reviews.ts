/**
 * 후기 규칙 — 서버와 화면이 함께 쓴다.
 *
 * 여기에는 DB를 부르는 것이 없다. 화면에서 lib/db/reviews.ts를 불러오면 drizzle까지
 * 브라우저 번들에 딸려 온다 (lib/ratings.ts·lib/photos.ts와 같은 이유).
 */

/**
 * 한 줄의 길이.
 *
 * 「한줄 후기」라는 말대로 두 줄쯤에서 끊는다. 길게 쓸 이야기는 모임 댓글이 이미
 * 받고 있고, 모아보기는 한 화면에 여러 사람의 목소리가 보여야 뜻이 있다.
 */
export const REVIEW_MAX = 200;

/** 모아보기에 싣는 줄 수 — 이 저장소에는 무한 스크롤이 없다 (전부 자른다) */
export const REVIEW_FEED_LIMIT = 30;
