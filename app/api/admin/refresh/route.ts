import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { clearDayCache, getDaySchedule } from '@/lib/store';
import { amcConfigured, searchAmcTheatres, theatreId } from '@/lib/amc';
import { scheduleDates } from '@/lib/seed';
import { todayLocal } from '@/lib/dates';

export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  return Boolean(process.env.ADMIN_KEY) && req.headers.get('x-admin-key') === process.env.ADMIN_KEY;
}

/** 극장 검색 — 극장 ID를 찾을 때 쓴다. ?name=town-center */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return await errJson(E.adminKey, 401);
  if (!amcConfigured()) return await errJson(E.amcNotConfigured, 400);
  try {
    const name = req.nextUrl.searchParams.get('name') ?? 'town-center';
    return NextResponse.json({ theatreId: theatreId(), theatres: await searchAmcTheatres(name) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AMC 요청 실패' }, { status: 502 });
  }
}

/** 상영표 캐시를 비우고 다시 받아온다 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return await errJson(E.adminKey, 401);
  if (!amcConfigured()) return await errJson(E.amcNotConfigured, 400);

  const dates = scheduleDates(todayLocal());
  try {
    await clearDayCache(dates);
    const day = await getDaySchedule(dates[0]);
    const count = day.movies.reduce((n, m) => n + m.showtimes.length, 0);
    if (count === 0) return await errJson(E.amcNoShowtimes, 404);
    return NextResponse.json({ ok: true, date: day.date, movies: day.movies.length, showtimes: count });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AMC 요청 실패' }, { status: 502 });
  }
}
