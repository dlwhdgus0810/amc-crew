import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { clearSelections, getSchedule, getSelections, removeUser, setUserSelection } from '@/lib/store';
import { getSessionUser, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * 관리자(ADMIN_KAKAO_ID에 등록된 카카오 계정) 전용.
 * DELETE            → 모든 선택 삭제
 * DELETE?userId=xxx → 특정 사용자의 선택만 삭제
 * PUT { userId, showtimeIds } → 특정 사용자의 선택 회차 수정 (빈 배열이면 참여 삭제)
 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  const showtimeIds = Array.isArray(body?.showtimeIds) ? body.showtimeIds : null;
  if (!userId || !showtimeIds) {
    return await errJson(E.userIdShowtimes, 400);
  }

  const existing = (await getSelections())[userId];
  if (!existing) {
    return await errJson(E.participantNotFound, 404);
  }

  const schedule = await getSchedule();
  const valid = new Set(schedule.map((s) => s.id));
  const filtered = showtimeIds.filter((id: unknown): id is string => typeof id === 'string' && valid.has(id));

  if (filtered.length === 0) {
    await removeUser(userId);
    return NextResponse.json({ ok: true, removed: true });
  }
  await setUserSelection(userId, existing.name, filtered);
  return NextResponse.json({ ok: true, count: filtered.length });
}
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }

  const userId = req.nextUrl.searchParams.get('userId');
  if (userId) {
    await removeUser(userId);
    return NextResponse.json({ ok: true, cleared: userId });
  }

  await clearSelections();
  return NextResponse.json({ ok: true, cleared: 'all' });
}
