import { NextRequest, NextResponse } from 'next/server';
import { scheduleDay } from '@/lib/schedule-day';

export const dynamic = 'force-dynamic';

/**
 * 하루치 상영표 + 전체 선택 현황.
 * ?date=YYYY-MM-DD (없으면 오늘). 고를 수 있는 날짜 목록도 함께 내려준다.
 *
 * 내용은 lib/schedule-day.ts가 만든다 — 첫 하루치는 서버 렌더가 같은 함수로 읽어
 * 넘기고, 이 라우트는 날짜를 바꿀 때 쓰인다.
 */
export async function GET(req: NextRequest) {
  return NextResponse.json(await scheduleDay(req.nextUrl.searchParams.get('date')));
}
