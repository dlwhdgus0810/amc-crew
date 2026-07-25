import type { MetadataRoute } from 'next';

/**
 * PWA 매니페스트 (Next가 /manifest.webmanifest로 서빙하고 link 태그도 자동 삽입).
 * 홈 화면에 추가하면 주소창 없는 앱처럼 열린다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kansas Korean — 같이 놀 사람?',
    short_name: 'Kansas Korean', // 홈 화면 아이콘 아래 표시 (길면 잘린다)
    description: '영화·피클볼·볼링·축구 — 취미 모임 만들고 같이 놀 사람 모으기',
    lang: 'ko',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f4ee', // 스플래시 배경 — 아이콘 배경과 맞춘다
    theme_color: '#ffffff', // 상단 바 색 — 앱 배경과 맞춘다
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // Android 적응형 아이콘은 가장자리를 잘라내므로 안전 영역에 맞춘 별도 이미지를 쓴다
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
