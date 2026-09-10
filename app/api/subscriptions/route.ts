import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getSubscriptions, setSubscription } from '@/lib/db/posts';
import { openIn, POST_CATEGORY_SLUGS } from '@/lib/categories';
import { regionOfRequest } from '@/lib/region-server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ subscriptions: [] });
  }
  return NextResponse.json({ subscriptions: await getSubscriptions(user.id, regionOfRequest(req)) });
}

export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;
  const body = await req.json().catch(() => null);
  const category = typeof body?.category === 'string' ? body.category : '';
  const subscribed = Boolean(body?.subscribed);
  // 구독은 지역별이다 — 이 도메인의 카테고리를 구독한다
  const region = regionOfRequest(req);
  if (!POST_CATEGORY_SLUGS.includes(category) || !openIn(category, region)) {
    return await errJson(E.badCategory, 400);
  }
  await ensureUser(user);
  await setSubscription(user.id, category, region, subscribed);
  return NextResponse.json({ ok: true, subscriptions: await getSubscriptions(user.id, region) });
}
