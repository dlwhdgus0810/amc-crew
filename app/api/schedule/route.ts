import { NextResponse } from 'next/server';
import { getProfiles, getSchedule, getSelections, resolveDisplayName } from '@/lib/store';
import { Selections } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [schedule, selections, profiles] = await Promise.all([
    getSchedule(),
    getSelections(),
    getProfiles(),
  ]);

  // 표시 이름은 읽기 시점에 프로필 기준으로 해석 (앱 닉네임 → 카카오 닉네임 → 저장 시점 스냅샷)
  const resolved: Selections = {};
  for (const [userId, sel] of Object.entries(selections)) {
    resolved[userId] = { ...sel, name: resolveDisplayName(profiles[userId], sel.name) };
  }

  return NextResponse.json({ schedule, selections: resolved });
}
