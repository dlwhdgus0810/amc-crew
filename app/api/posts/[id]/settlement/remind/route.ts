import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getSettlementById, notifySettlement, settlementOwner } from '@/lib/db/settlements';

export const dynamic = 'force-dynamic';

/**
 * 정산 알림 다시 보내기.
 *
 * 한 번 간 알림은 못 보고 지나치기 쉽다. 받을 사람이 아직 안 준 사람만 골라 다시 찌를 수 있게 한다.
 *
 * 문구는 처음과 같은 것이 나간다(notifySettlement가 만든다) — 「다시 보냅니다」 같은 말을
 * 덧붙이지 않는다. 받는 쪽에서 중요한 건 얼마를 누구에게 보내느냐지, 이게 몇 번째인지가 아니다.
 * 푸시는 tag가 같아서 잠금화면에 쌓이지 않고 이전 것을 대신한다.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const banned = await banGuard(user);
  if (banned) return banned;

  /*
   * 어느 정산인지 본문으로 받는다 — 한 모임에 여러 개다. 주소의 모임과 안 맞는 정산 id는
   * 여기서 걸린다 (안 걸르면 남의 모임 정산으로 알림을 쏠 수 있다).
   */
  const body = await req.json().catch(() => null);
  const settlementId = typeof body?.settlementId === 'string' ? body.settlementId : '';
  if (!settlementId) return await errJson(E.settleNotFound, 404);
  const owner = await settlementOwner(settlementId);
  if (!owner || owner.postId !== id) return await errJson(E.settleNotFound, 404);

  const settlement = await getSettlementById(settlementId);
  if (!settlement) return await errJson(E.settleNotFound, 404);
  // 보내는 사람은 받을 사람뿐 — 남이 대신 찌를 일이 아니다
  if (settlement.payee.id !== user.id && !isAdmin(user)) {
    return await errJson(E.settleOwnerOnly, 403);
  }
  const asked: string[] = Array.isArray(body?.userIds) ? body.userIds.filter((v: unknown) => typeof v === 'string') : [];
  // 실제로 낼 금액이 있는 사람만 남긴다 — 받을 사람 본인과 명단에 없는 id는 뺀다
  const owing = new Set(
    settlement.shares
      .filter((sh) => sh.userId !== settlement.payee.id)
      .map((sh) => sh.userId)
  );
  const userIds = [...new Set(asked)].filter((uid) => owing.has(uid));
  if (userIds.length === 0) return await errJson(E.remindNobody, 400);

  // 주소는 notifySettlement가 그 모임의 지역으로 만든다 — 여기서는 요청 주소만 넘긴다
  const { sent } = await notifySettlement(settlementId, req.nextUrl.origin, userIds);
  return NextResponse.json({ ok: true, sent });
}
