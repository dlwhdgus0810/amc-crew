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

export type CardTheme =
  | 'default'
  | 'wildflowers'
  | 'lushforest'
  | 'mossyhollow'
  | 'chocolate'
  | 'inkwash'
  | 'blueeclipse';

export interface CardThemeDef {
  label: Msg;
  note: Msg;
  /**
   * 고정점. null이면 카테고리가 들고 있는 색을 그대로 쓴다 (기본 테마).
   * 두 개 이상이면 몇 개든 된다 — 카드 수에 맞춰 자리를 잡고 사이를 채운다.
   *
   * **밝은 쪽에서 어두운 쪽으로 적는다.** 받은 팔레트는 대개 순서가 뒤죽박죽인데
   * (「Lush forest」는 진초록 다음이 거의 흰색이다) 그대로 두면 열일곱 장이 밝았다
   * 어두웠다를 두 번 오간다. 와일드플라워만 예외다 — 거기는 어느 색이 몇 번째인지를
   * 직접 지정받았다.
   */
  stops: string[] | null;
}

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
      ko: '연둣빛에서 시작해 짙은 전나무색으로 내려가요.',
      en: 'Starts in pale mint and descends into deep fir.',
      es: 'Empieza en menta pálida y baja hasta abeto oscuro.',
    },
    stops: ['#CFFFDC', '#68BA7F', '#2E6F40', '#253D2C'],
  },
  mossyhollow: {
    label: { ko: '이끼 골짜기', en: 'Mossy hollow', es: 'Hondonada de musgo' },
    note: {
      ko: '연한 풀빛에서 올리브를 지나 짙은 이끼색으로.',
      en: 'Pale grass through olive into dark moss.',
      es: 'Verde claro, oliva y musgo oscuro.',
    },
    stops: ['#D4DE95', '#BAC095', '#636B2F', '#3D4127'],
  },
  chocolate: {
    label: { ko: '초콜릿', en: 'Chocolate truffle', es: 'Trufa de chocolate' },
    note: {
      ko: '크림색에서 캐러멜을 지나 다크 초콜릿으로. 폭이 제일 넓은 테마예요.',
      en: 'Cream through caramel into dark chocolate — the widest range of the set.',
      es: 'De crema a caramelo y chocolate negro.',
    },
    stops: ['#FDFBD4', '#C05800', '#713600', '#38240D'],
  },
  inkwash: {
    label: { ko: '수묵', en: 'Ink wash', es: 'Aguada de tinta' },
    note: {
      ko: '아이보리에서 회색을 지나 먹색으로. 색이 제일 얌전해요.',
      en: 'Ivory through grey into charcoal — the quietest of the set.',
      es: 'De marfil a gris y carbón, el más sobrio.',
    },
    stops: ['#FFFFE3', '#CBCBCB', '#6D8196', '#4A4A4A'],
  },
  blueeclipse: {
    label: { ko: '푸른 밤', en: 'Blue eclipse', es: 'Eclipse azul' },
    note: {
      ko: '연보랏빛 남색에서 자정에 가까운 남색으로. 처음부터 끝까지 어두운 테마예요.',
      en: 'Lilac-blue down to near-midnight navy — dark from first card to last.',
      es: 'De azul lila a azul casi medianoche, oscuro de principio a fin.',
    },
    stops: ['#8686AC', '#505081', '#272757', '#0F0E47'],
  },
};

export function toCardTheme(v: string | undefined): CardTheme {
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

/** 본문색과 크림 — 카드 위 글씨는 이 둘 중 하나다 (앱이 이미 쓰는 두 색이라 새로 안 만든다) */
const TEXT_DARK = '#101010';
const TEXT_CREAM = '#F6F4EE';
/** 페이지 바탕 (globals.css의 --bg) — 카드가 여기 묻히는지 재는 데 쓴다 */
const PAGE_BG = '#F7F6F2';

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
 * 카드 위 글씨는 **카드마다 따로** 고른다.
 *
 * 테마 하나에 글씨 한 색으로는 안 된다. 「초콜릿」은 크림(#FDFBD4)에서 시작해 다크
 * 초콜릿(#38240D)으로 끝나는데, 그 두 장을 한 색으로 덮을 방법이 없다 — 위를 살리면
 * 아래가 죽는다. 두 후보 중 더 잘 보이는 쪽을 카드마다 고르면 이 문제가 사라지고,
 * 색을 몇 개 더 늘려도 다시 안 걸린다.
 *
 * 와일드플라워는 이렇게 골라도 열일곱 장이 전부 #101010이라 예전과 같다.
 *
 * **비슷하면 크림 쪽으로 기운다.** 「초콜릿」의 #C05800은 검정 4.19:1, 크림 4.15:1로
 * 사실상 동점인데, 그냥 큰 쪽을 고르면 그 카드만 검은 글씨가 되고 바로 아래 거의 같은
 * 주황색 카드는 크림 글씨가 된다 — 붙어 있는 두 장이 이유 없이 달라 보인다. 진짜로
 * 밝은 카드에서만 검은 글씨가 나오게 15% 차이를 요구한다.
 */
const DARK_TEXT_MARGIN = 1.15;
function textOn(bg: string): string {
  return contrast(bg, TEXT_DARK) >= contrast(bg, TEXT_CREAM) * DARK_TEXT_MARGIN ? TEXT_DARK : TEXT_CREAM;
}

/**
 * 페이지 바탕에 묻히는 카드에만 두르는 실선.
 *
 * 「수묵」의 첫 색은 #FFFFE3다. 페이지 바탕(#F7F6F2)과 대비가 1.06:1이라 카드가 아니라
 * 그냥 글자 몇 줄이 떠 있는 것처럼 보인다 — 받은 팔레트에 아이보리와 연둣빛이 흔해서
 * 다섯 테마 중 셋이 여기 걸린다.
 *
 * 어두운 카드에는 안 두른다 (null). 안 그러면 원래 멀쩡하던 기본 테마까지 테두리가 생긴다.
 * 선 색은 그 카드 색을 눌러서 만든다 — 회색 선을 두르면 어느 테마에도 안 속한 줄이 생긴다.
 */
const EDGE_NEEDED_BELOW = 1.6;
function edgeFor(bg: string): string | null {
  if (contrast(bg, PAGE_BG) >= EDGE_NEEDED_BELOW) return null;
  const [L, a, b] = hexToLab(bg);
  return labToHex([Math.max(0, L - 0.14), a, b]);
}

/** 그 테마에서 카테고리마다 쓸 바탕색·글씨색, 그리고 필요하면 테두리색 */
export function cardColors(theme: CardTheme): { slug: string; color: string; fg: string; edge: string | null }[] {
  const def = CARD_THEMES[theme];
  if (!def.stops) {
    return CATEGORIES.map((c) => ({ slug: c.slug, color: c.color, fg: c.fg, edge: edgeFor(c.color) }));
  }
  const colors = ramp(def.stops, CATEGORIES.length);
  return CATEGORIES.map((c, i) => ({
    slug: c.slug,
    color: colors[i]!,
    fg: textOn(colors[i]!),
    edge: edgeFor(colors[i]!),
  }));
}

/**
 * 화면에 심을 CSS 변수 한 덩어리.
 *
 * 색을 쓰는 자리가 일곱 군데인데 다 클라이언트 컴포넌트라, 테마를 prop으로 실어 나르려면
 * 트리를 통째로 건드려야 한다. 변수로 두면 레이아웃 한 곳에서 정하고 쓰는 쪽은 그대로다.
 */
export function cardThemeCss(theme: CardTheme): string {
  const vars = cardColors(theme)
    .map(
      (c) =>
        `--cat-${c.slug}:${c.color};--cat-${c.slug}-fg:${c.fg};--cat-${c.slug}-edge:${c.edge ?? 'transparent'}`
    )
    .join(';');
  return `:root{${vars}}`;
}
