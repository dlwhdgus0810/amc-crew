import { NextRequest, NextResponse } from 'next/server';
import { sendTodayReminders } from '@/lib/db/posts';
import { materializeDueOccurrences } from '@/lib/db/recurring';
import { announceTierUps } from '@/lib/db/tiers';
import { siteUrl } from '@/lib/site';
import { REGION_IDS, type Region } from '@/lib/region';

export const dynamic = 'force-dynamic';

/**
 * 매일 아침 크론 (vercel.json crons):
 * 1) 정기 모임 규칙에서 다가오는 회차 생성 — 생성 시 구독자에게 알림이 나간다
 * 2) 오늘 모임 참가자에게 리마인더 발송
 * 3) 등급이 오른 사람에게 알림 발송
 *
 * 생성을 먼저 해야 오늘이 정기 모임 날인데 회차가 없던 경우도 리마인더에 포함된다.
 *
 * 등급은 마지막이다. 어제 끝난 모임의 점수를 세는 일이라 오늘 무엇이 만들어지든 상관이
 * 없고, 여기서 무슨 일이 나도 리마인더는 이미 나가 있어야 한다 — 오늘 모임에 못 오는
 * 쪽이 등급 축하를 못 받는 쪽보다 아프다.
 *
 * 1)·2)는 지역마다 한 번씩 돈다 — 「오늘」이 지역 시계마다 다르고 링크도 그 지역 도메인이다.
 * 13:00 UTC 한 번이면 캔자스 8시·펜 9시(겨울엔 7시·8시)라 둘 다 아침이고 같은 날짜다.
 * 3)은 사람의 것이라 한 번이다.
 * CRON_SECRET 환경변수가 있으면 Vercel이 보내는 Authorization 헤더를 검증한다.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // 프로덕션에서 시크릿이 없으면 열어두지 않고 거부한다 (예전엔 미설정 시 무인증 실행이었다).
  // 로컬은 시크릿 없이 수동 실행할 수 있게 둔다.
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[cron] CRON_SECRET is not configured — refusing to run');
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
  } else if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const fallback = req.nextUrl.origin;
  const regions: Partial<Record<Region, { recurring: unknown; reminders: unknown }>> = {};
  for (const region of REGION_IDS) {
    const origin = siteUrl(region, fallback);
    const recurring = await materializeDueOccurrences(region, origin);
    const reminders = await sendTodayReminders(region, origin);
    regions[region] = { recurring, reminders };
  }
  const tiers = await announceTierUps(fallback);
  return NextResponse.json({ ok: true, ...regions, tiers });
}
