import { CardTheme } from './card-theme';
import { Msg } from './i18n';

/**
 * 테마 상점의 규칙 — 서버와 화면이 함께 쓴다.
 *
 * 여기에는 DB를 부르는 것이 없다. 화면에서 lib/db/shop.ts를 불러오면 drizzle까지
 * 브라우저 번들에 딸려 온다 (lib/reviews.ts·lib/ratings.ts와 같은 이유).
 */

/**
 * 코인 = 주최 + 정성 + 참여×3 + 프로필 사진 20.
 *
 * 참여에만 3을 곱하는 이유는 눈금이 달라서다. 주최는 「연 모임의 참가 인원 합」이라
 * 한 번에 열댓 점씩 오르고 정성도 사진·댓글로 쌓이는데, 참여는 한 번 나가야 1이다.
 * 그대로 더하면 나가기만 하는 사람은 코인이 거의 안 모인다 — 이 앱이 제일 바라는
 * 행동이 그건데도.
 *
 * **프로필 사진 20은 「올린 상」이 아니라 「달고 있는 동안 붙는 값」이다.** 지급 기록을
 * 남기지 않고 매번 지금 상태에서 센다 — 그래서 사진을 내리면 20도 같이 사라진다.
 * 올렸다 바로 내려서 점수만 챙기는 길이 아예 안 생긴다. 이 앱의 다른 점수가 전부
 * 그렇게 되어 있다 (lib/db/shop.ts 첫머리의 「잔액이라는 칸은 없다」).
 *
 * 정성 점수가 아니라 **코인에만** 얹는다. 정성 등급 문턱이 10·20·35·60인데 재 본
 * 최고가 26점이라, 여기에 20을 더하면 사진 올린 사람이 두 칸을 한 번에 건너뛰고
 * 등급 알림이 무더기로 나간다. 순위표와 등급은 활동을 재는 자리로 두고, 사진은
 * 상점에서만 값을 갖게 한다.
 */
export const COIN = { host: 1, contrib: 1, join: 3, avatar: 20, push: 10, news: 10 } as const;

/**
 * 코인을 셀 재료.
 *
 * 뒤의 셋은 활동이 아니라 **지금 켜 둔 상태**다 — 프로필 사진이 있는지, 알림을 받는지,
 * 새 소식을 받는지. 「한 번 했으니 준다」가 아니라 「켜 둔 동안 붙어 있다」라서, 끄면
 * 그만큼 도로 빠진다. 지급 기록을 남기지 않고 매번 지금 상태에서 세는 것이 그 뜻이다.
 */
export interface CoinSource {
  host: number;
  join: number;
  contrib: number;
  avatar: boolean;
  /** 이 기기든 저 기기든 알림을 하나라도 받도록 켜 뒀는지 */
  push: boolean;
  /** 새 소식을 카카오톡으로 받도록 켜 뒀는지 */
  news: boolean;
}

export function coinsEarned(s: CoinSource): number {
  // 주최 점수만 .5 단위다 (호스트가 둘이면 나눠 갖는다) — 코인은 정수로 끊는다
  return (
    Math.floor(s.host * COIN.host + s.contrib * COIN.contrib + s.join * COIN.join) +
    (s.avatar ? COIN.avatar : 0) +
    (s.push ? COIN.push : 0) +
    (s.news ? COIN.news : 0)
  );
}

/**
 * 지금 상점에 걸린 것. 값이 다르면 여기서 갈라 두면 된다.
 *
 * 상점에 없는 테마는 살 수도, 프로필에서 고를 수도 없다.
 */
export const THEME_PRICE: Partial<Record<CardTheme, number>> = {
  rainyseason: 50,
  cherryblossom: 50,
  winter: 50,
};

/** 상점에 내놓은 테마 — 목록의 순서가 곧 화면 순서다 */
export const SHOP_THEMES = Object.keys(THEME_PRICE) as CardTheme[];

/**
 * 만들어는 뒀지만 아직 안 파는 것.
 *
 * 상점에 「추가 예정」으로 세워 두고 미리보기만 열어 준다. 값을 정하면 THEME_PRICE로
 * 옮기면 되고, 그러면 자동으로 살 수 있는 줄이 된다 — 살 수 있는지 없는지는 값이
 * 있느냐로만 갈린다 (priceOf).
 */
export const SOON_THEMES: CardTheme[] = [];

/**
 * 아직 **만들지도 않은** 것 — 이름만 세워 둔다.
 *
 * SOON_THEMES와 나눠 두는 이유는 미리보기 때문이다. 저건 코드가 다 있어서 눌러 볼 수
 * 있지만 이건 보여 줄 것이 없다. 그래서 CardTheme이 아니라 여기서 이름만 든다 —
 * 만들고 나면 lib/card-theme.ts에 넣고 이 줄을 지우면 된다.
 */
export const PLANNED: { key: string; label: Msg; note: Msg }[] = [
  {
    key: 'autumn',
    label: { ko: '가을 · 단풍', en: 'Autumn · Fall leaves', es: 'Otoño · Hojas' },
    note: {
      ko: '준비 중이에요.',
      en: 'In the works.',
      es: 'En preparación.',
    },
  },
];

export function priceOf(theme: string): number | null {
  return THEME_PRICE[theme as CardTheme] ?? null;
}

export const SHOP_T = {
  title: { ko: '테마 상점', en: 'Theme shop', es: 'Tienda de temas' },
  intro: {
    ko: '모임을 열고, 나가고, 남긴 만큼 코인이 쌓여요. 프로필 사진을 올려 두면 거기에 20이 더 붙고요. 쌓인 코인으로 테마를 삽니다.',
    en: 'Hosting, showing up and leaving things behind all earn coins — and a profile photo adds 20 on top. Spend them on themes.',
    es: 'Organizar, aparecer y dejar huella dan monedas, y una foto de perfil suma 20 más. Gástalas en temas.',
  },
  /** 코인이 어디서 왔는지 — 안 적으면 숫자가 어디서 나온 건지 알 수 없다 */
  breakdown: { ko: '주최 {host} + 정성 {contrib} + 참여 {join}×3', en: 'Hosting {host} + contribution {contrib} + attendance {join}×3', es: 'Anfitrión {host} + aportes {contrib} + asistencia {join}×3' },
  /** 켜 둔 것에 붙는 줄 — 위 breakdown 뒤에 이어 붙는다 */
  fromAvatar: { ko: '프로필 사진 +{n}', en: 'profile photo +{n}', es: 'foto de perfil +{n}' },
  fromPush: { ko: '알림 +{n}', en: 'notifications +{n}', es: 'avisos +{n}' },
  fromNews: { ko: '새 소식 알림 +{n}', en: 'news alerts +{n}', es: 'avisos de novedades +{n}' },
  /** 아직 안 켠 것 — 프로필로 데려간다 */
  offPush: {
    ko: '알림을 켜면 {n}코인이 더 붙어요',
    en: 'Turning notifications on adds {n} coins',
    es: 'Activar los avisos suma {n} monedas',
  },
  offNews: {
    ko: '새 소식 알림을 켜면 {n}코인이 더 붙어요',
    en: 'Turning news alerts on adds {n} coins',
    es: 'Activar los avisos de novedades suma {n} monedas',
  },
  /**
   * 사진이 없는 사람에게 뜨는 권유. 코인이 걸려 있다는 것을 여기서 처음 알게 된다.
   *
   * 힌트 글씨가 아니라 누를 수 있는 칸으로 둔다 — 읽고 나서 어디로 가야 하는지가
   * 같이 있어야 실제로 올리러 간다.
   */
  avatarNudge: {
    ko: '프로필에 사진을 올리면 {n}코인이 바로 더 붙어요',
    en: 'A photo on your profile adds {n} coins right away',
    es: 'Una foto en tu perfil suma {n} monedas al momento',
  },
  avatarNudgeMore: {
    ko: '{price}코인짜리 테마까지 {n}만 남아요. 사진을 내리면 그 {avatar}코인도 같이 빠져요.',
    en: 'That leaves {n} to go for a {price}-coin theme. Take the photo down and those {avatar} go with it.',
    es: 'Así te faltarían {n} para un tema de {price}. Si quitas la foto, esas {avatar} se van con ella.',
  },
  /** 사진 없이도 이미 살 수 있는 사람 — 거리를 적으면 「0만 남아요」가 된다 */
  avatarNudgeEnough: {
    ko: '사진을 내리면 그 {n}코인도 같이 빠져요.',
    en: 'Take the photo down later and those {n} go with it.',
    es: 'Si quitas la foto más adelante, esas {n} se van con ella.',
  },
  /** 알림·새 소식용 — 사진과 달리 「내리면」이 아니라 「끄면」이다 */
  offAgain: {
    ko: '나중에 끄면 그 {n}코인도 같이 빠져요.',
    en: 'Turn it off later and those {n} go with it.',
    es: 'Si lo desactivas más adelante, esas {n} se van con ello.',
  },
  avatarGo: { ko: '프로필로 가기 →', en: 'Go to my profile →', es: 'Ir a mi perfil →' },
  /** 잔액이 마이너스라 산 테마가 잠긴 상태 */
  lockedTitle: { ko: '테마가 잠겨 있어요', en: 'Your themes are locked', es: 'Tus temas están bloqueados' },
  lockedBody: {
    ko: '프로필 사진을 내려서 코인이 {n} 모자라요. 사진을 다시 올리면 바로 풀려요.',
    en: 'Taking your profile photo down left you {n} short. Put it back and they unlock right away.',
    es: 'Al quitar tu foto de perfil te faltan {n}. Vuelve a ponerla y se desbloquean al momento.',
  },
  balance: { ko: '가진 코인', en: 'Your coins', es: 'Tus monedas' },
  spent: { ko: '쓴 코인 {n}', en: '{n} spent', es: '{n} gastadas' },
  price: { ko: '{n} 코인', en: '{n} coins', es: '{n} monedas' },
  buy: { ko: '사기', en: 'Buy', es: 'Comprar' },
  owned: { ko: '가지고 있어요', en: 'Owned', es: 'La tienes' },
  short: { ko: '{n} 코인 모자라요', en: '{n} more to go', es: 'Te faltan {n}' },
  buying: { ko: '사는 중…', en: 'Buying…', es: 'Comprando…' },
  bought: { ko: '샀어요. 관리자 화면에서 골라 쓸 수 있어요.', en: 'Bought — pick it on the admin screen.', es: 'Comprada: elígela en la pantalla de administración.' },
  failed: { ko: '사지 못했어요.', en: 'Couldn’t buy that.', es: 'No se pudo comprar.' },
  soon: { ko: '추가 예정', en: 'Coming soon', es: 'Próximamente' },
  preview: { ko: '미리보기', en: 'Preview', es: 'Vista previa' },
  previewOf: { ko: '{name} — 홈 화면', en: '{name} — home screen', es: '{name} — pantalla de inicio' },
  close: { ko: '닫기', en: 'Close', es: 'Cerrar' },
  previewNote: {
    ko: '홈 화면만 보여드려요. 눌러서 넘어가지는 않아요.',
    en: 'The home screen only — taps don’t go anywhere.',
    es: 'Solo la pantalla de inicio; los toques no llevan a ningún sitio.',
  },
} satisfies Record<string, Msg>;
