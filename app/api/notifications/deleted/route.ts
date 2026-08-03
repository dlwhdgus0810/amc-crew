import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { banGuard } from '@/lib/guard';
import { listMyDeletedNotifications, restoreNotification } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

/** 내가 지운 알림 모아보기 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  return NextResponse.json({ notifications: await listMyDeletedNotifications(user.id) });
}

/** 잘못 지운 것을 되돌린다 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) {
    return await errJson(E.badRequest, 400);
  }
  // 남의 알림이거나 지운 적 없는 것이면 false — 어느 쪽인지는 알려주지 않는다
  if (!(await restoreNotification(id, user.id))) {
    return await errJson(E.notifNotFound, 404);
  }
  return NextResponse.json({ ok: true });
}
