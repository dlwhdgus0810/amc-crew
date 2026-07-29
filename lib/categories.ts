import { Locale, Msg, pick } from './i18n';

export interface Category {
  slug: string;
  emoji: string; // 알림 문구에 붙는 이모지
  en: string; // 캐러셀 라벨 (언어와 무관한 대문자 표기)
  color: string; // 카테고리 시그니처 컬러
  fg: string; // 컬러 위 텍스트 색
  kind: 'movie' | 'posts';
  name: Msg;
  description: Msg;
  /** 설정하면 모임 만들기에 선택 입력이 하나 생긴다 (예: 영화/드라마, 메뉴) */
  titleLabel?: Msg;
  /** titleLabel 입력에 TMDB 자동완성을 붙인다 (영화/드라마 전용) */
  titleSearch?: 'tmdb';
  /** 장소 입력의 이름 (미지정이면 '장소') — 예: 식당, 카페 */
  locationLabel?: Msg;
  /** 장소 입력 placeholder에 붙는 예시 문구 */
  locationHint?: Msg;
}

/** 카테고리별로 지정하지 않았을 때 쓰는 장소 문구 */
export const DEFAULT_LOCATION_LABEL: Msg = { ko: '장소', en: 'Place' };
export const DEFAULT_LOCATION_HINT: Msg = {
  ko: '예: Lifetime OP 피클볼 코트',
  en: 'e.g. Lifetime OP pickleball courts',
};

// 배열 순서가 곧 홈 캐러셀 노출 순서다 (카드 번호 01·02…도 여기서 나온다)
export const CATEGORIES: Category[] = [
  // 색은 노출 순서대로 빨강 → 노랑 → 초록 → 파랑 → 보라, 그 뒤로 자홍 → 커피 브라운
  {
    slug: 'soccer',
    emoji: '⚽',
    en: 'SOCCER',
    color: '#E8380D',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '축구', en: 'Soccer' },
    description: { ko: '같이 할 사람 모집', en: 'Find players' },
  },
  {
    slug: 'movie',
    emoji: '🎬',
    en: 'AMC',
    color: '#E9A300',
    fg: '#101010',
    kind: 'movie',
    name: { ko: 'AMC', en: 'AMC' },
    description: { ko: '영화 회차 맞추기 (AMC Town Center 20)', en: 'Match movie showtimes (AMC Town Center 20)' },
  },
  {
    slug: 'movienight',
    emoji: '🍿',
    en: 'MOVIE NIGHT',
    color: '#008542',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '무비나잇', en: 'Movie Night' },
    description: { ko: '같이 영화 볼 사람 모집', en: 'Find people for a movie night' },
    titleLabel: { ko: '영화/드라마', en: 'Movie/Show' },
    titleSearch: 'tmdb',
  },
  {
    slug: 'pickleball',
    emoji: '🥒',
    en: 'PICKLEBALL',
    color: '#002FA7',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '피클볼', en: 'Pickleball' },
    description: { ko: '같이 칠 사람 모집', en: 'Find players' },
  },
  {
    slug: 'bowling',
    emoji: '🎳',
    en: 'BOWLING',
    color: '#5B2A86',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '볼링', en: 'Bowling' },
    description: { ko: '같이 칠 사람 모집', en: 'Find bowlers' },
  },
  {
    slug: 'meal',
    emoji: '🍚',
    en: 'MEAL',
    color: '#C2185B',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '밥친구', en: 'Meal Buddy' },
    description: { ko: '같이 밥 먹을 사람 모집', en: 'Find people to eat with' },
    titleLabel: { ko: '메뉴', en: 'Menu' },
    locationLabel: { ko: '식당', en: 'Restaurant' },
    locationHint: { ko: '예: 대장금 Overland Park', en: 'e.g. Dae Jang Geum, Overland Park' },
  },
  {
    slug: 'cafe',
    emoji: '☕',
    en: 'CAFE',
    color: '#6F4E37',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '카페 메이트', en: 'Café Mate' },
    description: { ko: '같이 카페 갈 사람 모집', en: 'Find a café buddy' },
    locationLabel: { ko: '카페', en: 'Café' },
    locationHint: { ko: '예: 스타벅스 135th & Nall', en: 'e.g. Starbucks 135th & Nall' },
  },
  {
    slug: 'baking',
    emoji: '🧁',
    en: 'BAKING',
    color: '#00838F',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '베이킹 클래스', en: 'Baking Class' },
    description: { ko: '같이 구울 사람 모집', en: 'Find people to bake with' },
    titleLabel: { ko: '만들 것', en: 'What we’re baking' },
    locationLabel: { ko: '장소', en: 'Place' },
    locationHint: { ko: '예: 우리집 / OP 베이킹 스튜디오', en: 'e.g. my place / OP baking studio' },
  },
  {
    slug: 'gym',
    emoji: '🏋️',
    en: 'GYM',
    color: '#455A64',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '헬스장', en: 'Gym' },
    description: { ko: '같이 운동할 사람 모집', en: 'Find a workout buddy' },
    locationLabel: { ko: '헬스장', en: 'Gym' },
    locationHint: { ko: '예: Lifetime Overland Park', en: 'e.g. Lifetime, Overland Park' },
  },
  {
    slug: 'tennis',
    emoji: '🎾',
    en: 'TENNIS',
    color: '#827717',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '테니스', en: 'Tennis' },
    description: { ko: '같이 칠 사람 모집', en: 'Find players' },
    locationHint: { ko: '예: Harmon Park 테니스 코트', en: 'e.g. Harmon Park tennis courts' },
  },
];

/** 포스트/구독이 가능한 카테고리 슬러그 (영화 제외) */
export const POST_CATEGORY_SLUGS = CATEGORIES.filter((c) => c.kind === 'posts').map((c) => c.slug);

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** 알림·메타데이터처럼 문자열이 바로 필요한 곳에서 쓰는 카테고리 이름 */
export function catName(slug: string, locale: Locale): string {
  const cat = getCategory(slug);
  return cat ? pick(locale, cat.name) : slug;
}

/** 이미 있는 카테고리 이름인지 (제안 중복 검사 — 두 언어 모두 본다) */
export function isExistingCategoryName(input: string): boolean {
  const v = input.trim().toLowerCase();
  return CATEGORIES.some(
    (c) => c.slug === v || c.name.ko.toLowerCase() === v || c.name.en.toLowerCase() === v
  );
}
