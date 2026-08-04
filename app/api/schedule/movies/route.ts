import { NextRequest, NextResponse } from 'next/server';
import { scheduleMovies } from '@/lib/schedule-day';

export const dynamic = 'force-dynamic';

/**
 * 하루치 상영표만. ?date=YYYY-MM-DD (없으면 오늘)
 *
 * 극장이 정해 둔 것이라 보는 사람에 따라 다르지 않고, 하루 동안 거의 바뀌지 않는다.
 * 그래서 브라우저가 5분 들고 있게 한다 — 날짜를 앞뒤로 넘겨 보는 동안 15KB짜리
 * 상영표를 매번 다시 받지 않는다. 선택 현황은 /api/schedule이 따로 내려준다.
 */
export async function GET(req: NextRequest) {
  return NextResponse.json(await scheduleMovies(req.nextUrl.searchParams.get('date')), {
    headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800' },
  });
}
