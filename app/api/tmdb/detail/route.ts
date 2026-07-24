import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getTitleMeta, tmdbEnabled } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  if (!tmdbEnabled()) {
    return NextResponse.json({ error: 'TMDB_API_KEY가 설정되지 않았어요.' }, { status: 503 });
  }
  const type = req.nextUrl.searchParams.get('type');
  const id = Number(req.nextUrl.searchParams.get('id'));
  if ((type !== 'movie' && type !== 'tv') || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: '요청이 올바르지 않습니다.' }, { status: 400 });
  }
  try {
    return NextResponse.json({ meta: await getTitleMeta(type, id) });
  } catch (e) {
    console.error('[tmdb] detail failed:', e);
    return NextResponse.json({ error: '상세 조회에 실패했어요.' }, { status: 502 });
  }
}
