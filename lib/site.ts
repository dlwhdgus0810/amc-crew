/**
 * 밖으로 나가는 링크(카톡 알림, 공유, 캘린더)에 쓰는 공개 주소.
 *
 * 요청이 들어온 호스트를 그대로 쓰면 로컬 개발 중 보낸 알림에 localhost가 박히고,
 * vercel.app으로 들어온 요청은 알림도 vercel.app으로 나간다. 공개 주소로 고정한다.
 *
 * 로그인 리다이렉트에는 쓰지 말 것 — redirect_uri는 실제 접속한 호스트와 같아야
 * state 쿠키가 맞고 카카오에 등록된 주소와도 일치한다.
 */
const CONFIGURED = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');

/**
 * 설정해 둔 공개 주소 (없으면 null).
 * metadataBase처럼 "요청 호스트가 아니라 진짜 주소"가 필요한 곳에서 쓴다 —
 * 미리보기 이미지 주소가 요청마다 달라지면 카톡이 캐시를 따로따로 잡는다.
 */
export const SITE_URL = CONFIGURED ?? null;

export function siteUrl(fallbackOrigin: string): string {
  if (CONFIGURED) return CONFIGURED;
  // Vercel 프로덕션이면 프로젝트 공개 도메인이라도 쓴다 (localhost보다는 낫다)
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (process.env.NODE_ENV === 'production' && vercel) return `https://${vercel}`;
  return fallbackOrigin;
}
