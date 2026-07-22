import { NextRequest, NextResponse } from 'next/server';
import { setSchedule } from '@/lib/store';
import { Showtime } from '@/lib/types';

export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const key = req.headers.get('x-admin-key');
  return Boolean(process.env.ADMIN_KEY && key === process.env.ADMIN_KEY);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: '관리자 키가 올바르지 않습니다.' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const schedule = body?.schedule;
  if (!Array.isArray(schedule)) {
    return NextResponse.json({ error: 'schedule 배열이 필요합니다.' }, { status: 400 });
  }
  const valid = schedule.every(
    (s: Showtime) =>
      typeof s?.id === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(s?.date ?? '') &&
      /^\d{2}:\d{2}$/.test(s?.time ?? '') &&
      typeof s?.format === 'string'
  );
  if (!valid) {
    return NextResponse.json({ error: '형식이 올바르지 않은 항목이 있습니다.' }, { status: 400 });
  }
  await setSchedule(schedule);
  return NextResponse.json({ ok: true, count: schedule.length });
}
