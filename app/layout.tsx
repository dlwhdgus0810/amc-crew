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
import PushNudge from './push-nudge';
import BanGate from './ban-screen';
import ChromeAutoHide from './chrome-autohide';
import PresenceBeat from './presence-beat';
import ViewingAs from './viewing-as';
import { I18nProvider } from './i18n';
import { getLocale } from '@/lib/locale';
import { SITE_URL } from '@/lib/site';
import { pick } from '@/lib/i18n';
import './globals.css';
// 타입 보정 — 굵기·행간·자간·라벨 표기만 (구조·서체는 그대로)
import './type-tune.css';
// 색 — :root 변수와 primary/secondary가 쓰이는 몇 곳
import './color-8f.css';
// 시안 파일(globals.css)을 통째로 갈아끼워도 살아남아야 하는 보정 — 반드시 뒤에 온다
import './overrides.css';
import './calendar.css';
import './font-plex.css';
// 시안 13c — 버튼의 면과 목록 카드를 걷어낸다 (반드시 맨 마지막)
import './button-13c.css';

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
    // 미리보기 이미지 주소를 공개 주소 기준으로 만든다 (안 정해 두면 요청 호스트를 쓴다)
    ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
    title: pick(locale, META.title),
    description: pick(locale, META.description),
    /*
     * 아이콘은 public/ 에 두고 여기서 가리킨다.
     * app/icon.svg 같은 파일 규약을 쓰면 Next가 그쪽을 먼저 잡아 public/ 파일이 무시된다.
     * iOS 홈 화면 아이콘은 매니페스트를 보지 않으므로 apple-touch-icon을 따로 준다.
     */
    icons: {
      icon: [
        { url: '/icon.svg', type: 'image/svg+xml' },
        { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
      ],
      apple: '/apple-touch-icon.png',
    },
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
          <PresenceBeat />
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
          <PushNudge />
          {/* 정지된 회원에게는 이 화면이 전부를 덮는다 (실제 차단은 서버에서) */}
          <BanGate />
        </I18nProvider>
      </body>
    </html>
  );
}
