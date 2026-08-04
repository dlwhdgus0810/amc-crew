import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { dbGetUser, ensureUser, setShowPastPrivate } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

/**
 * 지난 비공개 모임을 캘린더·지난 모임 목록에 띄울지.
 *
 * 기본은 꺼짐이다 — 비공개 모임은 끝나고 나면 대개 남에게 보일 이유가 없는 기록인데,
 * 캘린더는 지난 날짜도 함께 그려서 켜 두지 않으면 옆 사람 화면에 그대로 남는다.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ showPastPrivate: false });
  return NextResponse.json({ showPastPrivate: (await dbGetUser(user.id))?.showPastPrivate ?? false });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const body = await req.json().catch(() => null);
  if (typeof body?.on !== 'boolean') {
    return await errJson(E.badRequest, 400);
  }
  await ensureUser(user);
  await setShowPastPrivate(user.id, body.on);
  return NextResponse.json({ ok: true, showPastPrivate: body.on });
}
