import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { softDeleteNotification } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

/** 내 알림 하나 지우기 (표시만 — 관리자 화면에는 남는다) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const { id } = await params;
  // 남의 알림이거나 이미 지운 것이면 false — 어느 쪽인지는 알려주지 않는다
  const ok = await softDeleteNotification(id, user.id);
  if (!ok) return await errJson(E.notifNotFound, 404);
  return NextResponse.json({ ok: true });
}
