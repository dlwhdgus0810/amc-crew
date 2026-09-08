import { REGIONS, type Region } from './region';

/**
 * 밖으로 나가는 링크(푸시 알림, 공유, 캘린더)에 쓰는 공개 주소 — 지역마다 다르다.
 *
 * 요청이 들어온 호스트를 그대로 쓰면 로컬 개발 중 보낸 알림에 localhost가 박히고,
 * vercel.app으로 들어온 요청은 알림도 vercel.app으로 나간다. 지역의 공개 주소로 고정한다
 * (NEXT_PUBLIC_SITE_URL·NEXT_PUBLIC_SITE_URL_PHILLY — lib/region.ts).
 *
 * 어느 지역의 주소를 쓸지는 **무엇의 링크인가**로 정한다. 모임 링크는 그 모임의 지역
 * (post.region), 새 소식·승급처럼 사람에게 가는 것은 그 사람의 home_region, 그 밖에는
 * 요청이 들어온 호스트의 지역이다.
 *
 * 로그인 리다이렉트에는 쓰지 말 것 — redirect_uri는 실제 접속한 호스트와 같아야
 * state 쿠키가 맞고 카카오에 등록된 주소와도 일치한다.
 */

/**
 * 설정해 둔 공개 주소 (없으면 null).
 * metadataBase처럼 "요청 호스트가 아니라 진짜 주소"가 필요한 곳에서 쓴다 —
 * 미리보기 이미지 주소가 요청마다 달라지면 카톡이 캐시를 따로따로 잡는다.
 */
export function configuredSiteUrl(region: Region): string | null {
  return REGIONS[region].siteUrl;
}

export function siteUrl(region: Region, fallbackOrigin = ''): string {
  const configured = REGIONS[region].siteUrl;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    // 캔자스는 예전 그대로 Vercel 프로젝트 공개 도메인이라도 쓴다 (localhost보다는 낫다)
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
    if (region === 'kansas' && vercel) return `https://${vercel}`;
    // 그 밖의 지역은 대표 도메인 — 설정을 안 했어도 다른 지역 주소로 새면 안 된다
    return `https://${REGIONS[region].hosts[0]}`;
  }
  return fallbackOrigin;
}

/** 알림 제목·<title>에 적는 앱 이름 — 어느 앱에서 온 것인지가 먼저 보여야 한다 */
export function appName(region: Region): string {
  return REGIONS[region].name;
}
