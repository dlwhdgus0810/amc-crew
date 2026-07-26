import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSchedule, setUserSelection, removeUser } from '@/lib/store';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }

  const body = await req.json().catch(() => null);
  const showtimeIds = Array.isArray(body?.showtimeIds) ? body.showtimeIds : null;

  if (!showtimeIds || showtimeIds.length === 0) {
    return await errJson(E.showtimesRequired, 400);
  }

  // 존재하는 회차만 저장
  const schedule = await getSchedule();
  const valid = new Set(schedule.map((s) => s.id));
  const filtered = showtimeIds.filter((id: unknown) => typeof id === 'string' && valid.has(id));
  if (filtered.length === 0) {
    return await errJson(E.showtimesInvalid, 400);
  }

  await setUserSelection(user.id, user.name, filtered);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  await removeUser(user.id);
  return NextResponse.json({ ok: true });
}
