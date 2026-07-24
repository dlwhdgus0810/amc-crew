import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { searchTitles, tmdbEnabled } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  if (!tmdbEnabled()) {
    // 키 미설정 — 클라이언트는 이 응답을 보고 자동완성을 끈다
    return NextResponse.json({ error: 'TMDB_API_KEY가 설정되지 않았어요.' }, { status: 503 });
  }
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }
  try {
    return NextResponse.json({ results: await searchTitles(q) });
  } catch (e) {
    console.error('[tmdb] search failed:', e);
    return NextResponse.json({ error: '검색에 실패했어요.' }, { status: 502 });
  }
}
