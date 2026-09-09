import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { listOnline, listPresenceStats, ONLINE_WINDOW_MINUTES, totalUsers, touchPresence } from '@/lib/db/presence';
import { dbGetUser, ensureUser, setShowPresence } from '@/lib/db/users';
import { regionOfRequest } from '@/lib/region-server';

export const dynamic = 'force-dynamic';

/** 신호 한 번 — 앱을 보고 있는 동안 app/presence-beat.tsx가 주기적으로 부른다 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    // 비로그인은 조용히 401 — 클라이언트가 이걸 보고 신호를 아예 멈춘다
    return await errJson(E.loginRequired, 401);
  }
  // 정지된 사람은 "지금 접속 중"에도 뜨지 않는다 — 쓰지 못하는 사람이 쓰고 있는 것처럼 보이면 안 된다
  const banned = await banGuard(user);
  if (banned) return banned;
  await touchPresence(user.id, regionOfRequest(req));
  return NextResponse.json({ ok: true });
}

/** 지금 접속 중인 사람 (관리자 전용) */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }
  const [online, total, stats, me] = await Promise.all([
    listOnline(),
    totalUsers(),
    // 활동 시간대는 보고 있는 도메인의 시계로
    listPresenceStats(regionOfRequest(req)),
    dbGetUser(user.id),
  ]);
  return NextResponse.json({
    online,
    total,
    stats,
    windowMinutes: ONLINE_WINDOW_MINUTES,
    // 내 스위치 상태 — 화면이 "지금 어느 쪽인지"를 보여줘야 눌러도 되는 버튼이 된다
    myPresence: me?.showPresence ?? true,
  });
}

/**
 * 내 접속 표시를 켜고 끈다 — 친구들 화면에서만 사라진다.
 *
 * 관리자만 받는다. 이 스위치는 관리자 화면에만 있어서, 다른 사람에게 받아 두면
 * 본인은 켜져 있는지 꺼져 있는지 볼 수도, 되돌릴 수도 없는 상태가 남는다.
 * (친구별로 감추는 것은 누구나 /friends/[id]에서 할 수 있다.)
 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }
  const body = await req.json().catch(() => null);
  if (typeof body?.on !== 'boolean') {
    return await errJson(E.badRequest, 400);
  }
  await ensureUser(user);
  await setShowPresence(user.id, body.on);
  return NextResponse.json({ ok: true, myPresence: body.on });
}
