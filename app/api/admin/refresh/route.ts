import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { setSchedule } from '@/lib/store';
import { amcConfigured, fetchAmcSchedule } from '@/lib/amc';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-admin-key');
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return await errJson(E.adminKey, 401);
  }
  if (!amcConfigured()) {
    return await errJson(E.amcNotConfigured, 400);
  }
  try {
    const schedule = await fetchAmcSchedule(7);
    if (schedule.length === 0) {
      return await errJson(E.amcNoShowtimes, 404);
    }
    await setSchedule(schedule);
    return NextResponse.json({ ok: true, count: schedule.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AMC API request failed' }, { status: 502 });
  }
}
