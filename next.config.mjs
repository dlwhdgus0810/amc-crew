/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite(로컬 개발 폴백)의 WASM 에셋을 번들에서 제외
  serverExternalPackages: ['@electric-sql/pglite'],
  experimental: {
    /*
     * 탭을 옮겼다 돌아올 때 화면을 다시 받아오지 않는다.
     *
     * Next 15의 기본값은 동적 라우트 0초라, 탭바를 누를 때마다 서버에 다시 물었다.
     * 페이지가 데이터를 품고 오게 된 뒤로는 그 왕복이 곧 기다림이다.
     *
     * 대가는 30초의 낡음이다 — 내가 한 일은 곧바로 보인다(변경 뒤에 router.refresh()를
     * 부른다). 남이 만든 새 모임만 최대 30초 늦게 보인다.
     */
    staleTimes: { dynamic: 30, static: 180 },
  },
  async redirects() {
    return [
      { source: '/groups', destination: '/movie/groups', permanent: true },
    ];
  },
};

export default nextConfig;
