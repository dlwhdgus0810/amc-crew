export interface Category {
  slug: string;
  name: string;
  emoji: string; // 레거시 호환용 (UI에서는 더 이상 사용하지 않음)
  en: string;
  color: string; // 카테고리 시그니처 컬러
  fg: string; // 컬러 위 텍스트 색
  kind: 'movie' | 'posts';
  description: string;
  /** 설정하면 모임 만들기에 선택 입력이 하나 생긴다 (예: '영화/드라마', '메뉴') */
  titleLabel?: string;
  /** titleLabel 입력에 TMDB 자동완성을 붙인다 (영화/드라마 전용) */
  titleSearch?: 'tmdb';
  /** 장소 입력의 이름 (기본 '장소') — 예: '식당', '카페' */
  locationLabel?: string;
  /** 장소 입력 placeholder에 붙는 예시 문구 */
  locationHint?: string;
}

// 배열 순서가 곧 홈 캐러셀 노출 순서다 (카드 번호 01·02…도 여기서 나온다)
export const CATEGORIES: Category[] = [
  // 색은 노출 순서대로 빨강 → 노랑 → 초록 → 파랑 → 보라, 그 뒤로 자홍 → 커피 브라운
  { slug: 'soccer', name: '축구', emoji: '⚽', en: 'SOCCER', color: '#E8380D', fg: '#F6F4EE', kind: 'posts', description: '같이 할 사람 모집' },
  { slug: 'movie', name: 'AMC', emoji: '🎬', en: 'AMC', color: '#E9A300', fg: '#101010', kind: 'movie', description: 'The Odyssey 회차 맞추기' },
  { slug: 'movienight', name: '무비나잇', emoji: '🍿', en: 'MOVIE NIGHT', color: '#008542', fg: '#F6F4EE', kind: 'posts', description: '같이 영화 볼 사람 모집', titleLabel: '영화/드라마', titleSearch: 'tmdb' },
  { slug: 'pickleball', name: '피클볼', emoji: '🥒', en: 'PICKLEBALL', color: '#002FA7', fg: '#F6F4EE', kind: 'posts', description: '같이 칠 사람 모집' },
  { slug: 'bowling', name: '볼링', emoji: '🎳', en: 'BOWLING', color: '#5B2A86', fg: '#F6F4EE', kind: 'posts', description: '같이 칠 사람 모집' },
  {
    slug: 'meal',
    name: '밥친구',
    emoji: '🍚',
    en: 'MEAL',
    color: '#C2185B',
    fg: '#F6F4EE',
    kind: 'posts',
    description: '같이 밥 먹을 사람 모집',
    titleLabel: '메뉴',
    locationLabel: '식당',
    locationHint: '예: 대장금 Overland Park',
  },
  {
    slug: 'cafe',
    name: '카페 메이트',
    emoji: '☕',
    en: 'CAFE',
    color: '#6F4E37',
    fg: '#F6F4EE',
    kind: 'posts',
    description: '같이 카페 갈 사람 모집',
    locationLabel: '카페',
    locationHint: '예: 스타벅스 135th & Nall',
  },
];

/** 포스트/구독이 가능한 카테고리 슬러그 (영화 제외) */
export const POST_CATEGORY_SLUGS = CATEGORIES.filter((c) => c.kind === 'posts').map((c) => c.slug);

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}
