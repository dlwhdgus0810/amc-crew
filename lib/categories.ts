import {Locale, Msg, pick} from './i18n';

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
  /**
   * titleLabel 입력 위에 띄우는 보기 — 누르면 채워지고, 직접 입력도 그대로 된다.
   * 자주 나오는 답을 한 번에 고르게 하는 것뿐이라 여기 없는 걸 적어도 아무 문제 없다.
   */
  titleOptions?: Msg[];
  /** 장소 입력의 이름 (미지정이면 '장소') — 예: 식당, 카페 */
  locationLabel?: Msg;
  /** 장소 입력 placeholder에 붙는 예시 문구 */
  locationHint?: Msg;
  /** 이 카테고리를 제안한 사람 — 카테고리 화면에 이름을 적어 준다 */
  proposedBy?: string;
  /** 카테고리 안에서 여는 도구 (무비나잇 → AMC 회차 고르기) */
  tool?: { href: string; label: Msg; desc: Msg };
}

/** 카테고리별로 지정하지 않았을 때 쓰는 장소 문구 */
export const DEFAULT_LOCATION_LABEL: Msg = { ko: '장소', en: 'Place' };
export const DEFAULT_LOCATION_HINT: Msg = {
  ko: '예: Lifetime OP 피클볼 코트',
  en: 'e.g. Lifetime OP pickleball courts',
};

// 배열 순서가 곧 홈 캐러셀 노출 순서다 (카드 번호 01·02…도 여기서 나온다)
export const CATEGORIES: Category[] = [
  // 카드 색은 이 순서대로 색상환을 한 바퀴 돈다:
  //   빨강 → 연두 → 초록 → 청록 → 파랑 → 보라 → 자홍
  // 그 뒤에 채도가 낮은 둘(커피 브라운·아이언 그레이)을 둔다 — 무지개 중간에 끼면 흐름이 끊긴다.
  // 카테고리를 더할 때는 색상 각도를 재서 맞는 자리에 끼워 넣을 것.
  {
    slug: 'soccer',
    emoji: '⚽',
    en: 'SOCCER',
    color: '#C13D34',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '축구', en: 'Soccer' },
    description: { ko: '같이 할 사람 모집', en: 'Find players' },
  },
  {
    slug: 'tennis',
    emoji: '🎾',
    en: 'TENNIS',
    color: '#448502',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '테니스', en: 'Tennis' },
    description: { ko: '같이 해뇨', en: 'Find players' },
    locationHint: { ko: '예: Harmon Park 테니스 코트', en: 'e.g. Harmon Park tennis courts' },
    proposedBy: 'sarah 예지 park',
  },
  {
    slug: 'movienight',
    emoji: '🍿',
    en: 'MOVIE NIGHT',
    color: '#04884D',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '무비나잇', en: 'Movie Night' },
    description: { ko: '같이 영화 볼 사람 모집', en: 'Find people for a movie night' },
    titleLabel: { ko: '영화/드라마', en: 'Movie/Show' },
    titleSearch: 'tmdb',
    // AMC 회차 고르기는 따로 카드를 두지 않고 여기서 연다 — 회차에서 만든 모임도
    // 어차피 무비나잇으로 들어오므로, 입구가 둘일 이유가 없다
    tool: {
      href: '/movie',
      label: { ko: 'AMC 회차 고르기', en: 'Pick AMC showtimes' },
      desc: {
        ko: 'AMC Town Center 20 상영표에서 회차를 고르면, 같은 회차를 고른 사람끼리 모임이 만들어져요.',
        en: 'Pick a showtime at AMC Town Center 20 and everyone who picked the same one becomes a meetup.',
      },
    },
  },
  {
    slug: 'baking',
    emoji: '🧁',
    en: 'BAKING',
    color: '#138282',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '베이킹 클래스', en: 'Baking Class' },
    description: { ko: '같이 구울 사람 모집', en: 'Find people to bake with' },
    titleLabel: { ko: '만들 것', en: 'What we’re baking' },
    locationLabel: { ko: '장소', en: 'Place' },
    locationHint: { ko: '예: 우리집 / OP 베이킹 스튜디오', en: 'e.g. my place / OP baking studio' },
  },
  {
    slug: 'running',
    emoji: '🏃',
    en: 'RUNNING',
    color: '#127D9D',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '러닝 크루', en: 'Running Crew' },
    description: { ko: '러닝 같이 가요', en: 'Run together' },
    locationHint: { ko: '예: Indian Creek Trail', en: 'e.g. Indian Creek Trail' },
    proposedBy: '지유',
  },
  {
    slug: 'pickleball',
    emoji: '🥒',
    en: 'PICKLEBALL',
    color: '#2F6DD3',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '피클볼', en: 'Pickleball' },
    description: { ko: '같이 칠 사람 모집', en: 'Find players' },
  },
  {
    slug: 'game',
    emoji: '🎮',
    en: 'GAME',
    color: '#6260D1',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '게임', en: 'Game' },
    description: { ko: '같이 협곡에 놀 사람', en: 'Find people to play with' },
    titleLabel: { ko: '게임', en: 'Game' },
    titleOptions: [
      { ko: '리그 오브 레전드', en: 'League of Legends' },
      { ko: '오버워치', en: 'Overwatch' },
    ],
    // 온라인으로 모이는 일이 많아 "장소"가 꼭 물리적인 곳은 아니다
    locationLabel: { ko: '어디서', en: 'Where' },
    locationHint: { ko: '예: 디스코드 / 우리집', en: 'e.g. Discord / my place' },
    proposedBy: '라민 야말',
  },
  {
    slug: 'bowling',
    emoji: '🎳',
    en: 'BOWLING',
    color: '#904EBA',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '볼링', en: 'Bowling' },
    description: { ko: '같이 칠 사람 모집', en: 'Find bowlers' },
  },
  {
    slug: 'birthday',
    emoji: '🎂',
    en: 'BIRTHDAY',
    color: '#B53C7F',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '생일파티', en: 'Birthday Party' },
    description: { ko: '같이 축하해줄 사람 모집', en: 'Find people to celebrate with' },
    // 생일 모임에서 제일 먼저 알아야 할 건 누구 생일인가다
    titleLabel: { ko: '누구 생일', en: 'Whose birthday' },
    locationHint: { ko: '예: 우리집 / 대장금 Overland Park', en: 'e.g. my place / Dae Jang Geum, Overland Park' },
    proposedBy: '박진욱',
  },
  {
    slug: 'meal',
    emoji: '🍚',
    en: 'MEAL',
    color: '#BD3964',
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
    color: '#A75C00',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '카페 메이트', en: 'Café Mate' },
    description: { ko: '같이 카페 갈 사람 모집', en: 'Find a café buddy' },
    locationLabel: { ko: '카페', en: 'Café' },
    locationHint: { ko: '예: 스타벅스 135th & Nall', en: 'e.g. Starbucks 135th & Nall' },
  },
  {
    slug: 'gym',
    emoji: '🏋️',
    en: 'GYM',
    color: '#0274C7',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '헬스장', en: 'Gym' },
    description: { ko: '같이 운동할 사람 모집', en: 'Find a workout buddy' },
    locationLabel: { ko: '헬스장', en: 'Gym' },
    locationHint: { ko: '예: Lifetime Overland Park', en: 'e.g. Lifetime, Overland Park' },
  },
];

/** 포스트/구독이 가능한 카테고리 슬러그 (영화 제외) */
export const POST_CATEGORY_SLUGS = CATEGORIES.filter((c) => c.kind === 'posts').map((c) => c.slug);

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

/** 알림·메타데이터처럼 문자열이 바로 필요한 곳에서 쓰는 카테고리 이름 (이모지 없음) */
export function catName(slug: string, locale: Locale): string {
  const cat = getCategory(slug);
  return cat ? pick(locale, cat.name) : slug;
}

/*
 * 이모지는 name에 넣지 않고 emoji 필드 하나로만 둔다.
 * 이름 문자열에 섞어 넣으면 알림 문구(`${emoji} ${catName}`)에서 두 번 찍힌다 —
 * 실제로 테니스가 "🎾 테니스 🎾 새 모임"으로 나가고 있었다.
 */
const DISPLAY_NAMES = new Map<string, Msg>(CATEGORIES.map((c) => [c.slug, c.name]));

/**
 * 화면에 띄우는 이름.
 *
 * 예전에는 이모지를 뒤에 붙였는데, 기기마다 그림이 달라 같은 화면이 사람마다 다르게 보였다.
 * 지금은 이름만 주고 그림은 app/cat-icon.tsx의 선 아이콘이 맡는다.
 * (알림 문구의 이모지는 그대로다 — 카톡·푸시로 나가는 글자라 그림을 넣을 수 없다)
 */
export function catDisplayName(slug: string): Msg {
  return DISPLAY_NAMES.get(slug) ?? { ko: slug, en: slug };
}

/** 이미 있는 카테고리 이름인지 (제안 중복 검사 — 두 언어 모두 본다) */
export function isExistingCategoryName(input: string): boolean {
  const v = input.trim().toLowerCase();
  return CATEGORIES.some(
    (c) => c.slug === v || c.name.ko.toLowerCase() === v || c.name.en.toLowerCase() === v
  );
}
