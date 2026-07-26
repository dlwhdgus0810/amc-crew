// 한국어/영어 2개 언어. 사전을 따로 두지 않고 각 파일에서 { ko, en } 쌍을 선언해 쓴다 —
// 번역이 쓰이는 자리 바로 옆에 있어 키 이름을 외울 필요가 없고 빠뜨리기도 어렵다.

export const LOCALES = ['ko', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ko';

/** 언어 선택은 쿠키에 미러링한다 (서버 렌더 시점에 읽어 깜빡임 없이 그리기 위해) */
export const LOCALE_COOKIE = 'locale';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** 한 문구의 두 언어 값 */
export type Msg = { ko: string; en: string };

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

/** 문구를 해당 언어로 고른다 (자리표시자가 있으면 함께 치환) */
export function pick(locale: Locale, msg: Msg, vars?: Record<string, string | number>): string {
  return fmt(msg[locale] ?? msg[DEFAULT_LOCALE], vars);
}

export const LOCALE_NAMES: Record<Locale, string> = { ko: '한국어', en: 'English' };
