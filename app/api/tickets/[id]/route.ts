import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getTicket, reviewTicket, TICKET_STATUSES, TicketStatus } from '@/lib/db/tickets';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** 건의 처리 (관리자 전용) — 상태 변경 + 선택적 답변 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!isAdmin(user)) {
    return await errJson(E.adminOnlyReview, 403);
  }

  const { id } = await params;
  // 외부에서 들어오는 id이므로 uuid 형태가 아니면 캐스팅 에러 대신 404 처리
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return await errJson(E.ticketNotFound, 404);
  }
  const ticket = await getTicket(id);
  if (!ticket) {
    return await errJson(E.ticketNotFound, 404);
  }

  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (!TICKET_STATUSES.includes(status as TicketStatus)) {
    return await errJson(E.badStatus, 400);
  }
  const adminNote = typeof body?.adminNote === 'string' ? body.adminNote.trim() : '';
  if (adminNote.length > 500) {
    return await errJson(E.adminNote, 400);
  }

  await reviewTicket({
    id,
    status: status as TicketStatus,
    ...(adminNote ? { adminNote } : {}),
    requesterId: ticket.userId,
    number: ticket.number,
    title: ticket.title,
    origin: siteUrl(req.nextUrl.origin),
  });
  return NextResponse.json({ ok: true });
}
