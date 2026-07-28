import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { listMeetupsBetween } from '@/lib/db/calendar';
import { todayLocal } from '@/lib/dates';

export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 한 번에 받을 수 있는 기간 — 월 격자(최대 42일)를 넉넉히 덮는 선에서 자른다 */
const MAX_DAYS = 62;

/**
 * 달력에 그릴 기간의 모임. ?from=YYYY-MM-DD&to=YYYY-MM-DD (양끝 포함).
 * 기간을 주지 않으면 오늘이 속한 달을 준다.
 */
export async function GET(req: NextRequest) {
  const today = todayLocal();
  const q = req.nextUrl.searchParams;
  const from = q.get('from') ?? `${today.slice(0, 7)}-01`;
  const to = q.get('to') ?? `${today.slice(0, 7)}-31`;

  if (!DATE.test(from) || !DATE.test(to) || from > to) {
    return await errJson(E.badRequest, 400);
  }
  if (Date.parse(to) - Date.parse(from) > MAX_DAYS * 86_400_000) {
    return await errJson(E.badRequest, 400);
  }

  const viewer = await getSessionUser();
  return NextResponse.json({ from, to, today, meetups: await listMeetupsBetween(from, to, viewer?.id) });
}
