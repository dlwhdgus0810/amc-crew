import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { searchTitles, tmdbEnabled } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!tmdbEnabled()) {
    // 키 미설정 — 클라이언트는 이 응답을 보고 자동완성을 끈다
    return await errJson(E.tmdbOff, 503);
  }
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  try {
    return NextResponse.json({ results: await searchTitles(q) });
  } catch (e) {
    console.error('[tmdb] search failed:', e);
    return await errJson(E.tmdbSearch, 502);
  }
}
