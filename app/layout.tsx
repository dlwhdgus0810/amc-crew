/* ============================================================
   app/layout.tsx 를 이 파일로 교체하세요.
   달라진 점: 헤더는 로고 + (문맥 탭)만 남고, 내비게이션은
   본문 뒤의 하단 탭바(NavLinks)로 내려갑니다. 푸터는 CSS에서 숨김.
   ============================================================ */

import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import { IBM_Plex_Mono, IBM_Plex_Sans_KR, Space_Grotesk, Gowun_Dodum, Gowun_Batang } from 'next/font/google';
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
import SeasonDeco from './season-deco';
import { CardThemeProvider } from './card-theme-context';
import { themeAllowed } from '@/lib/db/shop';
import { priceOf } from '@/lib/shop';
import {
  CARD_THEME_COOKIE,
  PREVIEW_COOKIE,
  cardThemeCss,
  themeBarColor,
  themeDeco,
  toCardTheme,
} from '@/lib/card-theme';
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
/*
 * 시즌 테마 전용 서체 둘. 테마가 켜지지 않은 동안 다운로드되지 않는다 — 변수 이름만 심어
 * 둘 뿐이고, 실제 파일은 그 글꼴로 글자가 그려질 때 받는다.
 *
 * preload: false는 위와 같은 이유다 — 한글 글꼴은 unicode-range로 백 조각쯤 쪼개져 있는데
 * preload를 켜면 안 쓰는 조각까지 전부 받는다.
 */
// 시즌 테마 — 카드 모양과 카드 장식 (2차에서 overrides.css에 붙였던 부분을 대신한다)
import './season.css';
import './season-winter.css';

/**
 * 장마 테마에서 카드 안의 물을 무엇으로 그릴지.
 *
 *  'canvas' — 방울이 실제로 수위를 올리고, 떨어진 자리만 수면이 우묵해졌다 되살아난다.
 *             카드마다 requestAnimationFrame 루프를 돌며 안 보이는 카드는 멈춘다.
 *  'css'    — 키프레임만 쓴다. 메인 스레드 비용은 0이지만 수위가 적어 둔 계단이라
 *             매번 같은 모양이 반복된다.
 *
 * 카드가 여러 장 보이는 화면에서 프레임이 모자라면 'css'로 내리면 된다.
 */
const RAIN_MODE: 'canvas' | 'css' = 'canvas';

/**
 * 겨울의 눈도 같은 갈래다.
 *
 *  'canvas' — 눈이 **실제로 쌓인다.** 가장자리에 앉고, 차면 안쪽으로 넘치고, 덩어리가
 *             떨어져 바닥에 쌓인다 (public/snow-canvas.js).
 *  'css'    — 곡률로 그린 봉우리 여섯만. 가볍고 어디서나 같지만 늘 같은 모양이다.
 */
const SNOW_MODE: 'canvas' | 'css' = 'canvas';

const dodum = Gowun_Dodum({
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
  preload: false,
  variable: '--font-dodum',
});
const batang = Gowun_Batang({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  preload: false,
  variable: '--font-batang',
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
  title: { ko: 'Kansas Korean — 같이 놀 사람?', en: 'Kansas Korean — Who’s in?', es: 'Kansas Korean — ¿quién se apunta?' },
  description: {
    ko: '영화·피클볼·볼링·축구·밥친구·카페 — 취미 모임 만들고 같이 놀 사람 모으기',
    en: 'Movies, pickleball, bowling, soccer, meals, cafés — create a meetup and find people to join',
    es: 'Cine, pickleball, bolos, fútbol, comidas, cafés: crea una quedada y encuentra con quién ir',
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
  const [locale, viewer, jar] = await Promise.all([getLocale(), getViewer(), cookies()]);
  /*
   * 미리보기 쿠키가 있으면 그것이 이긴다. 그 쿠키는 경로가 /preview라 미리보기 화면을
   * 부를 때만 딸려 오므로, 다른 화면은 늘 자기가 고른 테마 그대로다. 미리보기는 안 산
   * 테마를 보여 주는 것이 목적이라 아래의 확인을 지나간다.
   */
  const previewing = jar.get(PREVIEW_COOKIE)?.value;
  const picked = toCardTheme(previewing ?? jar.get(CARD_THEME_COOKIE)?.value);
  /*
   * 값이 붙은 테마는 **여기서 자격을 확인한다.** 고른 테마는 쿠키라서, 확인하지 않으면
   * 산 적 없는 테마를 손으로 넣어 쓸 수 있고 프로필 사진을 내려 코인이 마이너스가 된
   * 뒤에도 계속 쓰게 된다 (lib/db/shop.ts의 themeAllowed).
   *
   * 기본 테마인 사람은 priceOf가 null이라 여기서 바로 끝난다 — DB를 안 부른다.
   */
  const cardTheme =
    previewing ||
    priceOf(picked) == null ||
    /* 관리자는 산 적이 없어도 쓴다 — 관리자 화면의 선택기가 열 가지를 다 걸어 보는 자리다 */
    viewer.isAdmin ||
    (viewer.user && (await themeAllowed(viewer.user.id, picked)))
      ? picked
      : 'default';
  return (
    <html
      lang={HTML_LANG[locale]}
      className={`${sans.variable} ${mono.variable} ${grotesk.variable} ${dodum.variable} ${batang.variable}`}
      /*
       * 시즌 테마일 때만 붙는 표시. CSS는 지금 무슨 테마인지 알 방법이 없는데
       * (변수 값만 내려간다) 카드 등장 지연은 시즌에서만 걸어야 해서 이 고리가 필요하다.
       */
      data-season={themeDeco(cardTheme) ?? undefined}
      data-rain={RAIN_MODE}
      data-snow={SNOW_MODE}
    >
      <head>
        {/*
          * 카드 색을 변수로 심는다. 여기 한 곳에서 정하면 색을 쓰는 일곱 자리가
          * 그대로 따라온다 (lib/card-theme.ts의 cardThemeCss).
          * 시즌 테마에선 바탕·글씨·강조색·곡률·서체까지 같은 변수로 따라오며,
          * 이름이 겹치는 :root들을 이기려고 html:root을 쓴다 (그 함수 주석 참고).
          */}
        <style dangerouslySetInnerHTML={{ __html: cardThemeCss(cardTheme) }} />
        {/*
          * 상단 바 색. 매니페스트는 설치할 때 한 번 읽고 마는 값이라, 테마를 바꾼 그
          * 자리에서 색이 따라오게 하는 것은 이 meta다. 둘 다 둔다.
          */}
        <meta name="theme-color" content={themeBarColor(cardTheme)} />
        {/*
          * 카드 안의 물을 그리는 커스텀 엘리먼트 — **장마 테마일 때만** 받는다.
          * defer라도 괜찮다: 엘리먼트가 나중에 정의되면 이미 있던 태그가 그때 연결된다
          * (커스텀 엘리먼트 업그레이드). 카드가 먼저 보이고 물이 잠시 뒤에 생긴다.
          */}
        {RAIN_MODE === 'canvas' && themeDeco(cardTheme) === 'rain' && (
          <>
            <script src="/rain-canvas.js" defer />
            {/* 화면 전체의 비 — 카드를 만나면 위 캔버스에 방울을 넘긴다 */}
            <script src="/rain-field.js" defer />
          </>
        )}
        {/* 카드 위에 쌓이는 눈 — 겨울일 때만 받는다 (public/snow-canvas.js) */}
        {SNOW_MODE === 'canvas' && themeDeco(cardTheme) === 'snow' && (
          <>
            <script src="/snow-canvas.js" defer />
            {/* 화면 전체의 눈 — 카드를 만나면 위 캔버스에 넘긴다 */}
            <script src="/snow-field.js" defer />
          </>
        )}
      </head>
      <body>
        {/* 배경 장식 — 장식을 깔 화면은 season-deco.tsx가 경로로 골랐다 */}
        <SeasonDeco kind={themeDeco(cardTheme)} />
        <I18nProvider locale={locale}>
          <CardThemeProvider value={cardTheme}>
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
          </CardThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
