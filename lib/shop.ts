import { CardTheme } from './card-theme';
import { Msg } from './i18n';

/**
 * 테마 상점의 규칙 — 서버와 화면이 함께 쓴다.
 *
 * 여기에는 DB를 부르는 것이 없다. 화면에서 lib/db/shop.ts를 불러오면 drizzle까지
 * 브라우저 번들에 딸려 온다 (lib/reviews.ts·lib/ratings.ts와 같은 이유).
 */

/**
 * 달란트 = 주최 + 정성 + 참여×3 + 프로필 사진 20.
 *
 * 참여에만 3을 곱하는 이유는 눈금이 달라서다. 주최는 「연 모임의 참가 인원 합」이라
 * 한 번에 열댓 점씩 오르고 정성도 사진·댓글로 쌓이는데, 참여는 한 번 나가야 1이다.
 * 그대로 더하면 나가기만 하는 사람은 달란트가 거의 안 모인다 — 이 앱이 제일 바라는
 * 행동이 그건데도.
 *
 * **프로필 사진 20은 「올린 상」이 아니라 「달고 있는 동안 붙는 값」이다.** 지급 기록을
 * 남기지 않고 매번 지금 상태에서 센다 — 그래서 사진을 내리면 20도 같이 사라진다.
 * 올렸다 바로 내려서 점수만 챙기는 길이 아예 안 생긴다. 이 앱의 다른 점수가 전부
 * 그렇게 되어 있다 (lib/db/shop.ts 첫머리의 「잔액이라는 칸은 없다」).
 *
 * 정성 점수가 아니라 **달란트에만** 얹는다. 정성 등급 문턱이 10·20·35·60인데 재 본
 * 최고가 26점이라, 여기에 20을 더하면 사진 올린 사람이 두 칸을 한 번에 건너뛰고
 * 등급 알림이 무더기로 나간다. 순위표와 등급은 활동을 재는 자리로 두고, 사진은
 * 상점에서만 값을 갖게 한다.
 */
export const COIN = {
  host: 1,
  contrib: 1,
  join: 3,
  /**
   * 손님이 **전원** 후기를 쓴 모임에서, 손님 한 명당 호스트가 받는 값.
   *
   * 한 명이라도 안 쓰면 0이다. 「많이 받으면 조금씩」이 아니라 「다 받으면」이라야 호스트가
   * 마지막 한 사람에게 한 번 더 물어볼 이유가 생긴다.
   *
   * 재 보니 끝난 모임 서른한 개 중 전원이 쓴 것은 하나다(손님 여섯 → 30달란트). 드물게
   * 터지는 값이라 크게 잡아도 될 것 같았지만, 열이면 한 번에 60이라 테마 하나를 넘는다.
   */
  reviewedAll: 5,
  avatar: 20,
  push: 10,
  news: 10,
  apology: 30,
} as const;

/**
 * 장애 보상을 받는 사람 — **이 시각보다 먼저 들어온 회원.**
 *
 * 8월 22일 오후부터 다음 날까지 데이터베이스가 사용량 한도를 넘겨 모든 요청을 거절했고,
 * 그동안 앱이 아예 안 열렸다. 그때 있던 사람에게만 준다 — 나중에 들어올 사람은 겪지
 * 않은 일이다.
 *
 * 날짜를 코드에 박아 두는 것은 일부러다. 이 값이 있는 한 「그때 있던 사람」이 시간이
 * 지나도 안 바뀐다. 지급 기록 테이블을 따로 두지 않은 이유는 한 번뿐인 일이어서다.
 *
 * **한 번 넣으면 빼지 말 것.** 빼면 이걸로 테마를 산 사람의 잔액이 음수가 되고, 산
 * 테마가 잠긴다 (lib/db/shop.ts의 themeAllowed).
 */
export const APOLOGY_BEFORE = new Date('2026-08-22T00:00:00-05:00');

/**
 * 달란트를 셀 재료.
 *
 * 뒤의 셋은 활동이 아니라 **지금 켜 둔 상태**다 — 프로필 사진이 있는지, 알림을 받는지,
 * 새 소식을 받는지. 「한 번 했으니 준다」가 아니라 「켜 둔 동안 붙어 있다」라서, 끄면
 * 그만큼 도로 빠진다. 지급 기록을 남기지 않고 매번 지금 상태에서 세는 것이 그 뜻이다.
 */
export interface CoinSource {
  host: number;
  join: number;
  contrib: number;
  /** 손님이 전원 후기를 쓴 모임의 손님 수 (호스트가 둘이면 나눈 몫) */
  reviewed: number;
  avatar: boolean;
  /** 이 기기든 저 기기든 알림을 하나라도 받도록 켜 뒀는지 */
  push: boolean;
  /** 새 소식을 카카오톡으로 받도록 켜 뒀는지 */
  news: boolean;
  /** 장애를 겪은 회원인지 — APOLOGY_BEFORE 참고 */
  apology: boolean;
}

export function coinsEarned(s: CoinSource): number {
  // 주최 점수만 .5 단위다 (호스트가 둘이면 나눠 갖는다) — 달란트는 정수로 끊는다
  return (
    Math.floor(
      s.host * COIN.host + s.contrib * COIN.contrib + s.join * COIN.join + s.reviewed * COIN.reviewedAll
    ) +
    (s.avatar ? COIN.avatar : 0) +
    (s.push ? COIN.push : 0) +
    (s.news ? COIN.news : 0) +
    (s.apology ? COIN.apology : 0)
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
    /*
     * 가을은 **코드가 이미 다 있다** (lib/card-theme.ts의 autumn). 그런데도 여기 남겨
     * 두는 것은 아직 관리자만 걸어 보는 중이라서다 — 회원에게는 준비 중으로 보인다.
     *
     * 열 때는 두 줄이다: THEME_PRICE에 값을 넣고 이 항목을 지운다. 미리보기만 먼저
     * 열려면 SOON_THEMES에 넣으면 된다(그쪽은 눌러 볼 수 있고 살 수만 없다).
     */
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
    ko: '모임을 열고, 나가고, 남긴 만큼 달란트가 쌓여요. 프로필 사진을 올려 두면 거기에 20이 더 붙고요. 쌓인 달란트로 테마를 삽니다.',
    en: 'Hosting, showing up and leaving things behind all earn talents — and a profile photo adds 20 on top. Spend them on themes.',
    es: 'Organizar, aparecer y dejar huella dan talentos, y una foto de perfil suma 20 más. Gástalos en temas.',
  },
  /** 달란트가 어디서 왔는지 — 안 적으면 숫자가 어디서 나온 건지 알 수 없다 */
  breakdown: { ko: '주최 {host} + 정성 {contrib} + 참여 {join}×3', en: 'Hosting {host} + contribution {contrib} + attendance {join}×3', es: 'Anfitrión {host} + aportes {contrib} + asistencia {join}×3' },
  /** 켜 둔 것에 붙는 줄 — 위 breakdown 뒤에 이어 붙는다 */
  fromAvatar: { ko: '프로필 사진 +{n}', en: 'profile photo +{n}', es: 'foto de perfil +{n}' },
  fromPush: { ko: '알림 +{n}', en: 'notifications +{n}', es: 'avisos +{n}' },
  fromNews: { ko: '새 소식 알림 +{n}', en: 'news alerts +{n}', es: 'avisos de novedades +{n}' },
  fromApology: { ko: '장애 보상 +{n}', en: 'outage make-good +{n}', es: 'compensación por la caída +{n}' },
  fromReviewed: { ko: '후기 만석 +{n}', en: 'every guest reviewed +{n}', es: 'todos reseñaron +{n}' },
  /** 아직 안 켠 것 — 프로필로 데려간다 */
  offPush: {
    ko: '알림을 켜면 {n}달란트가 더 붙어요',
    en: 'Turning notifications on adds {n} talents',
    es: 'Activar los avisos suma {n} talentos',
  },
  offNews: {
    ko: '새 소식 알림을 켜면 {n}달란트가 더 붙어요',
    en: 'Turning news alerts on adds {n} talents',
    es: 'Activar los avisos de novedades suma {n} talentos',
  },
  /**
   * 사진이 없는 사람에게 뜨는 권유. 달란트가 걸려 있다는 것을 여기서 처음 알게 된다.
   *
   * 힌트 글씨가 아니라 누를 수 있는 칸으로 둔다 — 읽고 나서 어디로 가야 하는지가
   * 같이 있어야 실제로 올리러 간다.
   */
  avatarNudge: {
    ko: '프로필에 사진을 올리면 {n}달란트가 바로 더 붙어요',
    en: 'A photo on your profile adds {n} talents right away',
    es: 'Una foto en tu perfil suma {n} talentos al momento',
  },
  avatarNudgeMore: {
    ko: '{price}달란트짜리 테마까지 {n}만 남아요. 사진을 내리면 그 {avatar}달란트도 같이 빠져요.',
    en: 'That leaves {n} to go for a {price}-talent theme. Take the photo down and those {avatar} go with it.',
    es: 'Así te faltarían {n} para un tema de {price}. Si quitas la foto, esos {avatar} se van con ella.',
  },
  /** 사진 없이도 이미 살 수 있는 사람 — 거리를 적으면 「0만 남아요」가 된다 */
  avatarNudgeEnough: {
    ko: '사진을 내리면 그 {n}달란트도 같이 빠져요.',
    en: 'Take the photo down later and those {n} go with it.',
    es: 'Si quitas la foto más adelante, esos {n} se van con ella.',
  },
  /** 알림·새 소식용 — 사진과 달리 「내리면」이 아니라 「끄면」이다 */
  offAgain: {
    ko: '나중에 끄면 그 {n}달란트도 같이 빠져요.',
    en: 'Turn it off later and those {n} go with it.',
    es: 'Si lo desactivas más adelante, esos {n} se van con ello.',
  },
  avatarGo: { ko: '프로필로 가기 →', en: 'Go to my profile →', es: 'Ir a mi perfil →' },
  /** 잔액이 마이너스라 산 테마가 잠긴 상태 */
  lockedTitle: { ko: '테마가 잠겨 있어요', en: 'Your themes are locked', es: 'Tus temas están bloqueados' },
  lockedBody: {
    ko: '프로필 사진을 내려서 달란트가 {n} 모자라요. 사진을 다시 올리면 바로 풀려요.',
    en: 'Taking your profile photo down left you {n} short. Put it back and they unlock right away.',
    es: 'Al quitar tu foto de perfil te faltan {n}. Vuelve a ponerla y se desbloquean al momento.',
  },
  balance: { ko: '가진 달란트', en: 'Your talents', es: 'Tus talentos' },
  spent: { ko: '쓴 달란트 {n}', en: '{n} spent', es: '{n} gastados' },
  price: { ko: '{n} 달란트', en: '{n} talents', es: '{n} talentos' },
  buy: { ko: '사기', en: 'Buy', es: 'Comprar' },
  /*
   * 산 테마에만 열리는 칸 — 「이건 이렇게 하면 좋겠다」를 그 자리에서 적는다.
   *
   * 건의함(/tickets)이 이미 있는데 여기 따로 두는 이유는 **자리** 때문이다. 테마를
   * 보다가 아쉬운 곳이 눈에 띄는 것이지, 아쉬운 곳이 떠올라서 건의함을 여는 것이
   * 아니다. 적은 것은 결국 건의함으로 간다 — 답도 거기서 받는다.
   */
  suggest: { ko: '디자인 건의', en: 'Suggest a change', es: 'Sugerir un cambio' },
  suggestIntro: {
    ko: '이 테마에서 고쳤으면 하는 것을 적어주세요. 건의함으로 들어가고, 답도 거기서 볼 수 있어요.',
    en: 'Tell us what you’d change about this theme. It goes to the suggestion box, and the reply comes back there.',
    es: 'Cuéntanos qué cambiarías de este tema. Va al buzón de sugerencias y allí verás la respuesta.',
  },
  suggestTitlePh: {
    ko: '한 줄로 — 예: 낙엽이 글씨를 가려요',
    en: 'One line — e.g. the leaves cover the text',
    es: 'Una línea: p. ej. las hojas tapan el texto',
  },
  suggestBodyPh: {
    ko: '더 적을 것이 있으면 (없어도 돼요)',
    en: 'Anything more? (optional)',
    es: '¿Algo más? (opcional)',
  },
  suggestSend: { ko: '보내기', en: 'Send', es: 'Enviar' },
  suggestSending: { ko: '보내는 중…', en: 'Sending…', es: 'Enviando…' },
  suggestClose: { ko: '접기', en: 'Close', es: 'Cerrar' },
  suggestDone: {
    ko: '건의 #{n}으로 접수됐어요. 건의함에서 진행 상황을 볼 수 있어요.',
    en: 'Filed as ticket #{n} — track it in the suggestion box.',
    es: 'Registrada como n.º {n}: síguela en el buzón de sugerencias.',
  },
  owned: { ko: '가지고 있어요', en: 'Owned', es: 'La tienes' },
  short: { ko: '{n} 달란트 모자라요', en: '{n} more to go', es: 'Te faltan {n}' },
  buying: { ko: '사는 중…', en: 'Buying…', es: 'Comprando…' },
  /* 산 테마를 고르는 자리는 프로필의 「카드 테마」다 — 상점이 처음 생겼을 때는
     관리자 화면뿐이라 그렇게 적혀 있었는데, 프로필에 선택기가 생기고도 그대로 남아
     있었다. 산 사람을 못 여는 화면으로 보내면 산 것이 어디 갔는지 알 수 없다 */
  bought: { ko: '샀어요. 프로필의 「카드 테마」에서 골라 쓸 수 있어요.', en: 'Bought — pick it under “Card theme” in your profile.', es: 'Comprada: elígela en «Tema de tarjetas», en tu perfil.' },
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
