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

export type CardTheme = 'default' | 'wildflowers';

export interface CardThemeDef {
  label: Msg;
  note: Msg;
  /**
   * 고정점. null이면 카테고리가 들고 있는 색을 그대로 쓴다 (기본 테마).
   * 두 개 이상이면 몇 개든 된다 — 카드 수에 맞춰 자리를 잡고 사이를 채운다.
   */
  stops: string[] | null;
  /** 카드 위 글씨. 고정점마다 밝기가 달라서 한 색으로 다 덮을 수 있는 값을 골라야 한다 */
  fg: string | null;
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
    fg: null,
  },
  /*
   * 와일드플라워.
   *
   * 글씨를 #101010으로 둔 이유: 고정점 넷의 밝기가 .61~.85로 벌어져 있어서 제일 어두운
   * #519755가 문제가 된다. 크림은 3.23:1, 카드에서 쓰던 진한 색(#1E241F)은 4.45:1로
   * 둘 다 4.5에 못 미친다. 본문색 #101010이면 거기서 5.35:1, 제일 밝은 칸에서 12.22:1이다.
   */
  wildflowers: {
    label: { ko: '와일드플라워', en: 'Wildflowers', es: 'Flores silvestres' },
    note: {
      ko: '연초록에서 시작해 진초록·장미빛을 거쳐 연보라로 끝나요. 받은 네 색이 1·6·12·17번째 카드에 그대로 있고 사이는 이어 채웠어요.',
      en: 'Starts pale green, passes through deep green and rose, ends in mauve. The four given colors land on cards 1, 6, 12 and 17; the rest fill the gaps.',
      es: 'Empieza en verde claro, pasa por verde intenso y rosa, y acaba en malva.',
    },
    stops: ['#A8DCAB', '#519755', '#DBAAA7', '#BE91BE'],
    fg: '#101010',
  },
};

export function toCardTheme(v: string | undefined): CardTheme {
  return v === 'wildflowers' ? 'wildflowers' : 'default';
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

/** 그 테마에서 카테고리마다 쓸 바탕색·글씨색 */
export function cardColors(theme: CardTheme): { slug: string; color: string; fg: string }[] {
  const def = CARD_THEMES[theme];
  if (!def.stops || !def.fg) return CATEGORIES.map((c) => ({ slug: c.slug, color: c.color, fg: c.fg }));
  const colors = ramp(def.stops, CATEGORIES.length);
  return CATEGORIES.map((c, i) => ({ slug: c.slug, color: colors[i]!, fg: def.fg! }));
}

/**
 * 화면에 심을 CSS 변수 한 덩어리.
 *
 * 색을 쓰는 자리가 일곱 군데인데 다 클라이언트 컴포넌트라, 테마를 prop으로 실어 나르려면
 * 트리를 통째로 건드려야 한다. 변수로 두면 레이아웃 한 곳에서 정하고 쓰는 쪽은 그대로다.
 */
export function cardThemeCss(theme: CardTheme): string {
  const vars = cardColors(theme)
    .map((c) => `--cat-${c.slug}:${c.color};--cat-${c.slug}-fg:${c.fg}`)
    .join(';');
  return `:root{${vars}}`;
}
