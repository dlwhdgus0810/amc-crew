'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_LOCALE, Locale, Msg, pick } from '@/lib/i18n';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

/** 서버(layout)에서 쿠키로 읽은 언어를 클라이언트 트리에 내려준다 — 첫 렌더부터 맞는 언어로 그려진다 */
export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** t({ ko: '저장', en: 'Save' }) 형태로 쓴다 */
export function useT() {
  const locale = useLocale();
  return (msg: Msg, vars?: Record<string, string | number>) => pick(locale, msg, vars);
}
