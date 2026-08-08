/* ============================================================
   app/layout.tsx 를 이 파일로 교체하세요.
   달라진 점: 헤더는 로고 + (문맥 탭)만 남고, 내비게이션은
   본문 뒤의 하단 탭바(NavLinks)로 내려갑니다. 푸터는 CSS에서 숨김.
   ============================================================ */

import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans_KR, Space_Grotesk } from 'next/font/google';
import Link from 'next/link';
import NavLinks, { ContextTabs } from './nav';
import ServiceWorkerRegistrar from './sw-register';
import InstallPrompt from './install-prompt';
import PushNudge from './push-nudge';
import NoticePopup from './notice-popup';
import BanGate from './ban-screen';
import ChromeAutoHide from './chrome-autohide';
import PresenceBeat from './presence-beat';
import ViewingAs from './viewing-as';
import { I18nProvider } from './i18n';
import { SessionProvider } from './session';
import { getViewer } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { SITE_URL } from '@/lib/site';
import { HTML_LANG, pick } from '@/lib/i18n';

/*
 * 글꼴은 빌드 때 받아 우리 도메인에서 준다.
 *
 * CSS의 @import로 구글에서 바로 받으면 두 가지가 문제였다:
 *  - 합쳐진 CSS에서 규칙 뒤로 밀리면 브라우저가 통째로 무시한다 (배포본에서만 글꼴이 빠졌다)
 *  - 글꼴을 받으러 구글까지 한 번 더 다녀오는 동안 시스템 글꼴로 그려졌다가 바뀐다
 * next/font는 파일을 함께 배포한다.
 *
 * preload는 끈다. 한글은 글리프가 많아 글꼴 하나가 unicode-range로 백 조각쯤 쪼개져 있는데,
 * preload를 켜두면 그 조각을 전부 미리 받는다 — 한 화면 여는 데 246개·2MB가 나갔다.
 * 끄면 브라우저가 화면에 실제로 쓰인 글자의 조각만 가져온다.
 */
const sans = IBM_Plex_Sans_KR({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-sans',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
  preload: false,
  variable: '--font-mono',
});
/** 그룹 카드의 숫자와 AMC 제목에만 쓴다 */
const grotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-grotesk',
});
import './globals.css';
// 타입 보정 — 굵기·행간·자간·라벨 표기만 (구조·서체는 그대로)
import './type-tune.css';
// 색 — :root 변수와 primary/secondary가 쓰이는 몇 곳
import './color-8f.css';
// 시안 파일(globals.css)을 통째로 갈아끼워도 살아남아야 하는 보정 — 반드시 뒤에 온다
import './overrides.css';
import './calendar.css';
import './font-plex.css';
// 시안 13d — 옅은 초록 면과 목록 세로선 (반드시 맨 마지막)
import './button-13d.css';
// 둘러보기 2열 바둑판 배열 + 배열 토글 (반드시 맨 마지막)
import './cat-tile.css';

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
  /*
   * 세션을 여기서 한 번 읽어 화면 전체가 나눠 쓴다 — 예전에는 탭바·정지 가리개·
   * 대리 보기 띠·알림 권유가 각자 /api/auth/me를 불러 한 번 열 때 여섯 번이 나갔다.
   */
  const [locale, viewer] = await Promise.all([getLocale(), getViewer()]);
  return (
    <html lang={HTML_LANG[locale]} className={`${sans.variable} ${mono.variable} ${grotesk.variable}`}>
      <body>
        <I18nProvider locale={locale}>
          <SessionProvider value={viewer}>
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
          {/* 공지 — 어느 화면으로 들어와도 뜨도록 레이아웃에 둔다 (링크로 바로 온 사람도 본다) */}
          <NoticePopup />
          {/* 정지된 회원에게는 이 화면이 전부를 덮는다 (실제 차단은 서버에서) */}
          <BanGate />
          </SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
