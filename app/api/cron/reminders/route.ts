import { NextRequest, NextResponse } from 'next/server';
import { sendTodayReminders } from '@/lib/db/posts';
import { materializeDueOccurrences } from '@/lib/db/recurring';

export const dynamic = 'force-dynamic';

/**
 * 매일 아침 크론 (vercel.json crons):
 * 1) 정기 모임 규칙에서 다가오는 회차 생성 — 생성 시 구독자에게 알림이 나간다
 * 2) 오늘 모임 참가자에게 리마인더 발송
 *
 * 생성을 먼저 해야 오늘이 정기 모임 날인데 회차가 없던 경우도 리마인더에 포함된다.
 * CRON_SECRET 환경변수가 있으면 Vercel이 보내는 Authorization 헤더를 검증한다.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const origin = req.nextUrl.origin;
  const recurring = await materializeDueOccurrences(origin);
  const reminders = await sendTodayReminders(origin);
  return NextResponse.json({ ok: true, recurring, reminders });
}
