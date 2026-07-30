import { NextResponse } from 'next/server';
import { hostRanking } from '@/lib/db/hosting';

export const dynamic = 'force-dynamic';

/** 종합 주최 랭킹 — 로그인 없이도 보인다 (피드 자체가 공개라서) */
export async function GET() {
  return NextResponse.json({ hosts: await hostRanking() });
}
