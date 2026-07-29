import { NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { listOnline, listPresenceStats, ONLINE_WINDOW_MINUTES, totalUsers, touchPresence } from '@/lib/db/presence';

export const dynamic = 'force-dynamic';

/** 신호 한 번 — 앱을 보고 있는 동안 app/presence-beat.tsx가 주기적으로 부른다 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    // 비로그인은 조용히 401 — 클라이언트가 이걸 보고 신호를 아예 멈춘다
    return await errJson(E.loginRequired, 401);
  }
  await touchPresence(user.id);
  return NextResponse.json({ ok: true });
}

/** 지금 접속 중인 사람 (관리자 전용) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }
  const [online, total, stats] = await Promise.all([listOnline(), totalUsers(), listPresenceStats()]);
  return NextResponse.json({ online, total, stats, windowMinutes: ONLINE_WINDOW_MINUTES });
}
