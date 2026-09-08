import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { clearSelections, getSelections, removeUser, setUserSelection, validPicks } from '@/lib/store';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { regionOfRequest } from '@/lib/region-server';

export const dynamic = 'force-dynamic';

/**
 * 관리자(ADMIN_KAKAO_ID에 등록된 카카오 계정) 전용.
 * DELETE            → 모든 선택 삭제
 * DELETE?userId=xxx → 특정 사용자의 선택만 삭제
 * PUT { userId, picks } → 특정 사용자의 선택 회차 수정 (빈 배열이면 참여 삭제)
 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  const picks = Array.isArray(body?.picks) ? body.picks : null;
  if (!userId || !picks) {
    return await errJson(E.userIdShowtimes, 400);
  }

  const region = regionOfRequest(req);
  const existing = (await getSelections(region))[userId];
  if (!existing) {
    return await errJson(E.participantNotFound, 404);
  }

  // 관리자 화면은 기존 선택에서 빼는 용도이므로, 남길 id만 받아 기존 스냅샷에서 고른다
  const keep = new Set(picks.filter((id: unknown): id is string => typeof id === 'string'));
  const filtered = await validPicks(region, existing.picks.filter((p) => keep.has(p.id)));

  if (filtered.length === 0) {
    await removeUser(region, userId);
    return NextResponse.json({ ok: true, removed: true });
  }
  await setUserSelection(region, userId, existing.name, filtered);
  return NextResponse.json({ ok: true, count: filtered.length });
}
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }

  const region = regionOfRequest(req);
  const userId = req.nextUrl.searchParams.get('userId');
  if (userId) {
    await removeUser(region, userId);
    return NextResponse.json({ ok: true, cleared: userId });
  }

  await clearSelections(region);
  return NextResponse.json({ ok: true, cleared: 'all' });
}
