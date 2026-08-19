import type { MetadataRoute } from 'next';
import { cookies } from 'next/headers';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { CARD_THEME_COOKIE, themeBarColor, toCardTheme } from '@/lib/card-theme';

const T = {
  name: { ko: 'Kansas Korean — 같이 놀 사람?', en: 'Kansas Korean — Who’s in?' },
  description: {
    ko: '영화·피클볼·볼링·축구·밥친구·카페 — 취미 모임 만들고 같이 놀 사람 모으기',
    en: 'Movies, pickleball, bowling, soccer, meals, cafés — create a meetup and find people to join',
  },
};

/**
 * PWA 매니페스트 (Next가 /manifest.webmanifest로 서빙하고 link 태그도 자동 삽입).
 * 홈 화면에 추가하면 주소창 없는 앱처럼 열린다.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const [locale, jar] = await Promise.all([getLocale(), cookies()]);
  const theme = toCardTheme(jar.get(CARD_THEME_COOKIE)?.value);
  return {
    name: pick(locale, T.name),
    short_name: 'Kansas Korean', // 홈 화면 아이콘 아래 표시 (길면 잘린다)
    description: pick(locale, T.description),
    lang: locale,
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F4EE', // 스플래시 배경 — 아이콘 종이색과 같은 값
    theme_color: themeBarColor(theme), // 상단 바 색 — 앱 배경(--bg)과 같아야 화면과 이어져 보인다
    icons: [
      // SVG를 먼저 둔다 — 지원하는 브라우저는 벡터를 골라 어느 크기에서도 또렷하다
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android 적응형 아이콘은 가장자리를 잘라내므로 안전 영역에 맞춘 별도 이미지를 쓴다
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
