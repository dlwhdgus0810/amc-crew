import { NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { listNotifications, unreadCount } from '@/lib/db/posts';
import { pendingIncomingCount } from '@/lib/db/friends';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  // 친구 요청 수도 같이 내려준다 — 알림 화면의 친구 줄에 배지를 달자고 요청을 하나 더 보낼 이유가 없다
  const [notifications, unread, pendingFriends] = await Promise.all([
    listNotifications(user.id),
    unreadCount(user.id),
    pendingIncomingCount(user.id),
  ]);
  return NextResponse.json({ notifications, unreadCount: unread, pendingFriends });
}
