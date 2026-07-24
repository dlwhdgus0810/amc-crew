export interface Category {
  slug: string;
  name: string;
  emoji: string; // 레거시 호환용 (UI에서는 더 이상 사용하지 않음)
  en: string;
  color: string; // 카테고리 시그니처 컬러
  fg: string; // 컬러 위 텍스트 색
  kind: 'movie' | 'posts';
  description: string;
}

export const CATEGORIES: Category[] = [
  { slug: 'movie', name: '영화', emoji: '🎬', en: 'CINEMA', color: '#E8380D', fg: '#F6F4EE', kind: 'movie', description: 'The Odyssey 회차 맞추기' },
  { slug: 'pickleball', name: '피클볼', emoji: '🥒', en: 'PICKLEBALL', color: '#008542', fg: '#F6F4EE', kind: 'posts', description: '같이 칠 사람 모집' },
  { slug: 'bowling', name: '볼링', emoji: '🎳', en: 'BOWLING', color: '#E9A300', fg: '#101010', kind: 'posts', description: '같이 칠 사람 모집' },
  { slug: 'soccer', name: '축구', emoji: '⚽', en: 'SOCCER', color: '#002FA7', fg: '#F6F4EE', kind: 'posts', description: '같이 할 사람 모집' },
];

/** 포스트/구독이 가능한 카테고리 슬러그 (영화 제외) */
export const POST_CATEGORY_SLUGS = CATEGORIES.filter((c) => c.kind === 'posts').map((c) => c.slug);

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
