import { NextRequest, NextResponse } from 'next/server';
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
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const category = typeof body?.category === 'string' ? body.category : '';
  const subscribed = Boolean(body?.subscribed);
  if (!POST_CATEGORY_SLUGS.includes(category)) {
    return NextResponse.json({ error: '올바르지 않은 카테고리입니다.' }, { status: 400 });
  }
  await ensureUser(user);
  await setSubscription(user.id, category, subscribed);
  return NextResponse.json({ ok: true, subscriptions: await getSubscriptions(user.id) });
}
