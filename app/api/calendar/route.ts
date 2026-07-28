import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { listMonthMeetups } from '@/lib/db/calendar';
import { todayLocal } from '@/lib/dates';

export const dynamic = 'force-dynamic';

/**
 * 달력 한 달치 모임. ?month=YYYY-MM (없으면 이번 달).
 *
 * "오늘"도 함께 내려준다 — 기기 시계는 다른 시간대일 수 있어서, 오늘 표시를 브라우저에
 * 맡기면 캔자스 기준으로 하루가 어긋난 칸에 동그라미가 그려진다.
 */
export async function GET(req: NextRequest) {
  const today = todayLocal();
  const requested = req.nextUrl.searchParams.get('month');
  if (requested && !/^\d{4}-(0[1-9]|1[0-2])$/.test(requested)) {
    return await errJson(E.badRequest, 400);
  }
  const month = requested ?? today.slice(0, 7);

  const viewer = await getSessionUser();
  return NextResponse.json({ month, today, meetups: await listMonthMeetups(month, viewer?.id) });
}
