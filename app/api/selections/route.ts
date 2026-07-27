import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { setUserSelection, removeUser, validPicks } from '@/lib/store';
import { getSessionUser } from '@/lib/auth';
import { Showtime } from '@/lib/types';

export const dynamic = 'force-dynamic';

const FORMATS = ['IMAX with Laser', 'Dolby Cinema', 'PRIME', 'Laser'];

/** 클라이언트가 보낸 회차를 필드 화이트리스트로 정제 (형태가 어긋나면 버린다) */
function sanitize(raw: unknown): Showtime | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');
  const id = str(r.id);
  const date = str(r.date);
  const time = str(r.time);
  const movieName = str(r.movieName).slice(0, 200);
  const format = str(r.format);
  if (!id || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  if (!movieName || !FORMATS.includes(format)) return null;
  return {
    id: id.slice(0, 100),
    movieId: (str(r.movieId) || movieName).slice(0, 100),
    movieName,
    date,
    time,
    format: format as Showtime['format'],
    ...(str(r.note) ? { note: str(r.note).slice(0, 50) } : {}),
  };
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }

  const body = await req.json().catch(() => null);
  const raw = Array.isArray(body?.picks) ? body.picks : null;
  if (!raw || raw.length === 0) {
    return await errJson(E.showtimesRequired, 400);
  }

  const picks = raw.map(sanitize).filter((p: Showtime | null): p is Showtime => p !== null);
  // 실제 상영표에 있는 회차만 남긴다 (오래된 화면에서 사라진 회차를 보낼 수 있다)
  const valid = await validPicks(picks);
  if (valid.length === 0) {
    return await errJson(E.showtimesInvalid, 400);
  }

  await setUserSelection(user.id, user.name, valid);
  return NextResponse.json({ ok: true, saved: valid.length });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  await removeUser(user.id);
  return NextResponse.json({ ok: true });
}
