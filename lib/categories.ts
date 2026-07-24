export interface Category {
  slug: string;
  name: string;
  emoji: string; // 레거시 호환용 (UI에서는 더 이상 사용하지 않음)
  en: string;
  color: string; // 카테고리 시그니처 컬러
  fg: string; // 컬러 위 텍스트 색
  kind: 'movie' | 'posts';
  description: string;
  /** 설정하면 모임 만들기에 "뭐 볼지/뭐 할지" 제목 입력이 생긴다 (예: '영화/드라마') */
  titleLabel?: string;
}

export const CATEGORIES: Category[] = [
  { slug: 'movie', name: 'AMC', emoji: '🎬', en: 'AMC', color: '#E8380D', fg: '#F6F4EE', kind: 'movie', description: 'The Odyssey 회차 맞추기' },
  { slug: 'movienight', name: '무비나잇', emoji: '🍿', en: 'MOVIE NIGHT', color: '#5B2A86', fg: '#F6F4EE', kind: 'posts', description: '같이 영화 볼 사람 모집', titleLabel: '영화/드라마' },
  { slug: 'pickleball', name: '피클볼', emoji: '🥒', en: 'PICKLEBALL', color: '#008542', fg: '#F6F4EE', kind: 'posts', description: '같이 칠 사람 모집' },
  { slug: 'bowling', name: '볼링', emoji: '🎳', en: 'BOWLING', color: '#E9A300', fg: '#101010', kind: 'posts', description: '같이 칠 사람 모집' },
  { slug: 'soccer', name: '축구', emoji: '⚽', en: 'SOCCER', color: '#002FA7', fg: '#F6F4EE', kind: 'posts', description: '같이 할 사람 모집' },
];

/** 포스트/구독이 가능한 카테고리 슬러그 (영화 제외) */
export const POST_CATEGORY_SLUGS = CATEGORIES.filter((c) => c.kind === 'posts').map((c) => c.slug);

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
