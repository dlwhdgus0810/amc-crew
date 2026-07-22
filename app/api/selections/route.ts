import { NextRequest, NextResponse } from 'next/server';
import { getSchedule, setUserSelection, removeUser } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const showtimeIds = Array.isArray(body?.showtimeIds) ? body.showtimeIds : null;

  if (!name || name.length > 20) {
    return NextResponse.json({ error: '이름은 1~20자로 입력해주세요.' }, { status: 400 });
  }
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

  await setUserSelection(name, filtered);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim();
  if (!name) {
    return NextResponse.json({ error: 'name 파라미터가 필요합니다.' }, { status: 400 });
  }
  await removeUser(name);
  return NextResponse.json({ ok: true });
}
