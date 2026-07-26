import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { setSchedule } from '@/lib/store';
import { Showtime } from '@/lib/types';

export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const key = req.headers.get('x-admin-key');
  return Boolean(process.env.ADMIN_KEY && key === process.env.ADMIN_KEY);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return await errJson(E.adminKey, 401);
  }
  const body = await req.json().catch(() => null);
  const schedule = body?.schedule;
  if (!Array.isArray(schedule)) {
    return await errJson(E.scheduleArray, 400);
  }
  const valid = schedule.every(
    (s: Showtime) =>
      typeof s?.id === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(s?.date ?? '') &&
      /^\d{2}:\d{2}$/.test(s?.time ?? '') &&
      typeof s?.format === 'string'
  );
  if (!valid) {
    return await errJson(E.scheduleShape, 400);
  }
  await setSchedule(schedule);
  return NextResponse.json({ ok: true, count: schedule.length });
}
