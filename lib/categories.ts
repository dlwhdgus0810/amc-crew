import {Locale, Msg, pick} from './i18n';

export interface Category {
  slug: string;
  emoji: string; // 알림 문구에 붙는 이모지
  en: string; // 캐러셀 라벨 (언어와 무관한 대문자 표기)
  color: string; // 카테고리 시그니처 컬러
  fg: string; // 컬러 위 텍스트 색
  kind: 'movie' | 'posts';
  name: Msg;
  /**
   * 카드 부제목 (app/category-card.tsx 한 곳에서만 쓴다 — 알림·카톡으로는 안 나간다).
   *
   * 「~할 사람 모집」으로 통일하지 않는다. 열두 장이 같은 꼴이면 눈이 건너뛰어서
   * 아무것도 안 읽힌다. 그 종목에만 할 수 있는 말을 한 줄 적되, 되도록
   * 「못해도 된다」 쪽으로 — 이 앱에 처음 들어온 사람이 제일 걱정하는 게 그거다.
   */
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
  /*
   * 카드 색은 밝기와 채도를 13색 전부 한 값으로 묶는다 — OKLCH L .55 / C .13.
   * 색상(hue)은 예전 값을 그대로 물려받았다(빨강 31.8° … 분홍 336.9°).
   *
   * 밝기를 맞추는 이유 — HSL로 맞추면 같은 숫자라도 노랑이 파랑보다 밝아 보여 따로 논다.
   * 밝기가 같으면 크림색 글씨 대비도 함께 잡힌다.
   *
   * 채도를 「낼 수 있는 만큼」 내던 것을 그만뒀다. 그러면 청록 .09, 보라 .21이 되어
   * 같은 규칙으로 만든 색인데도 카드마다 세기가 달라지고, 열세 장이 세로로 쌓이면
   * 전부가 같은 크기로 소리쳤다. .13에서 묶으면 한 가족으로 보인다.
   * (청록·올리브·초록은 sRGB 한계가 .13보다 낮아 .093~.128로 살짝 못 미친다 — 어쩔 수 없다)
   *
   * 색상은 각도가 아니라 「눈에 보이는 거리」로 벌린다. 배열 순서가 곧 색상환 순서다
   * (빨강에서 시작해 한 바퀴 돌아 분홍으로 돌아온다). 카테고리를 더할 때는 그 자리를 지키고,
   * 채도는 위의 .13을 그대로 쓸 것 — 하나만 더 내면 그 카드만 튄다.
   */
  {
    slug: 'soccer',
    emoji: '⚽',
    en: 'SOCCER',
    color: '#B0503F',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '축구', en: 'Soccer' },
    description: { ko: '숨차면 걸어도 됩니다', en: 'Walk when you need to.' },
  },
  {
    slug: 'reading',
    emoji: '📚',
    en: 'BOOK CLUB',
    // 축구(31.8°)와 테니스(120.8°) 사이 — 이 구간에서 C .13을 그대로 낼 수 있는 자리다
    color: '#AA5910',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '독서모임', en: 'Book Club' },
    description: { ko: '읽은 만큼만 말하면 됩니다', en: 'Say as much as you read.' },
    // 무엇을 읽는지가 곧 「갈지 말지」라서 제목 자리에 책을 받는다 (무비나잇의 영화와 같은 자리)
    titleLabel: { ko: '책 (선택)', en: 'Book (optional)' },
    locationHint: { ko: '예: Kaldi’s Coffee OP', en: 'e.g. Kaldi’s Coffee OP' },
    proposedBy: '정인건',
  },
  {
    slug: 'tennis',
    emoji: '🎾',
    en: 'TENNIS',
    color: '#677C05',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '테니스', en: 'Tennis' },
    description: { ko: '같이 해뇨', en: 'Find players' },
    locationHint: { ko: '예: Harmon Park 테니스 코트', en: 'e.g. Harmon Park tennis courts' },
    proposedBy: 'sarah 예지 park',
  },
  {
    slug: 'camping',
    emoji: '🏕️',
    en: 'CAMPING',
    color: '#3D843A',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '캠핑', en: 'Camping' },
    description: { ko: '불멍 5분, 먹방 5시간', en: 'Five minutes of fire, five hours of food' },
    // 캠핑장은 자리를 잡아 두고 만나므로, 사이트 번호가 곧 「어디로 오면 되는지」다
    titleLabel: { ko: '사이트 번호 (선택)', en: 'Site number (optional)' },
    locationLabel: { ko: '캠핑장', en: 'Campground' },
    locationHint: { ko: '예: Clinton State Park', en: 'e.g. Clinton State Park' },
    proposedBy: '정재호',
  },
  {
    slug: 'movienight',
    emoji: '🍿',
    en: 'MOVIE NIGHT',
    color: '#008759',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '무비나잇', en: 'Movie Night' },
    description: { ko: '팝콘은 각자, 감상은 같이', en: 'Popcorn separately, opinions together.' },
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
    color: '#038189',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '베이킹 클래스', en: 'Baking Class' },
    description: { ko: '실패해도 먹을 수는 있습니다', en: 'Even the failures are edible.' },
    titleLabel: { ko: '만들 것', en: 'What we’re baking' },
    locationLabel: { ko: '장소', en: 'Place' },
    locationHint: { ko: '예: 우리집 / OP 베이킹 스튜디오', en: 'e.g. my place / OP baking studio' },
  },
  {
    slug: 'running',
    emoji: '🏃',
    en: 'RUNNING',
    color: '#0179B5',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '러닝 크루', en: 'Running Crew' },
    description: { ko: '이 날씨에 러닝 크루 제안은 좀..', en: 'Who suggested this category in this weather?' },
    locationHint: { ko: '예: Indian Creek Trail', en: 'e.g. Indian Creek Trail' },
    proposedBy: '지유',
  },
  {
    slug: 'pickleball',
    emoji: '🥒',
    en: 'PICKLEBALL',
    color: '#4270BC',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '피클볼', en: 'Pickleball' },
    description: { ko: '다들 그렇게 시작했답니다', en: 'Everyone started that way.' },
  },
  {
    slug: 'game',
    emoji: '🎮',
    en: 'GAME',
    color: '#6765BB',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '게임', en: 'Game' },
    description: { ko: '듀오 구합니다', en: 'Looking for a duo.' },
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
    color: '#885AAB',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '볼링', en: 'Bowling' },
    description: { ko: '양말만 챙겨 오세요', en: 'Just bring socks.' },
  },
  {
    slug: 'birthday',
    emoji: '🎂',
    en: 'BIRTHDAY',
    color: '#A0508D',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '생일파티', en: 'Birthday Party' },
    description: { ko: '많을수록 좋은 자리니까요', en: 'The more, the better.' },
    // 생일 모임에서 제일 먼저 알아야 할 건 누구 생일인가다
    titleLabel: { ko: '누구 생일', en: 'Whose birthday' },
    locationHint: { ko: '예: 우리집 / 대장금 Overland Park', en: 'e.g. my place / Dae Jang Geum, Overland Park' },
    proposedBy: '박진욱',
  },
  {
    slug: 'meal',
    emoji: '🍚',
    en: 'MEAL',
    color: '#AE4C67',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '밥친구', en: 'Meal Buddy' },
    description: { ko: '혼밥도 좋지만 오늘은 말고', en: 'Solo dining, but not tonight.' },
    titleLabel: { ko: '메뉴', en: 'Menu' },
    locationLabel: { ko: '식당', en: 'Restaurant' },
    locationHint: { ko: '예: 대장금 Overland Park', en: 'e.g. Dae Jang Geum, Overland Park' },
  },
  {
    slug: 'cafe',
    emoji: '☕',
    en: 'CAFE',
    color: '#AB571C',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '카페 메이트', en: 'Café Mate' },
    description: { ko: '콘센트 자리는 선착순입니다', en: 'Outlets are first come, first served.' },
    locationLabel: { ko: '카페', en: 'Café' },
    locationHint: { ko: '예: 스타벅스 135th & Nall', en: 'e.g. Starbucks 135th & Nall' },
  },
  {
    slug: 'gym',
    emoji: '🏋️',
    en: 'GYM',
    color: '#906B03',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '헬스장', en: 'Gym' },
    description: { ko: '봐줄 사람 있으면 한 개 더', en: 'One more rep with a spotter.' },
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
