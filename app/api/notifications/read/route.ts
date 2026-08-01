import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { markNotificationsRead } from '@/lib/db/posts';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;
  const body = await req.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === 'string') : undefined;
  await markNotificationsRead(user.id, ids);
  return NextResponse.json({ ok: true });
}
