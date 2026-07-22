import { NextRequest, NextResponse } from 'next/server';
import { setSchedule } from '@/lib/store';
import { amcConfigured, fetchAmcSchedule } from '@/lib/amc';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const key = req.headers.get('x-admin-key');
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) {
    return NextResponse.json({ error: '관리자 키가 올바르지 않습니다.' }, { status: 401 });
  }
  if (!amcConfigured()) {
    return NextResponse.json(
      { error: 'AMC API가 설정되지 않았습니다. AMC_VENDOR_KEY와 AMC_THEATRE_ID 환경변수를 설정하세요.' },
      { status: 400 }
    );
  }
  try {
    const schedule = await fetchAmcSchedule(7);
    if (schedule.length === 0) {
      return NextResponse.json({ error: 'AMC API에서 The Odyssey 회차를 찾지 못했습니다.' }, { status: 404 });
    }
    await setSchedule(schedule);
    return NextResponse.json({ ok: true, count: schedule.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'AMC API 호출 실패' }, { status: 502 });
  }
}
