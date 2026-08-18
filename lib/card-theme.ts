/**
 * 카테고리 카드의 색 테마.
 *
 * 테마는 **색 열일곱 개를 새로 정하는 것이 아니라 (밝기·채도·글씨색) 셋을 갈아 끼우는
 * 것**이다. 색상(hue)은 카테고리가 이미 갖고 있는 값을 그대로 쓴다 — 축구가 빨강이고
 * 볼링이 보라인 것은 어느 테마에서든 그대로여야 하고(사람들이 그렇게 알아본다), 그래야
 * 나중에 색상 간격을 손봐도 테마가 알아서 따라온다.
 *
 * 그래서 여기에 하드코딩된 색은 하나도 없다. lib/categories.ts의 색에서 색상만 뽑아
 * 새 밝기·채도로 다시 만든다.
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
   * null이면 카테고리가 들고 있는 색을 그대로 쓴다 (기본 테마).
   * 값이 있으면 그 밝기·채도로 다시 만든다 — 색상은 카테고리 것을 물려받는다.
   */
  L: number | null;
  C: number | null;
  /** 카드 위 글씨. 밝은 테마는 진한 글씨라야 읽힌다 */
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
    L: null,
    C: null,
    fg: null,
  },
  /*
   * 와일드플라워 — 받은 네 색(#A8DCAB #519755 #DBAAA7 #BE91BE)의 톤을 그대로 옮긴 것이다.
   * 재 보니 밝기 .61~.85, 채도 .058~.121에 흩어져 있었다. 열일곱 장을 한 가족으로 보이게
   * 하려면 한 값으로 묶어야 해서(기본 테마와 같은 규칙) 그 안쪽인 .78 / .085를 골랐다.
   *
   * 네 색을 그대로 돌려 쓰지 않는 이유: 카테고리가 열일곱인데 네 색이면 같은 색이 네 번씩
   * 돌아온다. 톤을 옮기는 쪽이 「와일드플라워 같다」를 지키면서 열일곱을 구분되게 둔다.
   *
   * 이 밝기에서는 크림색 글씨가 1.88:1로 안 읽힌다. 진한 글씨는 7.6~8.2:1이다.
   */
  wildflowers: {
    label: { ko: '와일드플라워', en: 'Wildflowers', es: 'Flores silvestres' },
    note: {
      ko: '연한 파스텔에 진한 글씨. 밝기와 채도만 낮춘 거라 축구는 그대로 빨강 계열이에요.',
      en: 'Soft pastels with dark text. Only lightness and saturation change — soccer is still in the red family.',
      es: 'Pasteles suaves con texto oscuro. Solo cambian luminosidad y saturación.',
    },
    L: 0.78,
    C: 0.085,
    fg: '#1E241F',
  },
};

export function toCardTheme(v: string | undefined): CardTheme {
  return v === 'wildflowers' ? 'wildflowers' : 'default';
}

/* ── OKLCH ↔ sRGB ────────────────────────────────────────────────────
   같은 밝기로 묶으려면 OKLCH여야 한다. HSL로 맞추면 같은 숫자라도 노랑이 파랑보다
   밝아 보여 카드마다 따로 논다 (lib/categories.ts 머리 주석과 같은 이유). */

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** #RRGGBB → 색상 각도 (0~360). 테마가 물려받는 유일한 값이다 */
function hueOf(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => toLinear(parseInt(hex.slice(i, i + 2), 16) / 255));
  const l = Math.cbrt(0.4122214708 * r! + 0.5363325363 * g! + 0.0514459929 * b!);
  const m = Math.cbrt(0.2119034982 * r! + 0.6806995451 * g! + 0.1073969566 * b!);
  const s = Math.cbrt(0.0883024619 * r! + 0.2817188376 * g! + 0.6299787005 * b!);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
}

function rgbOf(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos((H * Math.PI) / 180);
  const b = C * Math.sin((H * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/**
 * 그 색상에서 sRGB가 낼 수 있는 만큼만 채도를 준다.
 *
 * 청록·초록 쪽은 한계가 낮아 목표 채도에 못 미친다 — 억지로 밀면 화면 밖 색이 되어
 * 브라우저가 아무렇게나 잘라내고, 그러면 그 카드만 색이 튄다.
 */
function hexAt(L: number, C: number, H: number): string {
  let lo = 0;
  let hi = C;
  while (hi - lo > 0.0002) {
    const mid = (lo + hi) / 2;
    if (rgbOf(L, mid, H).every((v) => v >= -0.001 && v <= 1.001)) lo = mid;
    else hi = mid;
  }
  const to255 = (v: number) => Math.max(0, Math.min(255, Math.round(v * 255)));
  return '#' + rgbOf(L, lo, H).map((v) => to255(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** 그 테마에서 카테고리마다 쓸 바탕색·글씨색 */
export function cardColors(theme: CardTheme): { slug: string; color: string; fg: string }[] {
  const def = CARD_THEMES[theme];
  return CATEGORIES.map((c) => {
    if (def.L == null || def.C == null || def.fg == null) return { slug: c.slug, color: c.color, fg: c.fg };
    return { slug: c.slug, color: hexAt(def.L, def.C, hueOf(c.color)), fg: def.fg };
  });
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
