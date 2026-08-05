/**
 * 무비나잇 평점의 규칙 — 서버와 화면이 함께 쓴다.
 *
 * 여기에는 DB를 부르는 것이 없다. 화면에서 lib/db/ratings.ts를 불러오면 drizzle까지
 * 브라우저 번들에 딸려 들어간다.
 */

/** 매길 수 있는 최고점 (0.0 ~ 10.0, 0.1 단위) */
export const RATING_MAX = 10;

/** 평점을 매기는 카테고리 — 지금은 무비나잇뿐이다 (늘릴 일이 생기면 여기만 고친다) */
export const RATABLE_CATEGORIES = ['movienight'];

/**
 * 이 모임에 점수를 매길 수 있는지.
 *
 * 끝난 뒤에만 연다 — 보기도 전에 매기는 점수는 영화 점수가 아니라 기대치다.
 * 「끝났는지」는 언제나 서버가 판정한 값(PostView.isPast)을 쓴다.
 */
export function ratable(post: { category: string; isPast: boolean }): boolean {
  return RATABLE_CATEGORIES.includes(post.category) && post.isPast;
}

/** 10점 만점 소수 → 저장용 정수(0~100). 범위를 벗어나거나 0.1 단위가 아니면 null */
export function toStored(score: unknown): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  // 0.1 단위인지 — 8.45처럼 더 잘게 들어오면 받지 않는다 (반올림해 받으면 화면과 값이 달라진다)
  const stored = Math.round(score * 10);
  if (Math.abs(score * 10 - stored) > 1e-6) return null;
  if (stored < 0 || stored > RATING_MAX * 10) return null;
  return stored;
}

/** 저장용 정수 → 10점 만점 소수 */
export function toScore(stored: number): number {
  return Math.round(stored) / 10;
}

/** 화면에 찍는 글자 — 언제나 소수점 한 자리 (8 → "8.0") */
export function formatScore(score: number): string {
  return score.toFixed(1);
}
