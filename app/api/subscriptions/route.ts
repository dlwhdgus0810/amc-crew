import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getSubscriptions, setSubscription } from '@/lib/db/posts';
import { POST_CATEGORY_SLUGS } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ subscriptions: [] });
  }
  return NextResponse.json({ subscriptions: await getSubscriptions(user.id) });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const body = await req.json().catch(() => null);
  const category = typeof body?.category === 'string' ? body.category : '';
  const subscribed = Boolean(body?.subscribed);
  if (!POST_CATEGORY_SLUGS.includes(category)) {
    return await errJson(E.badCategory, 400);
  }
  await ensureUser(user);
  await setSubscription(user.id, category, subscribed);
  return NextResponse.json({ ok: true, subscriptions: await getSubscriptions(user.id) });
}
