import { NextRequest, NextResponse } from 'next/server';
import { getSchedule, setUserSelection, removeUser } from '@/lib/store';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const showtimeIds = Array.isArray(body?.showtimeIds) ? body.showtimeIds : null;

  if (!showtimeIds || showtimeIds.length === 0) {
    return NextResponse.json({ error: '가능한 상영 회차를 1개 이상 선택해주세요.' }, { status: 400 });
  }

  // 존재하는 회차만 저장
  const schedule = await getSchedule();
  const valid = new Set(schedule.map((s) => s.id));
  const filtered = showtimeIds.filter((id: unknown) => typeof id === 'string' && valid.has(id));
  if (filtered.length === 0) {
    return NextResponse.json({ error: '유효한 회차가 없습니다. 새로고침 후 다시 시도해주세요.' }, { status: 400 });
  }

  await setUserSelection(user.id, user.name, filtered);
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  await removeUser(user.id);
  return NextResponse.json({ ok: true });
}
