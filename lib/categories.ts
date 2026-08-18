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
  /**
   * 시각 대신 **날짜 범위**를 받는다 (여행).
   *
   * 여행은 「8월 5일 오전 8시」가 아니라 「8월 5일부터 9일까지」다. 켜면 만들기 화면에서
   * 시작·종료 시각 칸이 사라지고 종료 날짜 칸이 생긴다. 끝났는지도 마지막 날로 본다
   * (lib/dates.ts의 isPastSlot).
   */
  dateRange?: boolean;
  /**
   * 숙소 칸의 이름. 있으면 만들기 화면에 선택 입력이 하나 생긴다.
   *
   * location과 따로 받는다 — 여행에서 장소는 출발 전에 모이는 곳이고 숙소는 가서 머무는
   * 곳이다. 한 칸에 넣으면 출발 아침에 어디로 갈지 알 수 없다.
   */
  lodgingLabel?: Msg;
  /** 숙소 입력 placeholder에 붙는 예시 */
  lodgingHint?: Msg;
  /**
   * 사진을 **찍은 순서로 늘어놓는다** (여행).
   *
   * 켜면 올릴 때 원본에서 찍은 시각과 좌표를 읽어 저장하고(lib/exif.ts), 사진 자리에
   * 격자 대신 날짜별 타임라인이 붙는다. 며칠짜리 모임에서만 뜻이 있다 — 저녁 두 시간짜리
   * 모임은 사진이 다 같은 시각 같은 자리라 늘어놓아 봐야 격자와 다를 게 없다.
   *
   * 좌표를 남기는 카테고리를 이 깃발 하나로 묶어 두는 것이 중요하다. 어디서 찍었는지는
   * 「우리집」이라고 안 써도 그 집을 가리키는 값이라, 켠 자리에만 남긴다.
   * 거르는 것은 서버다 (app/api/posts/[id]/photos).
   */
  timeline?: boolean;
  /** 이 카테고리를 제안한 사람 — 카테고리 화면에 이름을 적어 준다 */
  proposedBy?: string;
  /**
   * 「사람이 먼저, 모임은 그다음」인 카테고리.
   *
   * 이걸 켜면 카테고리 화면에 **참가신청 명단**이 생기고, 목표 인원이 찰 때까지
   * 「모임 만들기」가 안 보인다. 번개로 시작할 수 없는 종목을 위한 것이다 —
   * 독서나눔은 혼자 날짜를 잡아 봐야 아무도 안 온다. 몇 명 있어야 굴러가는지를
   * 아는 사람이 여기 숫자를 적는다.
   *
   * terms는 신청 버튼을 눌렀을 때 띄우는 안내다. 읽고 확인을 눌러야 신청이 된다 —
   * 이 모임은 한 명이 빠지면 그날이 헐거워지는 종류라, 「몰랐다」로 시작하지 않게 한다.
   */
  signup?: {
    /** 이만큼 모여야 모임을 만들 수 있다 */
    target: number;
    /**
     * 만들어진 모임의 정원. 다 모인 뒤에도 더 들어올 수 있되 여기까지다 —
     * 책 한 권을 두고 이야기가 굴러가는 인원에는 위아래가 다 있다.
     */
    limit: number;
    terms: Msg[];
  };
  /** 카테고리 안에서 여는 도구 (무비나잇 → AMC 회차 고르기) */
  tool?: { href: string; label: Msg; desc: Msg };
  /**
   * 이 카테고리 안에서는 **아무 이름도 보이지 않는다.**
   *
   * 모임을 연 사람, 명단, 댓글이 전부 「익명」이다. 얼굴(아바타)도, 주최 횟수 뱃지도,
   * 알림 문구 속 이름도 빠진다. 켠 사람만 자기 자신을 알아본다 — 명단에서 「나」로 보이고
   * 자기가 쓴 댓글은 「이름(익명)」으로 보인다.
   *
   * 이름이 새는 통로도 함께 닫는다. 이걸 켜면 자동으로:
   *  - 정산을 열 수 없다 (금액 옆에 이름이 줄줄이 나온다)
   *  - 명단의 사람을 눌러 친구 요청을 보낼 수 없고, 친구를 대신 넣을 수도 없다
   *  - 「친구가 참가했어요」 알림이 안 나간다
   *  - 순위표(호스팅·참여) 집계에서 빠진다
   *
   * 브라우저로 내려가는 값에서도 남의 회원번호를 지운다 — 이름만 「익명」으로 바꾸고
   * id를 그대로 두면 개발자 도구로 누구인지 그대로 읽힌다.
   */
  anonymous?: true;
  /**
   * 이 카테고리 화면에서 밤하늘 소리를 깐다 (app/sky-bgm.tsx).
   * 음원이 아니라 브라우저가 만들어내는 소리라 받아오는 파일이 없다.
   */
  bgm?: true;
  /** 카드 위로 유성이 지나간다 (app/category-card.tsx + overrides.css) */
  meteors?: true;
}

/** 카테고리별로 지정하지 않았을 때 쓰는 장소 문구 */
export const DEFAULT_LOCATION_LABEL: Msg = { ko: '장소', en: 'Place', es: 'Lugar' };
export const DEFAULT_LOCATION_HINT: Msg = {
  ko: '예: Lifetime OP 피클볼 코트',
  en: 'e.g. Lifetime OP pickleball courts',
  es: 'p. ej. canchas de pickleball de Lifetime OP',
};

// 배열 순서가 곧 홈 캐러셀 노출 순서다 (카드 번호 01·02…도 여기서 나온다)
export const CATEGORIES: Category[] = [
  /*
   * 카드 색은 밝기와 채도를 한 값으로 묶는다 — OKLCH L .55 / C .13.
   *
   * 밝기를 맞추는 이유 — HSL로 맞추면 같은 숫자라도 노랑이 파랑보다 밝아 보여 따로 논다.
   * 밝기가 같으면 크림색 글씨 대비도 함께 잡힌다.
   *
   * 채도를 「낼 수 있는 만큼」 내던 것을 그만뒀다. 그러면 청록 .09, 보라 .21이 되어
   * 같은 규칙으로 만든 색인데도 카드마다 세기가 달라지고, 여러 장이 세로로 쌓이면
   * 전부가 같은 크기로 소리쳤다. .13에서 묶으면 한 가족으로 보인다.
   * (청록·올리브·초록은 sRGB 한계가 .13보다 낮아 .093~.128로 살짝 못 미친다 — 어쩔 수 없다)
   *
   * **이웃 간격은 밝기가 같은 열다섯 장 안에서 19~28°로 맞춰 둔다.**
   * 균등하게(360÷15=24°) 딱 나누지는 않는다 — 눈이 색상 변화를 구간마다 다르게 느껴서,
   * 각도를 똑같이 벌리면 오히려 청록 쪽 서너 장이 한 색으로 보인다. 숫자로 대강 나누고
   * 붙어 보이는 데만 손으로 벌린다.
   *
   * 청록(195~225°)은 sRGB가 채도를 .09까지밖에 못 낸다. 그래서 그 구간의 카드
   * (베이킹·이삿짐센터·러닝)는 다른 장보다 조금 묽다 — 색상을 아무리 벌려도 못 고친다.
   * 러닝을 241°에서 234°로 당겨 이삿짐센터와의 35° 구멍을 메웠고, 그 값이 채도를
   * .128에서 .115로 떨어뜨렸다. 구멍이 보이는 것보다는 낫다고 봤다.
   *
   * **이 배열의 순서가 곧 색상환의 순서다.** 축구(32°)에서 시작해 한 바퀴 돌아
   * 밥친구(5°=365°)로 닫힌다. 빨강에서 출발하는 것이 시작으로 읽힌다 — 분홍은 원이
   * 닫히는 자리라 거기서 시작하면 첫 장이 「돌아온 색」이 되어 어긋나 보인다. 화면은 이 순서대로 그리므로 둘러보기가 빨강→주황→초록→
   * 청록→파랑→보라→분홍으로 이어진다.
   *
   * 예전에는 그렇지 않았다. 원이 한 번 닫힌 뒤에 붙은 카드들(카페·헬스장·이사·여행·
   * 별보러가자)이 배열 맨 뒤에 쌓여서, 색은 한 체계인데 **순서가 그걸 안 따라가** 랜덤해
   * 보였다. 색을 고친 게 아니라 줄을 다시 세운 것이다.
   *
   * **새 카테고리는 맨 뒤가 아니라 제 색상 자리에 끼워 넣을 것.** 그리고 이웃과 10° 안쪽으로
   * 붙지 않게 할 것 — 붙어야 한다면 밝기가 크게 달라야 한다(여행 .76, 별보러가자 .34가
   * 그래서 이웃과 6~7°인데도 안 헷갈린다).
   */
  {
    slug: 'soccer',
    emoji: '⚽',
    en: 'SOCCER',
    color: '#B0503F',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '축구', en: 'Soccer', es: 'Fútbol' },
    description: { ko: '숨차면 걸어도 됩니다', en: 'Walk when you need to.', es: 'Camina cuando lo necesites.' },
  },
  {
    slug: 'reading',
    emoji: '📚',
    en: 'BOOK CLUB',
    // 축구(31.8°)와 테니스(120.8°) 사이 — 이 구간에서 C .13을 그대로 낼 수 있는 자리다
    color: '#AB5816',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '독서나눔', en: 'Book Club', es: 'Club de lectura' },
    // 다른 카드와 결이 다르다 — 여기만 「번개로 모여서 바로」가 안 되는 종목이라,
    // 분위기보다 어떻게 시작하는지를 먼저 알려준다
    description: { ko: '5명 모이면 책 정하고 시작', en: 'Five in, then we pick the book.', es: 'Cinco personas y elegimos libro.' },
    // 무엇을 읽는지가 곧 「갈지 말지」라서 제목 자리에 책을 받는다 (무비나잇의 영화와 같은 자리)
    titleLabel: { ko: '책', en: 'Book', es: 'Libro' },
    locationHint: { ko: '예: Kaldi’s Coffee OP', en: 'e.g. Kaldi’s Coffee OP', es: 'p. ej. Kaldi’s Coffee OP' },
    proposedBy: '정인건',
    // 다섯이면 책 한 권을 두고 이야기가 굴러간다 — 그보다 적으면 모임이 아니라 약속이다
    signup: {
      target: 5,
      limit: 7,
      terms: [
        {
          ko: '정해진 분량은 읽고 와주세요. 다들 읽어 왔다는 전제로 이야기가 굴러가요.',
          en: 'Come having read the agreed pages — the whole conversation assumes everyone did.',
          es: 'Ven con las páginas acordadas leídas: toda la conversación da por hecho que todos lo hicieron.',
        },
        {
          ko: '모임에는 되도록 빠지지 말아주세요. 다섯이 모여야 시작하는 모임이라 한 명이 비면 그날이 헐거워져요.',
          en: 'Try not to miss a session. It takes five to run, so one empty chair thins out the whole evening.',
          es: 'Intenta no faltar. Hacen falta cinco, así que una silla vacía deja floja toda la tarde.',
        },
        {
          ko: '사정이 생기면 미리 말해주세요. 늦게 말할수록 다른 사람들의 계획도 같이 흔들려요.',
          en: 'If something comes up, say so early — late notice moves everyone else’s plans too.',
          es: 'Si te surge algo, avisa pronto: avisar tarde mueve también los planes de los demás.',
        },
      ],
    },
  },
  {
    slug: 'cafe',
    emoji: '☕',
    en: 'CAFE',
    color: '#9B6400',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '카페 메이트', en: 'Café Mate', es: 'Compañero de café' },
    description: { ko: '콘센트 자리는 선착순입니다', en: 'Outlets are first come, first served.', es: 'Los enchufes son por orden de llegada.' },
    locationLabel: { ko: '카페', en: 'Café', es: 'Cafetería' },
    locationHint: { ko: '예: 스타벅스 135th & Nall', en: 'e.g. Starbucks 135th & Nall', es: 'p. ej. Starbucks 135th & Nall' },
  },
  /*
   * 여행 — 텍사스에 다녀오고 나서 열었다. 정재호 님이 색과 한 줄까지 정해 제안했다.
   *
   * 「텍사스」로 만들지 않은 이유: 다음 여행에서 또 카테고리를 만들어야 하고, 지난 것은
   * 목록에 내려야 한다. 갈 곳은 모임마다 다르니 그건 titleLabel로 받는다 — 카드에
   * 〈텍사스〉로 붙는다.
   *
   * **이 카드만 글씨가 진하다.** 받은 색(#E9A300)이 열여섯 장 중 유일하게 밝은 쪽이라
   * (OKLCH L .76, 나머지는 .55) 크림색 글씨를 얹으면 대비가 1.97:1 — 글자가 안 읽힌다.
   * 색을 어둡게 고치는 대신 글씨를 바꿨다: 제안한 사람이 고른 색이 카드의 정체고,
   * 읽히게 만드는 것은 우리 몫이다. 진한 글씨로는 7.3:1이다.
   *
   * 색상(78°)은 카페(72°)와 헬스장(96°) 사이인데, 밝기가 크게 달라 같은 색으로 안 보인다.
   */
  {
    slug: 'trip',
    emoji: '🧳',
    en: 'TRIP',
    color: '#E9A300',
    // 이 카드만 진한 글씨 — 위 주석 참고 (나머지 열다섯 장은 크림색이다)
    fg: '#1E241F',
    kind: 'posts',
    name: { ko: '여행', en: 'Trip', es: 'Viaje' },
    description: {
      ko: '현실 도피하러 떠납니다',
      en: 'Leaving reality behind for a bit.',
      es: 'Nos vamos a escapar de la realidad.',
    },
    // 여행은 하루가 아니라 며칠이다 — 시각 대신 날짜 범위를 받는다
    dateRange: true,
    // 며칠 치 사진은 찍은 순서로 늘어놓아야 어디를 어떻게 돌았는지가 보인다
    timeline: true,
    // 어디로 갔는지가 이 카드에서 제일 먼저 묻는 것이라 제목 자리에 받는다
    titleLabel: { ko: '어디로 (선택)', en: 'Where to (optional)', es: 'Adónde (opcional)' },
    titleOptions: [
      { ko: '텍사스', en: 'Texas', es: 'Texas' },
      { ko: '콜로라도', en: 'Colorado', es: 'Colorado' },
      { ko: '시카고', en: 'Chicago', es: 'Chicago' },
    ],
    locationLabel: { ko: '모이는 곳', en: 'Meeting point', es: 'Punto de encuentro' },
    locationHint: {
      ko: '예: 오버랜드파크 코스트코 주차장',
      en: 'e.g. Costco parking lot, Overland Park',
      es: 'p. ej. aparcamiento de Costco, Overland Park',
    },
    lodgingLabel: { ko: '숙소 (선택)', en: 'Where you stay (optional)', es: 'Alojamiento (opcional)' },
    lodgingHint: {
      ko: '예: 오스틴 에어비앤비',
      en: 'e.g. Airbnb in Austin',
      es: 'p. ej. Airbnb en Austin',
    },
    proposedBy: '정재호',
  },
  {
    slug: 'gym',
    emoji: '🏋️',
    en: 'GYM',
    color: '#857000',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '헬스장', en: 'Gym', es: 'Gimnasio' },
    description: { ko: '봐줄 사람 있으면 한 개 더', en: 'One more rep with a spotter.', es: 'Una repetición más si alguien te cuida.' },
    locationLabel: { ko: '헬스장', en: 'Gym', es: 'Gimnasio' },
    locationHint: { ko: '예: Lifetime Overland Park', en: 'e.g. Lifetime, Overland Park', es: 'p. ej. Lifetime, Overland Park' },
  },
  {
    slug: 'tennis',
    emoji: '🎾',
    en: 'TENNIS',
    color: '#677C05',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '테니스', en: 'Tennis', es: 'Tenis' },
    description: { ko: '같이 해뇨', en: 'Find players', es: '¿Jugamos?' },
    locationHint: { ko: '예: Harmon Park 테니스 코트', en: 'e.g. Harmon Park tennis courts', es: 'p. ej. canchas de tenis de Harmon Park' },
    proposedBy: 'sarah 예지 park',
  },
  {
    slug: 'camping',
    emoji: '🏕️',
    en: 'CAMPING',
    color: '#418337',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '캠핑', en: 'Camping', es: 'Camping' },
    description: { ko: '불멍 5분, 먹방 5시간', en: 'Five minutes of fire, five hours of food', es: 'Cinco minutos de fogata, cinco horas de comida' },
    // 캠핑장은 자리를 잡아 두고 만나므로, 사이트 번호가 곧 「어디로 오면 되는지」다
    titleLabel: { ko: '사이트 번호 (선택)', en: 'Site number (optional)', es: 'Número de parcela (opcional)' },
    locationLabel: { ko: '캠핑장', en: 'Campground', es: 'Campamento' },
    locationHint: { ko: '예: Clinton State Park', en: 'e.g. Clinton State Park', es: 'p. ej. Clinton State Park' },
    proposedBy: '정재호',
  },
  {
    slug: 'movienight',
    emoji: '🍿',
    en: 'MOVIE NIGHT',
    color: '#008759',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '무비나잇', en: 'Movie Night', es: 'Noche de cine' },
    description: { ko: '팝콘은 각자, 감상은 같이', en: 'Popcorn separately, opinions together.', es: 'Palomitas por separado, opiniones juntos.' },
    titleLabel: { ko: '영화/드라마', en: 'Movie/Show', es: 'Película o serie' },
    titleSearch: 'tmdb',
    // AMC 회차 고르기는 따로 카드를 두지 않고 여기서 연다 — 회차에서 만든 모임도
    // 어차피 무비나잇으로 들어오므로, 입구가 둘일 이유가 없다
    tool: {
      href: '/movie',
      label: { ko: 'AMC 회차 고르기', en: 'Pick AMC showtimes', es: 'Elegir funciones de AMC' },
      desc: {
        ko: 'AMC Town Center 20 상영표에서 회차를 고르면, 같은 회차를 고른 사람끼리 모임이 만들어져요.',
        en: 'Pick a showtime at AMC Town Center 20 and everyone who picked the same one becomes a meetup.',
        es: 'Elige una función en AMC Town Center 20 y quienes elijan la misma forman una quedada.',
      },
    },
  },
  {
    slug: 'baking',
    emoji: '🧁',
    en: 'BAKING',
    /* 183° — 원래 202°로 이사(206°)와 4°밖에 안 떨어져 있었다. 위 머리 주석 참고 */
    color: '#008477',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '베이킹 클래스', en: 'Baking Class', es: 'Clase de repostería' },
    description: { ko: '실패해도 먹을 수는 있습니다', en: 'Even the failures are edible.', es: 'Hasta lo que sale mal se puede comer.' },
    titleLabel: { ko: '만들 것', en: 'What we’re baking', es: 'Qué horneamos' },
    locationLabel: { ko: '장소', en: 'Place', es: 'Lugar' },
    locationHint: { ko: '예: 우리집 / OP 베이킹 스튜디오', en: 'e.g. my place / OP baking studio', es: 'p. ej. mi casa / estudio de repostería en OP' },
  },
  /*
   * 이사 — 루민 님이 색과 함께 제안했다. 「이사 도와줄 사람 찾기」다.
   *
   * 이 카테고리만 성격이 다르다. 나머지 열여섯은 **같이 놀 사람**을 찾는 자리인데
   * 여기는 **부탁하는 자리**다. 그래서 한 줄을 「재밌어요」가 아니라 「힘 안 들어요」
   * 쪽으로 적는다 — 부탁받은 쪽이 망설이는 지점이 거기다.
   *
   * 색: 받은 값 그대로다 (#00838F). 베이킹(#038189)과 거의 같은 청록이라 캐러셀에서
   * 나란히 놓이면 구분이 어렵다. 제안한 사람이 고른 색이 카드의 정체라 바꾸지 않고 두되,
   * 이 사실은 적어 둔다 — 바꾸기로 하면 여기 한 줄이다.
   * 크림색 글씨로 대비 4.11:1이라 우리가 지키는 4.5에 조금 못 미친다. 진한 글씨는
   * 3.50이라 더 나쁘다 — 둘 중 나은 쪽을 쓴다.
   */
  {
    slug: 'moving',
    emoji: '📦',
    en: 'MOVING',
    color: '#00838F',
    fg: '#F6F4EE',
    kind: 'posts',
    /*
     * 이름이 농담이다 — 친구 몇을 이삿짐센터라고 부른다. 「이사」는 사건의 이름이지만
     * 이건 **와 주는 사람들**의 이름이라, 부탁하는 자리의 무게가 한결 가벼워진다.
     * 밥친구·카페 메이트와 같은 결이다.
     *
     * 캐러셀 라벨(en: MOVING)은 안 바꾼다. 그 자리는 언제나 종목 이름이다 —
     * 밥친구가 MEAL이고 카페 메이트가 CAFE인 것과 같다.
     */
    name: { ko: '이삿짐센터', en: 'Moving Crew', es: 'Mudanzas' },
    description: {
      ko: '무거운 것도 넷이 들면 가벼워요',
      en: 'Heavy things get light with four people.',
      es: 'Lo pesado pesa poco entre cuatro.',
    },
    locationLabel: { ko: '짐 있는 곳', en: 'Where the stuff is', es: 'Dónde están las cosas' },
    /* 만들기 화면이 이 문구를 괄호로 감싼다 — 여기 또 괄호를 쓰면 괄호가 겹쳐 나온다 */
    locationHint: {
      ko: '예: 오버랜드파크 아파트 3층',
      en: 'e.g. Overland Park apartment, 3rd floor',
      es: 'p. ej. apartamento en Overland Park, 3.º piso',
    },
    /*
     * 도착지. **lodging 칸을 빌려 쓴다** — DB 이름은 숙소지만 실제로는 「두 번째 장소」다.
     * 여행에서 모이는 곳/숙소가 갈리는 것과 같은 자리이고, 이사에서는 출발지/도착지다.
     * 칸을 새로 만들면 스키마가 하나 늘고 두 칸 중 하나는 언제나 비어 있게 된다.
     */
    lodgingLabel: { ko: '이사 갈 곳 (선택)', en: 'Where it’s going (optional)', es: 'Adónde va (opcional)' },
    lodgingHint: {
      ko: '예: 레넥사 타운홈',
      en: 'e.g. townhome in Lenexa',
      es: 'p. ej. casa adosada en Lenexa',
    },
    proposedBy: '루민',
  },
  {
    slug: 'running',
    emoji: '🏃',
    en: 'RUNNING',
    color: '#007BAA',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '러닝 크루', en: 'Running Crew', es: 'Grupo de running' },
    description: { ko: '이 날씨에 러닝 크루 제안은 좀..', en: 'Who suggested this category in this weather?', es: '¿Quién propuso esto con este clima?' },
    locationHint: { ko: '예: Indian Creek Trail', en: 'e.g. Indian Creek Trail', es: 'p. ej. Indian Creek Trail' },
    proposedBy: '지유',
  },
  {
    slug: 'pickleball',
    emoji: '🥒',
    en: 'PICKLEBALL',
    color: '#4270BC',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '피클볼', en: 'Pickleball', es: 'Pickleball' },
    description: { ko: '다들 그렇게 시작했답니다', en: 'Everyone started that way.', es: 'Todos empezamos así.' },
  },
  /*
   * 일식 하루짜리 카드. 끝나면 관리자 화면에서 목록에 내린다 (지우지 않는다 —
   * 그날 찍은 사진과 댓글은 그대로 남는다).
   *
   * 색만 이 카드가 위의 규칙에서 벗어난다. 열네 장이 OKLCH L .55 / C .13 한 가족으로
   * 묶여 있는데 색상환이 이미 꽉 차서, 어디에 끼워 넣어도 옆 카드와 같은 색으로 보인다.
   * 그래서 밝기를 내려(L .34) 밤하늘 쪽으로 뺐다 — 한 번 열고 내릴 카드가 가족처럼
   * 보이지 않는 편이 오히려 맞다. 크림색 글씨 대비는 11:1이다.
   */
  {
    slug: 'stargazing',
    emoji: '🌌',
    en: 'STARS',
    color: '#292F6F',
    fg: '#F6F4EE',
    kind: 'posts',
    anonymous: true,
    bgm: true,
    meteors: true,
    name: { ko: '별보러가자', en: 'Chasing the Stars', es: 'Ver las estrellas' },
    description: {
      ko: '일식 하루만 열어요 · 여기선 모두 익명이에요',
      en: 'Open for eclipse day only — everyone here is anonymous.',
      es: 'Solo el día del eclipse: aquí todos van en anónimo.',
    },
    locationLabel: { ko: '볼 곳', en: 'Viewing spot', es: 'Sitio para verlo' },
    locationHint: {
      ko: '예: 클린턴 호수 주차장',
      en: 'e.g. Clinton Lake parking lot',
      es: 'p. ej. aparcamiento de Clinton Lake',
    },
  },
  {
    slug: 'game',
    emoji: '🎮',
    en: 'GAME',
    color: '#6765BB',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '게임', en: 'Game', es: 'Videojuegos' },
    description: { ko: '듀오 구합니다', en: 'Looking for a duo.', es: 'Busco dúo.' },
    titleLabel: { ko: '게임', en: 'Game', es: 'Juego' },
    titleOptions: [
      { ko: '리그 오브 레전드', en: 'League of Legends', es: 'League of Legends' },
      { ko: '오버워치', en: 'Overwatch', es: 'Overwatch' },
    ],
    // 온라인으로 모이는 일이 많아 "장소"가 꼭 물리적인 곳은 아니다
    locationLabel: { ko: '어디서', en: 'Where', es: 'Dónde' },
    locationHint: { ko: '예: 디스코드 / 우리집', en: 'e.g. Discord / my place', es: 'p. ej. Discord / mi casa' },
    proposedBy: '라민 야말',
  },
  {
    slug: 'bowling',
    emoji: '🎳',
    en: 'BOWLING',
    color: '#885AAB',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '볼링', en: 'Bowling', es: 'Bolos' },
    description: { ko: '양말만 챙겨 오세요', en: 'Just bring socks.', es: 'Solo trae calcetines.' },
  },
  {
    slug: 'birthday',
    emoji: '🎂',
    en: 'BIRTHDAY',
    color: '#A0508D',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '생일파티', en: 'Birthday Party', es: 'Cumpleaños' },
    description: { ko: '많을수록 좋은 자리니까요', en: 'The more, the better.', es: 'Cuantos más, mejor.' },
    // 생일 모임에서 제일 먼저 알아야 할 건 누구 생일인가다
    titleLabel: { ko: '누구 생일', en: 'Whose birthday', es: 'De quién es el cumple' },
    locationHint: { ko: '예: 우리집 / 대장금 Overland Park', en: 'e.g. my place / Dae Jang Geum, Overland Park', es: 'p. ej. mi casa / Dae Jang Geum, Overland Park' },
    proposedBy: '박진욱',
  },
  {
    slug: 'meal',
    emoji: '🍚',
    en: 'MEAL',
    color: '#AE4C67',
    fg: '#F6F4EE',
    kind: 'posts',
    name: { ko: '밥친구', en: 'Meal Buddy', es: 'Compañero de comida' },
    description: { ko: '혼밥도 좋지만 오늘은 말고', en: 'Solo dining, but not tonight.', es: 'Comer solo está bien, pero hoy no.' },
    titleLabel: { ko: '메뉴', en: 'Menu', es: 'Menú' },
    locationLabel: { ko: '식당', en: 'Restaurant', es: 'Restaurante' },
    locationHint: { ko: '예: 대장금 Overland Park', en: 'e.g. Dae Jang Geum, Overland Park', es: 'p. ej. Dae Jang Geum, Overland Park' },
  },
];

/** 이름이 하나도 안 보이는 카테고리 — 여러 곳에서 물어보므로 한 줄로 둔다 */
export function isAnonymous(slug: string): boolean {
  return getCategory(slug)?.anonymous === true;
}

/** 순위 집계에서 통째로 빼는 데 쓴다 (질의 안에서 쓰려면 목록이 필요하다) */
export const ANONYMOUS_SLUGS = CATEGORIES.filter((c) => c.anonymous).map((c) => c.slug);

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
