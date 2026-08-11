import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { ensureUser, setShowPresence } from '@/lib/db/users';

export const dynamic = 'force-dynamic';

/**
 * 「친구들에게 접속 중으로 보이기」를 내가 끄고 켠다.
 *
 * /api/presence의 PUT과 같은 칸(users.show_presence)을 건드리지만 그쪽은 관리자 전용이다.
 * 관리자 화면의 접속 표에 딸린 스위치라서 그렇게 잠가 두었는데, 그러면 일반 회원은
 * 자기가 세어지는 것을 멈출 방법이 없다. 회원이 자기 것을 바꾸는 문은 따로 연다.
 *
 * 끄면 친구 화면의 「친구 n명」에서 빠진다. 신호 자체는 그대로 쌓이므로 관리자 화면의
 * 접속 기록은 영향을 받지 않는다 — 끄는 것은 남에게 보이는 표시뿐이다.
 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;

  const body = await req.json().catch(() => null);
  if (typeof body?.on !== 'boolean') {
    return await errJson(E.badRequest, 400);
  }
  await ensureUser(user);
  await setShowPresence(user.id, body.on);
  return NextResponse.json({ ok: true, showPresence: body.on });
}
