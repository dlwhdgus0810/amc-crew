import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { REGION_COOKIE, resolveRegion, type Region } from './region';

/**
 * 이 요청이 어느 지역인가 — 서버 전용 (headers()를 읽는다).
 *
 * 페이지·레이아웃·generateMetadata·manifest·OG 이미지는 getRegion(), 라우트 핸들러는
 * regionOfRequest(req). 둘 다 같은 규칙(lib/region.ts의 resolveRegion)이다.
 *
 * **unstable_cache 콜백 안에서 부르면 안 된다.** 거기서는 headers()를 못 읽는다.
 * 밖에서 구해 인자로 넘긴다 — 인자는 캐시 키에 들어가므로 지역별로 따로 담긴다.
 */
export const getRegion = cache(async (): Promise<Region> => {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return resolveRegion(h.get('host'), c.get(REGION_COOKIE)?.value);
});

export function regionOfRequest(req: NextRequest): Region {
  return resolveRegion(req.headers.get('host'), req.cookies.get(REGION_COOKIE)?.value);
}
