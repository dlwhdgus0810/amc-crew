import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { isAnonymous } from '@/lib/categories';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getPostView } from '@/lib/db/posts';
import {
  deleteSettlement,
  getSettlements,
  notifySettlement,
  saveSettlement,
  settlementOwner,
  settlementNotifiedAt,
  settlementViewers,
  type ItemScope,
  type SettlementItemInput,
} from '@/lib/db/settlements';
import { friendIds } from '@/lib/db/friends';
import { parseAmountCents } from '@/lib/money';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** 항목은 이 정도면 충분하다 — 더 늘면 화면에서 읽기 어렵고 실수로 넣은 것일 가능성이 높다 */
const MAX_ITEMS = 10;

/**
 * 정산 조회 — 참가자와 관리자만.
 *
 * 누가 누구에게 얼마를 빚졌는지와 받을 계좌(Venmo·Zelle)가 담기므로 같이 낸 사람들 안에서만 돈다.
 * 권한이 없으면 403이 아니라 404를 준다 — "정산이 있다"는 사실 자체가 알려질 이유가 없다.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getSessionUser();
  if (!viewer) return await errJson(E.settleNotFound, 404);

  const post = await getPostView(id, viewer.id);
  if (!post) return await errJson(E.postNotFound, 404);
  // 모임에 없어도 이 정산에 이름이 올라간 사람은 자기 금액을 봐야 한다
  const allowed = (await settlementViewers(id)).includes(viewer.id);
  if (!allowed && !isAdmin(viewer)) return await errJson(E.settleNotFound, 404);

  const list = await getSettlements(id);
  /*
   * 「마지막으로 언제 알렸는지」는 **자기가 받을 정산에만** 내려준다.
   *
   * 다시 알리기 화면에서만 쓰는 값이고, 남이 언제 알림을 받았는지는 남의 일이다.
   * 정산이 여러 개라 정산별로 갈린다 — 내 정산 것만 담고 남의 것은 아예 안 읽는다.
   */
  const mine = list.filter((v) => v.payee.id === viewer.id || isAdmin(viewer));
  const notifiedAt: Record<string, Record<string, string>> = {};
  for (const v of mine) notifiedAt[v.id] = await settlementNotifiedAt(v.id);

  return NextResponse.json({ settlements: list, notifiedAt });
}

/** 정산 저장 + 각자에게 알림. 참가자만 만들 수 있고, 만든 사람이 받는 사람이 된다. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  const banned = await banGuard(user);
  if (banned) return banned;

  const { id } = await params;
  const post = await getPostView(id, user.id);
  if (!post) return await errJson(E.postNotFound, 404);
  /*
   * 이름이 안 보이는 카테고리에서는 정산을 열 수 없다.
   * 정산 화면은 「지훈 $12 · 민서 $8」처럼 금액 옆에 명단을 통째로 펴 놓는다 —
   * 카테고리를 익명으로 해 놓고 이걸 열어 두면 가린 의미가 없다.
   */
  if (isAnonymous(post.category)) return await errJson(E.anonNoSettle, 403);
  if (!post.participants.some((p) => p.id === user.id)) {
    return await errJson(E.settleParticipantOnly, 403);
  }
  /*
   * settlementId가 오면 그 정산을 고치는 것이고, 없으면 새로 만드는 것이다.
   * 한 모임에 정산이 여러 개라 「어느 것」을 부르는 쪽이 말해 줘야 한다.
   */
  const body = await req.json().catch(() => null);
  const settlementId = typeof body?.settlementId === 'string' ? body.settlementId : null;

  let payee: string | null = null;
  if (settlementId) {
    const owner = await settlementOwner(settlementId);
    // 없는 정산이거나 **다른 모임 것**이면 여기서 끝 — 주소의 모임과 안 맞는 요청이다
    if (!owner || owner.postId !== id) return await errJson(E.settleNotFound, 404);
    // 고치는 것은 그 정산을 받을 사람만 (관리자는 예외 — 잘못 만든 걸 치울 수 있어야 한다)
    if (owner.payeeId !== user.id && !isAdmin(user)) return await errJson(E.settleOwnerOnly, 403);
    payee = owner.payeeId;
  }

  const raw = Array.isArray(body?.items) ? body.items : null;
  if (!raw || raw.length === 0 || raw.length > MAX_ITEMS) return await errJson(E.settleItems, 400);

  /*
   * 낼 사람 후보 = 모임 참가자 + 만드는 사람이 넣은 자기 친구.
   * 친구인지는 서버에서 다시 확인한다 — 아무 아이디나 넣어 남의 이름으로 청구서를 만들 수 없어야 한다.
   */
  const asked = Array.isArray(body?.extraMemberIds)
    ? [...new Set((body.extraMemberIds as unknown[]).filter((v): v is string => typeof v === 'string'))].slice(0, 50)
    : [];
  const inMeetup = new Set(post.participants.map((p) => p.id));
  const myFriends = asked.length > 0 ? new Set(await friendIds(user.id)) : new Set<string>();
  const extraMemberIds = asked.filter((uid) => myFriends.has(uid) && !inMeetup.has(uid));

  const memberIds = new Set([...inMeetup, ...extraMemberIds]);
  const items: SettlementItemInput[] = [];
  for (const entry of raw) {
    const label = typeof entry?.label === 'string' ? entry.label.trim() : '';
    if (!label || label.length > 40) return await errJson(E.settleLabel, 400);

    const amountCents = parseAmountCents(entry?.amount);
    if (amountCents === null) return await errJson(E.settleAmount, 400);

    const scope: ItemScope = entry?.scope === 'some' ? 'some' : 'all';
    // 후보 밖의 사람은 걸러낸다 — 남의 이름으로 청구서를 만들 수 없어야 한다
    const picked: string[] =
      scope === 'some' && Array.isArray(entry?.memberIds)
        ? [
            ...new Set(
              (entry.memberIds as unknown[]).filter(
                (m): m is string => typeof m === 'string' && memberIds.has(m)
              )
            ),
          ]
        : [];
    if (scope === 'some' && picked.length === 0) return await errJson(E.settleMembers, 400);

    // 이 앱에 없는 사람 수 — 머릿수만 늘린다. 위로는 넉넉히 잡아 오타를 막는 정도만.
    const extraRaw = Number(entry?.extraPeople ?? 0);
    if (!Number.isInteger(extraRaw) || extraRaw < 0 || extraRaw > 50) {
      return await errJson(E.settleExtra, 400);
    }

    items.push({ label, amountCents, scope, memberIds: picked, extraPeople: extraRaw });
  }

  const savedId = await saveSettlement({
    postId: id,
    ...(settlementId ? { settlementId } : {}),
    payeeId: payee ?? user.id,
    items,
    extraMemberIds,
  });
  const { sent } = await notifySettlement(savedId, siteUrl(req.nextUrl.origin));
  return NextResponse.json({ ok: true, notified: sent, settlements: await getSettlements(id) });
}

/** 정산 하나 지우기 — 어느 정산인지 본문으로 받는다 (모임에 여러 개다) */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  const banned = await banGuard(user);
  if (banned) return banned;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const settlementId = typeof body?.settlementId === 'string' ? body.settlementId : '';
  if (!settlementId) return await errJson(E.settleNotFound, 404);

  const owner = await settlementOwner(settlementId);
  // 다른 모임 정산을 이 주소로 지우려는 요청도 여기서 걸린다
  if (!owner || owner.postId !== id) return await errJson(E.settleNotFound, 404);
  if (owner.payeeId !== user.id && !isAdmin(user)) return await errJson(E.settleOwnerOnly, 403);

  await deleteSettlement(settlementId);
  return NextResponse.json({ ok: true, settlements: await getSettlements(id) });
}
