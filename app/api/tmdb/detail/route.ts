import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { getTitleMeta, tmdbEnabled } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!tmdbEnabled()) {
    return await errJson(E.tmdbOff, 503);
  }
  const type = req.nextUrl.searchParams.get('type');
  const id = Number(req.nextUrl.searchParams.get('id'));
  if ((type !== 'movie' && type !== 'tv') || !Number.isInteger(id) || id <= 0) {
    return await errJson(E.badRequest, 400);
  }
  try {
    return NextResponse.json({ meta: await getTitleMeta(type, id) });
  } catch (e) {
    console.error('[tmdb] detail failed:', e);
    return await errJson(E.tmdbDetail, 502);
  }
}
