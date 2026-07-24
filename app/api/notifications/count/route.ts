import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { unreadCount } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ unreadCount: 0 });
  }
  return NextResponse.json({ unreadCount: await unreadCount(user.id) });
}
