import { CardTheme } from './card-theme';
import { Msg } from './i18n';

/**
 * 테마 상점의 규칙 — 서버와 화면이 함께 쓴다.
 *
 * 여기에는 DB를 부르는 것이 없다. 화면에서 lib/db/shop.ts를 불러오면 drizzle까지
 * 브라우저 번들에 딸려 온다 (lib/reviews.ts·lib/ratings.ts와 같은 이유).
 */

/**
 * 코인 = 주최 + 정성 + 참여×3.
 *
 * 참여에만 3을 곱하는 이유는 눈금이 달라서다. 주최는 「연 모임의 참가 인원 합」이라
 * 한 번에 열댓 점씩 오르고 정성도 사진·댓글로 쌓이는데, 참여는 한 번 나가야 1이다.
 * 그대로 더하면 나가기만 하는 사람은 코인이 거의 안 모인다 — 이 앱이 제일 바라는
 * 행동이 그건데도.
 */
export const COIN = { host: 1, contrib: 1, join: 3 } as const;

export function coinsEarned(s: { host: number; join: number; contrib: number }): number {
  // 주최 점수만 .5 단위다 (호스트가 둘이면 나눠 갖는다) — 코인은 정수로 끊는다
  return Math.floor(s.host * COIN.host + s.contrib * COIN.contrib + s.join * COIN.join);
}

/** 지금 상점에 걸린 것. 값이 다르면 여기서 갈라 두면 된다 */
export const THEME_PRICE: Partial<Record<CardTheme, number>> = {
  cherryblossom: 50,
  rainyseason: 50,
};

/** 상점에 내놓은 테마 — 목록의 순서가 곧 화면 순서다 */
export const SHOP_THEMES = Object.keys(THEME_PRICE) as CardTheme[];

export function priceOf(theme: string): number | null {
  return THEME_PRICE[theme as CardTheme] ?? null;
}

export const SHOP_T = {
  title: { ko: '테마 상점', en: 'Theme shop', es: 'Tienda de temas' },
  intro: {
    ko: '모임을 열고, 나가고, 남긴 만큼 코인이 쌓여요. 쌓인 코인으로 테마를 삽니다.',
    en: 'Hosting, showing up and leaving things behind all earn coins. Spend them on themes.',
    es: 'Organizar, aparecer y dejar huella dan monedas. Gástalas en temas.',
  },
  /** 코인이 어디서 왔는지 — 안 적으면 숫자가 어디서 나온 건지 알 수 없다 */
  breakdown: { ko: '주최 {host} + 정성 {contrib} + 참여 {join}×3', en: 'Hosting {host} + contribution {contrib} + attendance {join}×3', es: 'Anfitrión {host} + aportes {contrib} + asistencia {join}×3' },
  balance: { ko: '가진 코인', en: 'Your coins', es: 'Tus monedas' },
  spent: { ko: '쓴 코인 {n}', en: '{n} spent', es: '{n} gastadas' },
  price: { ko: '{n} 코인', en: '{n} coins', es: '{n} monedas' },
  buy: { ko: '사기', en: 'Buy', es: 'Comprar' },
  owned: { ko: '가지고 있어요', en: 'Owned', es: 'La tienes' },
  short: { ko: '{n} 코인 모자라요', en: '{n} more to go', es: 'Te faltan {n}' },
  buying: { ko: '사는 중…', en: 'Buying…', es: 'Comprando…' },
  bought: { ko: '샀어요. 관리자 화면에서 골라 쓸 수 있어요.', en: 'Bought — pick it on the admin screen.', es: 'Comprada: elígela en la pantalla de administración.' },
  failed: { ko: '사지 못했어요.', en: 'Couldn’t buy that.', es: 'No se pudo comprar.' },
} satisfies Record<string, Msg>;
