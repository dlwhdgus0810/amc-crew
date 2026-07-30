import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getPostView } from '@/lib/db/posts';
import {
  deleteSettlement,
  getSettlement,
  notifySettlement,
  saveSettlement,
  settlementPayee,
  type ItemScope,
  type SettlementItemInput,
} from '@/lib/db/settlements';
import { parseAmountCents } from '@/lib/money';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** 항목은 이 정도면 충분하다 — 더 늘면 화면에서 읽기 어렵고 실수로 넣은 것일 가능성이 높다 */
const MAX_ITEMS = 10;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getSessionUser();
  // 비공개 모임을 정산으로 엿볼 수 없도록, 모임을 볼 수 있는지부터 확인한다
  const post = await getPostView(id, viewer?.id);
  if (!post) return await errJson(E.postNotFound, 404);
  if (post.visibility === 'link' && !viewer) return await errJson(E.loginRequired, 401);
  return NextResponse.json({ settlement: await getSettlement(id) });
}

/** 정산 저장 + 각자에게 알림. 참가자만 만들 수 있고, 만든 사람이 받는 사람이 된다. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const { id } = await params;
  const post = await getPostView(id, user.id);
  if (!post) return await errJson(E.postNotFound, 404);
  if (!post.participants.some((p) => p.id === user.id)) {
    return await errJson(E.settleParticipantOnly, 403);
  }
  // 이미 있는 정산은 만든 사람만 고친다 (관리자는 예외 — 잘못 만든 걸 치울 수 있어야 한다)
  const payee = await settlementPayee(id);
  if (payee && payee !== user.id && !isAdmin(user)) {
    return await errJson(E.settleOwnerOnly, 403);
  }

  const body = await req.json().catch(() => null);
  const raw = Array.isArray(body?.items) ? body.items : null;
  if (!raw || raw.length === 0 || raw.length > MAX_ITEMS) return await errJson(E.settleItems, 400);

  const memberIds = new Set(post.participants.map((p) => p.id));
  const items: SettlementItemInput[] = [];
  for (const entry of raw) {
    const label = typeof entry?.label === 'string' ? entry.label.trim() : '';
    if (!label || label.length > 40) return await errJson(E.settleLabel, 400);

    const amountCents = parseAmountCents(entry?.amount);
    if (amountCents === null) return await errJson(E.settleAmount, 400);

    const scope: ItemScope = entry?.scope === 'some' ? 'some' : 'all';
    // 참가자가 아닌 사람은 걸러낸다 — 남의 이름으로 청구서를 만들 수 없어야 한다
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

    items.push({ label, amountCents, scope, memberIds: picked });
  }

  await saveSettlement({ postId: id, payeeId: payee ?? user.id, items });
  const { sent } = await notifySettlement(id, siteUrl(req.nextUrl.origin));
  return NextResponse.json({ ok: true, notified: sent, settlement: await getSettlement(id) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const { id } = await params;
  const payee = await settlementPayee(id);
  if (!payee) return await errJson(E.settleNotFound, 404);
  if (payee !== user.id && !isAdmin(user)) return await errJson(E.settleOwnerOnly, 403);

  await deleteSettlement(id);
  return NextResponse.json({ ok: true });
}
