import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { pushEnabled, removeSubscription, saveSubscription, subscriptionCount } from '@/lib/push';

export const dynamic = 'force-dynamic';

/** 이 계정이 푸시를 받고 있는 기기 수 (화면의 안내 문구용) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  return NextResponse.json({
    enabled: pushEnabled(),
    devices: pushEnabled() ? await subscriptionCount(user.id) : 0,
  });
}

/** 이 기기의 구독을 저장 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!pushEnabled()) return await errJson(E.pushNotConfigured, 400);

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  const p256dh = typeof body?.keys?.p256dh === 'string' ? body.keys.p256dh : '';
  const auth = typeof body?.keys?.auth === 'string' ? body.keys.auth : '';
  // 셋 중 하나라도 없으면 발송이 조용히 실패하므로 여기서 막는다
  if (!endpoint.startsWith('https://') || !p256dh || !auth) {
    return await errJson(E.badRequest, 400);
  }

  await saveSubscription(user.id, { endpoint, keys: { p256dh, auth } });
  return NextResponse.json({ ok: true, devices: await subscriptionCount(user.id) });
}

/** 이 기기의 구독을 해제 */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const body = await req.json().catch(() => null);
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : '';
  if (!endpoint) return await errJson(E.badRequest, 400);

  await removeSubscription(endpoint);
  return NextResponse.json({ ok: true, devices: await subscriptionCount(user.id) });
}
