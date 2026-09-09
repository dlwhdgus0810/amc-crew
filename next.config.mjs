/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite(로컬 개발 폴백)의 WASM 에셋을 번들에서 제외
  serverExternalPackages: ['@electric-sql/pglite'],
  /*
   * experimental.staleTimes는 일부러 안 둔다 (동적 라우트 0초 = Next 기본값).
   *
   * 한때 dynamic: 30으로 탭을 옮겼다 돌아올 때 화면을 재사용했다. 내가 한 일은
   * router.refresh()로 바로 보였지만, **남이** 참가한 인원·새 모임은 최대 30초 옛 값이었고
   * 그게 「홈이 안 바뀐다」로 보였다. 탭마다 서버를 한 번 다녀오는 값(스켈레톤 잠깐)이
   * 틀린 숫자보다 싸다. 느리다고 느끼면 5~10초로 되살리는 게 다음 수다.
   */
  async redirects() {
    return [
      { source: '/groups', destination: '/movie/groups', permanent: true },
    ];
  },
};

export default nextConfig;
