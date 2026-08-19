import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { getPostView } from '@/lib/db/posts';
import { setSettlementPaid, settlementViewers } from '@/lib/db/settlements';

export const dynamic = 'force-dynamic';

/**
 * 「보냈다」 표시 켜기·끄기.
 *
 * 낸 사람이 자기 줄을 누르면 「보냈어요」, 받을 사람이 남의 줄을 누르면 「받았어요」다.
 * 어느 쪽인지는 저장할 때 marked_by로 갈린다 (lib/db/settlements.ts).
 *
 * **관리자를 넣지 않았다.** 다른 자리에서는 관리자가 대신 손댈 수 있게 열어 두지만,
 * 여기는 돈이 오갔다는 기록이라 당사자 둘 말고는 건드릴 이유가 없다. 잘못 켜진 줄은
 * 받을 사람이 끄면 된다.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const banned = await banGuard(user);
  if (banned) return banned;

  const post = await getPostView(id, user.id);
  if (!post) return await errJson(E.postNotFound, 404);
  // 정산을 볼 수 없는 사람에게는 있다는 사실도 알리지 않는다 (GET과 같은 규칙)
  if (!(await settlementViewers(id)).includes(user.id)) return await errJson(E.settleNotFound, 404);

  const body = await req.json().catch(() => null);
  const settlementId = typeof body?.settlementId === 'string' ? body.settlementId : '';
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  const paid = body?.paid === true;
  if (!settlementId || !userId) return await errJson(E.badRequest, 400);

  const res = await setSettlementPaid(settlementId, userId, paid, user.id);
  if (!res.ok) {
    if (res.reason === 'forbidden') return await errJson(E.settlePaidForbidden, 403);
    return await errJson(E.settleNotFound, 404);
  }
  return NextResponse.json({ ok: true, paid });
}
