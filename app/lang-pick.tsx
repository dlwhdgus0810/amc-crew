'use client';

import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_NAMES, type Locale } from '@/lib/i18n';
import { useLocale } from './i18n';

/**
 * 로그인 전에도 쓰는 언어 고르기 — 한국어 · English · Español.
 *
 * 프로필의 언어 칸은 로그인해야 닿는다. 그런데 한국어가 어려운 사람이 제일 먼저 만나는
 * 화면은 로그인 **전**의 홈이고, 거기가 온통 한국어면 「카카오 로그인」 단추가 무슨
 * 뜻인지부터 막힌다. 그래서 계정 없이 쿠키에만 적는다 — 서버가 쿠키를 보고 그리므로
 * 다시 열면 그 언어다. 로그인해서 가입 화면에 오면 그 언어로 시작하고, 「시작하기」를
 * 누를 때 프로필에도 저장된다 (app/welcome/page.tsx).
 *
 * 값을 적은 뒤 통째로 다시 연다 — 상단 바·탭바·제목은 서버가 쿠키를 보고 그리는데,
 * 화면 일부만 갈아끼우면 그것들이 이전 언어로 남는다.
 */
export function setLocaleCookie(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}

export default function LangPick({ onPick }: { onPick?: (locale: Locale) => void } = {}) {
  const locale = useLocale();
  const router = useRouter();
  return (
    <div className="seg-group seg-tight lang-pick" role="group" aria-label="Language">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          className={`seg ${locale === l ? 'on' : ''}`}
          aria-pressed={locale === l}
          onClick={() => {
            if (l === locale) return;
            setLocaleCookie(l);
            if (onPick) onPick(l);
            else router.refresh();
          }}
        >
          {LOCALE_NAMES[l]}
        </button>
      ))}
    </div>
  );
}
