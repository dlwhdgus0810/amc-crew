import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getProfiles, localName } from '@/lib/store';
import { createTicket, listTickets, TICKET_KINDS, TicketKind } from '@/lib/db/tickets';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** 관리자는 전체를 본다. ?mine=1이면 관리자도 자기 건의만 (건의함 화면용). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;
  const mineOnly = req.nextUrl.searchParams.get('mine') === '1' || !isAdmin(user);
  return NextResponse.json({ tickets: await listTickets(mineOnly ? user.id : undefined) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;

  const body = await req.json().catch(() => null);
  const kind = typeof body?.kind === 'string' ? body.kind : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const detail = typeof body?.body === 'string' ? body.body.trim() : '';

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
  // 관리자 알림 문구에 실릴 이름 — 받는 관리자의 언어로 정해진다
  const name = localName(profile, user.name);
  const ticket = await createTicket({
    userId: user.id,
    userName: name,
    kind: kind as TicketKind,
    title,
    ...(detail ? { body: detail } : {}),
    origin: siteUrl(req.nextUrl.origin),
  });
  return NextResponse.json({ ok: true, ...ticket });
}
