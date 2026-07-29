import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getProfiles, resolveDisplayName } from '@/lib/store';
import { createTicket, listTickets, TICKET_KINDS, TicketKind } from '@/lib/db/tickets';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** 관리자는 전체를 본다. ?mine=1이면 관리자도 자기 건의만 (건의함 화면용). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const mineOnly = req.nextUrl.searchParams.get('mine') === '1' || !isAdmin(user);
  return NextResponse.json({ tickets: await listTickets(mineOnly ? user.id : undefined) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }

  const body = await req.json().catch(() => null);
  const kind = typeof body?.kind === 'string' ? body.kind : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const detail = typeof body?.body === 'string' ? body.body.trim() : '';
  const anonymous = Boolean(body?.anonymous);

  if (!TICKET_KINDS.includes(kind as TicketKind)) {
    return await errJson(E.ticketKind, 400);
  }
  if (!title || title.length > 80) {
    return await errJson(E.ticketTitle, 400);
  }
  if (detail.length > 2000) {
    return await errJson(E.ticketBody, 400);
  }

  await ensureUser(user);
  const profile = (await getProfiles())[user.id];
  const ticket = await createTicket({
    userId: user.id,
    userName: resolveDisplayName(profile, user.name),
    kind: kind as TicketKind,
    title,
    anonymous,
    ...(detail ? { body: detail } : {}),
    origin: siteUrl(req.nextUrl.origin),
  });
  return NextResponse.json({ ok: true, ...ticket });
}
