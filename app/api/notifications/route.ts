import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { listNotifications, unreadCount } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  const [notifications, unread] = await Promise.all([listNotifications(user.id), unreadCount(user.id)]);
  return NextResponse.json({ notifications, unreadCount: unread });
}
