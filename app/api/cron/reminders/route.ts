import { NextRequest, NextResponse } from 'next/server';
import { sendTodayReminders } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

/**
 * 오늘 모임 리마인더 발송 (vercel.json crons가 매일 아침 호출).
 * CRON_SECRET 환경변수가 있으면 Vercel이 보내는 Authorization 헤더를 검증한다.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await sendTodayReminders(req.nextUrl.origin);
  return NextResponse.json({ ok: true, ...result });
}
