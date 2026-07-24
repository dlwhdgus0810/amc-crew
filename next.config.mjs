/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite(로컬 개발 폴백)의 WASM 에셋을 번들에서 제외
  serverExternalPackages: ['@electric-sql/pglite'],
  async redirects() {
    return [
      { source: '/groups', destination: '/movie/groups', permanent: true },
    ];
  },
};

export default nextConfig;
