/* ============================================================
   새 파일 — app/api/next-meetups/route.ts 로 저장하세요.
   카드 하단 「다음 일정 한 줄」용 요약을 카테고리별로 한 번에 내려줍니다.

   GET /api/next-meetups
   → { today, summaries: { [slug]: { date, startTime, location, title,
                                     count, capacity, joined, postId } } }

   ============================================================ */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { POST_CATEGORY_SLUGS } from '@/lib/categories';
import { nextMeetupByCategory, type NextMeetup } from '@/lib/db/next-meetups';
import { todayLocal } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export async function GET() {
  const viewer = await getSessionUser();
  const summaries: Record<string, NextMeetup> = await nextMeetupByCategory(
    POST_CATEGORY_SLUGS,
    viewer?.id
  );
  return NextResponse.json({ today: todayLocal(), summaries });
}
