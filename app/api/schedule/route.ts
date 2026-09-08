import { NextRequest, NextResponse } from 'next/server';
import { schedulePicks } from '@/lib/schedule-day';
import { regionOfRequest } from '@/lib/region-server';

export const dynamic = 'force-dynamic';

/**
 * 누가 어느 회차를 골랐는지. ?date=YYYY-MM-DD (없으면 오늘)
 *
 * 상영표는 /api/schedule/movies가 따로 내려준다 — 그쪽은 잠시 캐시하고, 이쪽은
 * 누가 회차를 누르면 바로 달라져야 해서 담아 두지 않는다.
 */
export async function GET(req: NextRequest) {
  return NextResponse.json(await schedulePicks(regionOfRequest(req), req.nextUrl.searchParams.get('date')), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
