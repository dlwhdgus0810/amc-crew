import { cache } from 'react';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, Locale, toLocale } from './i18n';

/**
 * 서버 컴포넌트·라우트에서 현재 언어 (쿠키 기준, 없으면 기본 한국어).
 *
 * 한 요청 안에서 두세 번 불린다 — layout의 generateMetadata와 RootLayout이 각각,
 * 변경 라우트는 banGuard도 부른다. cache로 감싸 쿠키를 한 번만 읽는다.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  return toLocale((await cookies()).get(LOCALE_COOKIE)?.value);
});
