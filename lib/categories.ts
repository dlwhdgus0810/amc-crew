export interface Category {
  slug: string;
  name: string;
  emoji: string;
  kind: 'movie' | 'posts';
  description: string;
}

export const CATEGORIES: Category[] = [
  { slug: 'movie', name: '영화', emoji: '🎬', kind: 'movie', description: 'The Odyssey 회차 맞추기' },
  { slug: 'pickleball', name: '피클볼', emoji: '🥒', kind: 'posts', description: '피클볼 같이 칠 사람 모집' },
  { slug: 'bowling', name: '볼링', emoji: '🎳', kind: 'posts', description: '볼링 같이 칠 사람 모집' },
  { slug: 'soccer', name: '축구', emoji: '⚽', kind: 'posts', description: '축구 같이 할 사람 모집' },
];

/** 포스트/구독이 가능한 카테고리 슬러그 (영화 제외) */
export const POST_CATEGORY_SLUGS = CATEGORIES.filter((c) => c.kind === 'posts').map((c) => c.slug);

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
