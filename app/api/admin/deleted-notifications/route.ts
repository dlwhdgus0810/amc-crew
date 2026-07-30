import { NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { listDeletedNotifications } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

/** 사용자가 지운 알림 목록 (관리자 전용) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);
  return NextResponse.json({ notifications: await listDeletedNotifications() });
}
