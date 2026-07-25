// 서비스 워커 — 홈 화면 설치(설치 배너)와 오프라인 안내만 담당한다.
//
// 캐시 정책은 의도적으로 보수적이다: 모임 목록·참가자·알림은 항상 최신이어야 하므로
//  · /api/* 는 절대 캐시하지 않는다 (워커가 관여조차 하지 않는다)
//  · 페이지(HTML)도 캐시하지 않는다 — 네트워크로만 받고, 실패하면 오프라인 안내를 띄운다
//  · 해시가 붙어 내용이 바뀌지 않는 /_next/static/ 산출물만 캐시한다
// 정책을 바꿀 때는 CACHE_VERSION을 올려 옛 캐시를 정리할 것.

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `kk-static-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // 외부 도메인(TMDB 포스터, 웹폰트 등)과 API는 워커가 손대지 않는다
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // 페이지 이동: 네트워크로만 받고, 실패하면 오프라인 안내
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // 빌드 산출물: 파일명에 해시가 있어 내용이 바뀌지 않으므로 캐시 우선
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          })
      )
    );
  }
  // 그 밖의 요청(아이콘 등)은 기본 동작에 맡긴다
});
