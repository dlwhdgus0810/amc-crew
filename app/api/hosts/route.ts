import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { POST_CATEGORY_SLUGS } from '@/lib/categories';
import { hostRanking } from '@/lib/db/hosting';

export const dynamic = 'force-dynamic';

/** 카테고리 주최 랭킹 — 로그인 없이도 보인다 (피드 자체가 공개라서) */
export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? '';
  if (!POST_CATEGORY_SLUGS.includes(category)) {
    return await errJson(E.badCategory, 400);
  }
  return NextResponse.json({ hosts: await hostRanking(category) });
}
