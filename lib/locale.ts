import { cookies } from 'next/headers';
import { LOCALE_COOKIE, Locale, toLocale } from './i18n';

/** 서버 컴포넌트·라우트에서 현재 언어 (쿠키 기준, 없으면 기본 한국어) */
export async function getLocale(): Promise<Locale> {
  return toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
}
