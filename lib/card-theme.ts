/**
 * 카테고리 카드의 색 테마.
 *
 * 테마는 **색 몇 개를 고정점으로 박고 그 사이를 채우는 것**이다. 첫 카드가 첫 색, 마지막
 * 카드가 마지막 색이고, 가운데 색들은 사이사이 카드에 하나씩 떨어진다. 열일곱 장이면
 * 1·6·12·17번째가 받은 색 그대로고 나머지 열셋은 그 사이를 잇는다.
 *
 * 색을 그냥 돌려 쓰지 않는 이유: 카테고리가 열일곱인데 색이 넷이면 같은 색이 네 번씩
 * 돌아온다. 사이를 채우면 넷의 톤을 지키면서 열일곱을 다 구분되게 둘 수 있다.
 *
 * 배열 순서가 곧 그라데이션의 순서다. lib/categories.ts가 이미 색상환 순으로 서 있어서
 * (거기 머리 주석 참고) 이 그라데이션도 그 줄을 그대로 탄다.
 */

import { CATEGORIES } from './categories';
import { Msg } from './i18n';

export const CARD_THEME_COOKIE = 'card-theme';
export const CARD_THEME_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * 미리보기 전용 쿠키.
 *
 * **경로를 /preview로 박아 둔다.** 그래서 이 쿠키는 미리보기 화면을 부를 때만 딸려
 * 가고 나머지 화면에는 아예 전달되지 않는다 — 안 산 테마를 미리 본다고 앱 전체가
 * 그 테마로 바뀌면 그건 미리보기가 아니라 그냥 주는 것이다.
 *
 * 잠깐만 살아 있으면 된다. 창을 닫고 나서까지 남을 이유가 없다.
 */
export const PREVIEW_COOKIE = 'preview-theme';
export const PREVIEW_MAX_AGE = 300;

/**
 * 미리보기 홈에 세울 카드.
 *
 * 진짜 홈은 그 사람의 즐겨찾기나 다가오는 모임에 따라 카드가 매번 다르다. 테마를 보러
 * 온 자리에서 그러면 사람마다 다른 것을 보게 되고, 즐겨찾기가 하나뿐인 사람은 카드
 * 한 장으로 테마를 판단하게 된다.
 *
 * 이 셋을 고른 이유는 **색 순서에서 멀리 떨어져 있어서**다 — lib/categories.ts의 차례로
 * 1·8·12번째라, 그라데이션의 앞·가운데·끝이 한 화면에 같이 잡힌다.
 */
export const PREVIEW_CARDS = ['soccer', 'movienight', 'pickleball'];


export type CardTheme =
  | 'default'
  | 'wildflowers'
  | 'lushforest'
  | 'mossyhollow'
  | 'chocolate'
  | 'inkwash'
  | 'blueeclipse'
  | 'goldentaupe'
  | 'cherryblossom'
  | 'rainyseason'
  | 'winter'
  | 'autumn';

/**
 * 시즌 테마만 갖는 값.
 *
 * 색 테마 일곱 개는 카드 색만 바꾸므로 이 필드가 없다. 시즌 테마는 바탕·글씨·강조색·
 * 곡률·서체·아이콘 굵기까지 바꾸기 때문에 카드 색과 같은 자리에서 한 번에 정한다.
 *
 * 여기 있는 값은 화면에 심을 CSS 변수와 일대일이다 (cardThemeCss 참고).
 */
export interface SeasonTokens {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  borderSoft: string;
  text: string;
  textMid: string;
  textDim: string;
  accent: string;
  accentDark: string;
  accentSoft: string;
  r: string;
  rSm: string;
  /**
   * 카드 네 귀퉁이의 곡률. 네 방향이 달라서 --r과 따로 둔다 — 벚꽃은 아래가
   * 평평해지며 가장자리가 살아나고(꽃잎 물결이 거기 얹힌다), 장마는 위가 처마처럼
   * 각지고 아래는 물이 고인 듯 둥글다.
   */
  cardR: string;
  tabbarR: string;
  iconStroke: string;
  /** app/layout.tsx가 심는 next/font 변수 이름 (--font-dodum / --font-batang) */
  font: 'dodum' | 'batang';
  /** 배경 장식 종류 — app/season-deco.tsx가 읽는다 */
  deco: 'petal' | 'rain' | 'snow' | 'leaf';
}

export interface CardThemeDef {
  label: Msg;
  note: Msg;
  /**
   * 고정점. null이면 카테고리가 들고 있는 색을 그대로 쓴다 (기본 테마).
   * 두 개 이상이면 몇 개든 된다 — 카드 수에 맞춰 자리를 잡고 사이를 채운다.
   *
   * **어두운 쪽에서 밝은 쪽으로 적는다.** 받은 팔레트는 대개 순서가 뒤죽박죽인데
   * (「Lush forest」는 진초록 다음이 거의 흰색이다) 그대로 두면 열일곱 장이 밝았다
   * 어두웠다를 두 번 오간다. 첫 카드가 제일 진하고 내려갈수록 옅어진다.
   * 와일드플라워만 예외다 — 거기는 어느 색이 몇 번째인지를 직접 지정받았다.
   */
  stops: string[] | null;
  /** 시즌 테마만 갖는다. 없으면 카드 색만 바뀌는 테마다. */
  tokens?: SeasonTokens;
}

/*
 * **적은 순서가 곧 화면 순서다.** 관리자 화면의 선택기(app/admin/page.tsx)가
 * Object.keys를 그대로 쓰고, 프로필의 선택기도 이 순서로 줄을 세운다.
 *
 * 색 테마 여덟이 먼저, 시즌 테마 넷이 뒤다. 시즌은 봄·여름·가을·겨울 차례로 둔다 —
 * 만든 차례(벚꽃·장마·겨울·가을)로 두면 겨울과 가을이 뒤바뀌어 있다.
 */
export const CARD_THEMES: Record<CardTheme, CardThemeDef> = {
  default: {
    label: { ko: '기본', en: 'Default', es: 'Predeterminado' },
    note: {
      ko: '진한 바탕에 크림색 글씨. 지금까지 쓰던 색이에요.',
      en: 'Deep colors with cream text — what we’ve been using.',
      es: 'Colores intensos con texto crema, lo de siempre.',
    },
    stops: null,
  },
  // 와일드플라워 — 받은 순서 그대로다 (「첫 카드는 #a8dcab, 마지막은 #be91be」)
  wildflowers: {
    label: { ko: '와일드플라워', en: 'Wildflowers', es: 'Flores silvestres' },
    note: {
      ko: '연초록에서 시작해 진초록·장미빛을 거쳐 연보라로 끝나요. 받은 네 색이 1·6·12·17번째 카드에 그대로 있고 사이는 이어 채웠어요.',
      en: 'Starts pale green, passes through deep green and rose, ends in mauve. The four given colors land on cards 1, 6, 12 and 17; the rest fill the gaps.',
      es: 'Empieza en verde claro, pasa por verde intenso y rosa, y acaba en malva.',
    },
    stops: ['#A8DCAB', '#519755', '#DBAAA7', '#BE91BE'],
  },
  lushforest: {
    label: { ko: '깊은 숲', en: 'Lush forest', es: 'Bosque frondoso' },
    note: {
      ko: '짙은 전나무색에서 시작해 연둣빛으로 올라가요.',
      en: 'Starts in deep fir and rises to pale mint.',
      es: 'Empieza en abeto oscuro y sube hasta menta pálida.',
    },
    stops: ['#253D2C', '#2E6F40', '#68BA7F', '#CFFFDC'],
  },
  mossyhollow: {
    label: { ko: '이끼 골짜기', en: 'Mossy hollow', es: 'Hondonada de musgo' },
    note: {
      ko: '짙은 이끼색에서 올리브를 지나 연한 풀빛으로.',
      en: 'Dark moss through olive into pale grass.',
      es: 'Musgo oscuro, oliva y verde claro.',
    },
    stops: ['#3D4127', '#636B2F', '#BAC095', '#D4DE95'],
  },
  chocolate: {
    label: { ko: '초콜릿', en: 'Chocolate truffle', es: 'Trufa de chocolate' },
    note: {
      ko: '다크 초콜릿에서 캐러멜을 지나 크림색으로. 폭이 제일 넓은 테마예요.',
      en: 'Dark chocolate through caramel into cream — the widest range of the set.',
      es: 'De chocolate negro a caramelo y crema.',
    },
    stops: ['#38240D', '#713600', '#C05800', '#FDFBD4'],
  },
  inkwash: {
    label: { ko: '수묵', en: 'Ink wash', es: 'Aguada de tinta' },
    note: {
      ko: '먹색에서 회색을 지나 아이보리로. 색이 제일 얌전해요.',
      en: 'Charcoal through grey into ivory — the quietest of the set.',
      es: 'De carbón a gris y marfil, el más sobrio.',
    },
    stops: ['#4A4A4A', '#6D8196', '#CBCBCB', '#FFFFE3'],
  },
  goldentaupe: {
    label: { ko: '금빛 모래', en: 'Golden taupe', es: 'Topo dorado' },
    note: {
      ko: '캐러멜에서 금빛과 카키를 지나 크림으로. 처음부터 끝까지 밝은 테마예요.',
      en: 'Caramel through gold and khaki into cream — light from first card to last.',
      es: 'De caramelo a oro y caqui, y termina en crema.',
    },
    /*
     * 받은 넷 중 가운데 둘(#D4AF37 금빛, #BDB76B 카키)이 밝기가 .767로 똑같다. 그래서
     * 그 구간은 밝기가 아니라 채도만 움직인다 — 제일 진한 금빛에서 물이 빠지듯 카키로
     * 간다. 순서를 뒤집어 카키를 먼저 두면 채도가 내려갔다 올라갔다 해서 그 흐름이 끊긴다.
     */
    stops: ['#CE8946', '#D4AF37', '#BDB76B', '#FDFBD4'],
  },
  blueeclipse: {
    label: { ko: '푸른 밤', en: 'Blue eclipse', es: 'Eclipse azul' },
    note: {
      ko: '자정에 가까운 남색에서 연보랏빛 남색으로. 처음부터 끝까지 어두운 테마예요.',
      en: 'Near-midnight navy up to lilac-blue — dark from first card to last.',
      es: 'De azul casi medianoche a azul lila, oscuro de principio a fin.',
    },
    stops: ['#0F0E47', '#272757', '#505081', '#8686AC'],
  },
  /*
   * ── 시즌 테마 ─────────────────────────────────────────────────────
   * 색만 바꾸는 위쪽 테마들과 달리 화면 전체가 바뀐다. 관리자가 켜고 끄는 것으로만
   * 바뀌고 자동 만료는 없다.
   */
  cherryblossom: {
    label: { ko: '봄 · 벚꽃', en: 'Spring · Cherry blossom', es: 'Primavera · Cerezo' },
    note: {
      ko: '연분홍 바탕에 꽃잎이 내려앉는 테마. 서체도 고운돋움으로 바뀌어요.',
      en: 'Pale pink with drifting petals; type switches to Gowun Dodum.',
      es: 'Rosa pálido con pétalos que caen; la tipografía cambia a Gowun Dodum.',
    },
    stops: ['#8A3149', '#C9647E', '#E5A6B6', '#C7D2A6'],
    tokens: {
      bg: '#F7F2F4',
      surface: '#FFFFFF',
      surface2: '#F6E4EA',
      border: '#EADEE2',
      borderSoft: '#F3E9EC',
      text: '#241B1E',
      textMid: '#5C5259',
      textDim: '#8E8189',
      /*
       * 글자와 면에 같은 값을 쓴다. 시안의 밝은 분홍(#C9647E)은 흰 글자와 3.7:1이라
       * 버튼 면에 쓸 수 없어서 한 단 어두운 값을 골랐다.
       */
      accent: '#A8455F',
      accentDark: '#8A3149',
      accentSoft: '#F6E4EA',
      r: '20px',
      rSm: '14px',
      cardR: '20px 20px 4px 4px',
      tabbarR: '26px',
      iconStroke: '1.5',
      font: 'dodum',
      deco: 'petal',
    },
  },
  rainyseason: {
    label: { ko: '여름 · 장마', en: 'Summer · Rainy season', es: 'Verano · Temporada de lluvias' },
    note: {
      ko: '비 오는 창밖 같은 청회색 테마. 서체도 고운바탕으로 바뀌어요.',
      en: 'Slate blue like a rainy window; type switches to Gowun Batang.',
      es: 'Azul pizarra de ventana lluviosa; la tipografía cambia a Gowun Batang.',
    },
    stops: ['#1F3D4A', '#2F5D6B', '#3D6875', '#9FB6C0'],
    tokens: {
      bg: '#E6EAEC',
      surface: '#F4F7F8',
      surface2: '#E0EAEE',
      border: '#D5DDE1',
      borderSoft: '#E4EBEE',
      text: '#1B2529',
      textMid: '#54636A',
      textDim: '#7C888D',
      accent: '#2E5C6E',
      accentDark: '#1F3D4A',
      accentSoft: '#E0EAEE',
      r: '18px',
      rSm: '12px',
      cardR: '3px 3px 22px 22px',
      tabbarR: '26px',
      iconStroke: '1.2',
      font: 'batang',
      deco: 'rain',
    },
  },
  autumn: {
    label: { ko: '가을 · 단풍', en: 'Autumn · Fall leaves', es: 'Otoño · Hojas' },
    note: {
      ko: '저녁 숲 같은 짙은 초록 테마. 제목만 금색이고, 낙엽 그림이 화면 앞으로 떨어져요.',
      en: 'Deep evening-forest green; only the titles are gold, and drawn leaves fall in front of the cards.',
      es: 'Verde bosque al atardecer; solo los títulos son dorados y caen hojas dibujadas por delante.',
    },
    /*
     * 시안(19d)은 어두운 초록 **하나**다. 그런데 카드가 열일곱 장이라 한 색으로 고정하면
     * 카테고리를 색으로 구별할 수 없다 — 색이 곧 이름표인 화면이다. 그래서 계단을 저녁
     * 숲 쪽으로 옮겼다: 짙은 침엽수 → 이끼 → 올리브 → 금색. 앞의 둘이 시안의 색이다.
     * 마지막 금색 카드는 밝아서 글자가 자동으로 어두워진다 (아래 textOn).
     */
    stops: ['#2A3320', '#3F4E2E', '#6E6B22', '#C9A227'],
    tokens: {
      bg: '#F6F1E7',
      surface: '#FFFBF3',
      surface2: '#EFE7D6',
      border: '#E2DAC6',
      borderSoft: '#F1EADC',
      text: '#242A1C',
      textMid: '#5F6653',
      textDim: '#8A9079',
      accent: '#3F4E2E',
      accentDark: '#2A3320',
      accentSoft: '#E8EBDC',
      r: '18px',
      rSm: '14px',
      /* 네 귀퉁이가 같다 — 벚꽃·장마와 달리 잎 모양 곡률을 안 쓴다 */
      cardR: '18px',
      tabbarR: '16px',
      iconStroke: '1.6',
      font: 'batang',
      deco: 'leaf',
    },
  },
  winter: {
    label: { ko: '겨울 · 눈', en: 'Winter · Snow', es: 'Invierno · Nieve' },
    note: {
      ko: '눈 쌓인 아침 같은 청회색 테마. 눈송이가 결정 모양으로 내리고, 카드 위 가장자리에 실제로 쌓여요.',
      en: 'Slate blue like a snowed-in morning; the flakes fall as drawn crystals and actually pile up on each card’s top edge.',
      es: 'Azul pizarra de mañana nevada; los copos caen dibujados como cristales y se acumulan en el borde superior de cada tarjeta.',
    },
    stops: ['#3D5878', '#6E88A6', '#9CB4C8', '#CFDCE6'],
    tokens: {
      bg: '#EEF2F6',
      surface: '#FFFFFF',
      surface2: '#E3EAF2',
      border: '#D8E0E9',
      borderSoft: '#E8EDF3',
      text: '#1F2733',
      textMid: '#5A6672',
      textDim: '#7C8994',
      accent: '#3D5878',
      accentDark: '#2C4159',
      accentSoft: '#E3EAF2',
      r: '13px',
      rSm: '9px',
      cardR: '13px',
      tabbarR: '16px',
      iconStroke: '1.8',
      /* 시안이 500이라 했는데 이 프로젝트의 시즌 서체는 둘뿐이다 — 획이 가는 쪽을 쓴다 */
      font: 'dodum',
      deco: 'snow',
    },
  },
};

export function toCardTheme(v: string | undefined): CardTheme {
  /*
   * 겨울 v2를 걸어 두었던 쿠키를 겨울로 받아 준다.
   *
   * v2는 결정 눈을 시험하던 관리자 전용 테마였고, 그대로 겨울이 됐다. 이름이 없어졌다고
   * 기본 테마로 튕기면 걸어 두었던 사람은 「테마가 풀렸다」로 읽는다. 한 줄로 끝나는
   * 일이라 남겨 둔다 — 걸었던 사람이 다시 고르면 이 줄은 그때 지워도 된다.
   */
  if (v === 'winter2') return 'winter';
  return v != null && v in CARD_THEMES ? (v as CardTheme) : 'default';
}

/* ── 색 섞기 ──────────────────────────────────────────────────────────
   OKLab에서 섞는다. sRGB에서 그냥 반씩 더하면 중간이 탁해진다 — 초록과 분홍
   사이가 진흙색이 되는 그 현상이다. OKLab은 눈이 느끼는 대로 이어져서
   중간 색도 두 끝과 같은 가족으로 보인다. */

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

type Lab = [number, number, number];

function hexToLab(hex: string): Lab {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function labToHex([L, a, b]: Lab): string {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  /*
   * 두 끝이 화면 안의 색이면 그 사이도 대개 안에 있지만, 아주 살짝 넘칠 수 있다.
   * 그때는 채널을 잘라 낸다 — 몇 천분의 일이라 눈에 안 띈다.
   */
  return (
    '#' +
    rgb
      .map((v) => Math.max(0, Math.min(255, Math.round(toSrgb(v) * 255))).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * 고정점을 카드에 박고 사이를 채운다.
 *
 * 고정점 자리는 반올림해서 **실제 카드 하나**에 떨어뜨린다. 소수 자리에 두면 받은 색이
 * 어느 카드에도 안 나타나고 「이 색을 쓴다」가 말뿐이 된다.
 */
function ramp(stops: string[], n: number): string[] {
  if (n === 0) return [];
  if (n === 1 || stops.length === 1) return Array.from({ length: n }, () => stops[0]!);
  const lab = stops.map(hexToLab);
  const at = stops.map((_, k) => Math.round((k * (n - 1)) / (stops.length - 1)));
  return Array.from({ length: n }, (_, i) => {
    let k = 0;
    while (k < at.length - 2 && at[k + 1]! <= i) k++;
    const span = at[k + 1]! - at[k]!;
    const f = span === 0 ? 0 : (i - at[k]!) / span;
    return labToHex(lab[k]!.map((v, j) => v + (lab[k + 1]![j]! - v) * f) as Lab);
  });
}

/** 어두운 카드 위의 글씨 — 앱이 이미 쓰는 크림색 */
const TEXT_CREAM = '#F6F4EE';
/** WCAG 명암비 */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, b2] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b2!;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * 밝은 카드 위의 글씨 — **그 카드 색을 어둡게 내린 것.** 검정이 아니다.
 *
 * 파스텔 카드에 #101010을 얹으면 읽히기는 하는데 화면이 딱딱해진다. 연둣빛 카드 위의
 * 새까만 글씨는 카드와 아무 관계가 없는 색이라 글자만 도려낸 것처럼 뜬다. 색상(a·b)은
 * 그대로 두고 밝기만 내리면 민트 위에는 짙은 전나무색이, 장미빛 위에는 짙은 밤색이,
 * 연보라 위에는 짙은 자두색이 앉는다 — 읽히는 정도는 같은데 훨씬 부드럽다.
 *
 * **고정된 대비가 아니라 고정된 밝기 차로 내린다.** 「7:1이 될 때까지 내린다」로 해 봤더니
 * 원래 좀 어두운 카드(#519755 같은)에서는 끝까지 내려도 못 닿아서 결국 새까매졌다 —
 * 부드럽게 만들려고 넣은 규칙이 정작 제일 딱딱한 카드를 만든다. 밝기 차를 고정하면
 * 어느 카드에서나 같은 만큼만 어두워진다.
 *
 * .45는 재서 골랐다. .40이면 흐리게 깔리는 설명 줄(opacity .8)이 3.2까지 내려가고,
 * .50이면 색이 거의 검정이 된다. .45에서 제목이 5.2~6.2:1, 설명이 3.8~4.3:1로,
 * 기본 테마가 지금 내는 값(설명 3.7:1)보다 낫다.
 *
 * 아주 밝은 카드(「수묵」의 #FFFFE3)는 .45만 내려도 회색빛이라 최소 대비를 따로 건다.
 */
const DARK_TEXT_DROP = 0.45;
const DARK_TEXT_MIN = 5;
function darkTextOn(bg: string): string {
  const [L, a, b] = hexToLab(bg);
  let dark = labToHex([Math.max(0.12, L - DARK_TEXT_DROP), a, b]);
  for (let l = L - DARK_TEXT_DROP; l >= 0.12 && contrast(dark, bg) < DARK_TEXT_MIN; l -= 0.004) {
    dark = labToHex([l, a, b]);
  }
  return dark;
}

/**
 * 카드 위 글씨는 **카드마다 따로** 고른다.
 *
 * 테마 하나에 글씨 한 색으로는 안 된다. 「초콜릿」은 크림(#FDFBD4)에서 시작해 다크
 * 초콜릿(#38240D)으로 끝나는데, 그 두 장을 한 색으로 덮을 방법이 없다 — 위를 살리면
 * 아래가 죽는다. 두 후보 중 더 잘 보이는 쪽을 카드마다 고르면 이 문제가 사라지고,
 * 색을 몇 개 더 늘려도 다시 안 걸린다.
 *
 * **비슷하면 크림 쪽으로 기운다.** 「초콜릿」의 #C05800은 어두운 쪽과 크림이 사실상
 * 동점인데, 그냥 큰 쪽을 고르면 그 카드만 어두운 글씨가 되고 바로 아래 거의 같은
 * 주황색 카드는 크림 글씨가 된다 — 붙어 있는 두 장이 이유 없이 달라 보인다. 진짜로
 * 밝은 카드에서만 어두운 글씨가 나오게 15% 차이를 요구한다.
 */
const DARK_TEXT_MARGIN = 1.15;
function textOn(bg: string): string {
  const dark = darkTextOn(bg);
  return contrast(bg, dark) >= contrast(bg, TEXT_CREAM) * DARK_TEXT_MARGIN ? dark : TEXT_CREAM;
}

/**
 * 그 테마에서 카테고리마다 쓸 바탕색·글씨색.
 *
 * **테두리는 안 두른다.** 페이지 바탕에 묻히는 밝은 카드에 한 올 둘러 봤는데, 그 조건에
 * 걸리는 것이 대개 첫 한두 장이라 그 카드만 선이 생기고 아래는 없다 — 묻히는 것보다
 * 저 혼자 다르게 생긴 것이 더 눈에 걸린다. 아주 밝은 색을 고르면 카드 경계가 흐려지는
 * 것은 그 팔레트의 성질로 두는 편이 낫다.
 */
export function cardColors(theme: CardTheme): { slug: string; color: string; fg: string }[] {
  const def = CARD_THEMES[theme];
  if (!def.stops) return CATEGORIES.map((c) => ({ slug: c.slug, color: c.color, fg: c.fg }));
  const colors = ramp(def.stops, CATEGORIES.length);
  return CATEGORIES.map((c, i) => ({ slug: c.slug, color: colors[i]!, fg: textOn(colors[i]!) }));
}

/**
 * 화면에 심을 CSS 변수 한 덩어리.
 *
 * 색을 쓰는 자리가 일곱 군데인데 다 클라이언트 컴포넌트라, 테마를 prop으로 실어 나르려면
 * 트리를 통째로 건드려야 한다. 변수로 두면 레이아웃 한 곳에서 정하고 쓰는 쪽은 그대로다.
 */
export function cardThemeCss(theme: CardTheme): string {
  /*
   * --lit은 「이 카드 글씨가 크림인가」다 (1이면 크림, 0이면 어두운 글씨).
   *
   * 색이 아니라 0/1인 이유는 무슨 색을 쓸지는 테마가 정하기 때문이다. 단풍은 어두운
   * 카드의 제목만 금색으로 올리는데(app/season-autumn.css), 금색 카드에까지 금색을
   * 얹으면 제목이 바탕에 묻힌다 — 열일곱 장 중 넷이 그렇다. CSS는 변수 「값」을 보고
   * 갈라질 수 없으므로, 갈라질 거리를 여기서 숫자로 넘긴다.
   */
  const vars = cardColors(theme)
    .map((c) => `--cat-${c.slug}:${c.color};--cat-${c.slug}-fg:${c.fg};--cat-${c.slug}-lit:${c.fg === TEXT_CREAM ? 1 : 0}`)
    .join(';');
  const t = CARD_THEMES[theme].tokens;
  /*
   * 시즌 서체는 앞에 세우고 Plex를 뒤에 남긴다 — 고운돋움·고운바탕에 없는 글자
   * (기호·라틴 일부)는 Plex가 받는다.
   */
  const sans = t
    ? `var(--font-${t.font}), var(--font-sans), 'IBM Plex Sans KR', sans-serif`
    : `var(--font-sans), 'IBM Plex Sans KR', sans-serif`;
  const season = t
    ? [
        `--bg:${t.bg}`,
        `--surface:${t.surface}`,
        `--surface-2:${t.surface2}`,
        `--border:${t.border}`,
        `--border-soft:${t.borderSoft}`,
        `--text:${t.text}`,
        `--text-mid:${t.textMid}`,
        `--text-dim:${t.textDim}`,
        `--accent:${t.accent}`,
        `--accent-dark:${t.accentDark}`,
        `--accent-soft:${t.accentSoft}`,
        `--r:${t.r}`,
        `--r-sm:${t.rSm}`,
        `--card-r:${t.cardR}`,
        `--tabbar-r:${t.tabbarR}`,
        `--icon-stroke:${t.iconStroke}`,
      ].join(';')
    : '';
  /*
   * **:root이 아니라 html:root이다.**
   *
   * 이 이름들은 이미 임자가 있다 — globals.css와 color-8f.css가 색 열하나를 각각
   * :root에 정의하고, --r/--r-sm은 globals.css, --sans는 font-plex.css에 있다.
   * 같은 명시도끼리는 나중에 오는 쪽이 이기는데, 이 <style>이 import된 CSS보다
   * 앞인지 뒤인지는 Next가 정하는 일이라 우리가 기댈 수 없다.
   *
   * html:root은 (0,1,1)이라 그 :root들(0,1,0)을 순서와 무관하게 이긴다. 덕분에
   * CSS 파일은 한 줄도 고치지 않는다. 이름을 --kk-bg로 바꾸는 쪽은 쓰는 자리를
   * 전부 따라 고쳐야 해서 접었다.
   *
   * overrides.css의 .sky-scope.night은 (0,2,0)이라 여기서도 이긴다 — 밤 화면으로
   * 들어간 모임은 시즌 테마와 무관하게 밤색으로 남는다. 그게 맞다.
   */
  return `html:root{${vars};--sans:${sans}${season ? ';' + season : ''}}`;
}

/** 상단 바 색 — manifest.ts와 layout.tsx의 meta가 같이 읽는다 */
export function themeBarColor(theme: CardTheme): string {
  return CARD_THEMES[theme].tokens?.bg ?? '#F7F6F2';
}

/** 배경 장식 종류. 색만 바꾸는 테마는 null. */
export function themeDeco(theme: CardTheme): 'petal' | 'rain' | 'snow' | 'leaf' | null {
  return CARD_THEMES[theme].tokens?.deco ?? null;
}
