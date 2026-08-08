// 한국어/영어/스페인어. 사전을 따로 두지 않고 각 파일에서 { ko, en } 쌍을 선언해 쓴다 —
// 번역이 쓰이는 자리 바로 옆에 있어 키 이름을 외울 필요가 없고 빠뜨리기도 어렵다.

export const LOCALES = ['ko', 'en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ko';

/** 언어 선택은 쿠키에 미러링한다 (서버 렌더 시점에 읽어 깜빡임 없이 그리기 위해) */
export const LOCALE_COOKIE = 'locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * 한 문구의 언어별 값.
 *
 * ko·en은 반드시 있고 **es는 선택**이다. 문구가 800개 남짓이라 한 번에 다 옮길 수 없어서,
 * 없는 것은 영어로 떨어뜨리고 화면 단위로 채워 나간다. 필수로 만들면 스페인어 한 줄을
 * 넣을 때마다 800곳이 빨개져서, 결국 아무도 시작하지 못한다.
 */
export type Msg = { ko: string; en: string; es?: string };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function toLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** "{name}님이 참가했어요" 형태의 자리표시자 치환 */
export function fmt(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? String(vars[key]) : whole));
}

/**
 * 문구를 해당 언어로 고른다 (자리표시자가 있으면 함께 치환).
 *
 * 스페인어가 아직 없는 문구는 **영어**로 떨어진다. 한국어가 아니다 —
 * 스페인어를 고른 사람에게 한글이 나오면 읽을 방법이 없지만, 영어는 대개 읽힌다.
 */
export function pick(locale: Locale, msg: Msg, vars?: Record<string, string | number>): string {
  // msg[DEFAULT_LOCALE]로 쓰면 es가 선택 항목이라 타입이 string | undefined가 된다
  const text = msg[locale] ?? msg.en ?? msg.ko;
  return fmt(text, vars);
}

export const LOCALE_NAMES: Record<Locale, string> = { ko: '한국어', en: 'English', es: 'Español' };

/**
 * <html lang>과 날짜·숫자 포맷에 넘길 BCP 47 태그.
 * 우리 앱은 캔자스에서 쓰이므로 스페인어도 미국 스페인어로 잡는다.
 */
export const HTML_LANG: Record<Locale, string> = { ko: 'ko', en: 'en', es: 'es-US' };
