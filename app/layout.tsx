/* ============================================================
   app/layout.tsx 를 이 파일로 교체하세요.
   달라진 점: 헤더는 로고 + (문맥 탭)만 남고, 내비게이션은
   본문 뒤의 하단 탭바(NavLinks)로 내려갑니다. 푸터는 CSS에서 숨김.
   ============================================================ */

import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import NavLinks, { ContextTabs } from './nav';
import ServiceWorkerRegistrar from './sw-register';
import InstallPrompt from './install-prompt';
import ChromeAutoHide from './chrome-autohide';
import ViewingAs from './viewing-as';
import { I18nProvider } from './i18n';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import './globals.css';
// 시안 파일(globals.css)을 통째로 갈아끼워도 살아남아야 하는 보정 — 반드시 뒤에 온다
import './overrides.css';

const META = {
  title: { ko: 'Kansas Korean — 같이 놀 사람?', en: 'Kansas Korean — Who’s in?' },
  description: {
    ko: '영화·피클볼·볼링·축구·밥친구·카페 — 취미 모임 만들고 같이 놀 사람 모으기',
    en: 'Movies, pickleball, bowling, soccer, meals, cafés — create a meetup and find people to join',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, META.title),
    description: pick(locale, META.description),
    // 홈 화면에 추가했을 때 주소창 없이 열리게 (구형 iOS는 매니페스트만으로는 부족하다)
    appleWebApp: {
      capable: true,
      title: 'Kansas Korean',
      statusBarStyle: 'default',
    },
    // Next는 표준 이름(mobile-web-app-capable)만 내보내는데, 예전 iOS는 애플 전용 이름을 본다
    other: { 'apple-mobile-web-app-capable': 'yes' },
  };
}

/** 하단 탭바가 홈 인디케이터 영역까지 깔리도록 — env(safe-area-inset-*)가 동작하려면 필요 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>
          <ServiceWorkerRegistrar />
          <ChromeAutoHide />
          <ViewingAs />
          <header className="site-header">
            <div className="container header-inner">
              <Link href="/" className="logo">
                Kansas&nbsp;Korean<sup>®</sup>
              </Link>
            </div>
          </header>
          <main className="container">
            <ContextTabs />
            <InstallPrompt />
            {children}
          </main>
          <NavLinks />
        </I18nProvider>
      </body>
    </html>
  );
}
