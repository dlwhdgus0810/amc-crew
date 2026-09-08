import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getProfiles, localName } from '@/lib/store';
import { createTicket, listTickets, TICKET_KINDS, TicketKind } from '@/lib/db/tickets';
import { walletOf } from '@/lib/db/shop';
import { CARD_THEMES, toCardTheme } from '@/lib/card-theme';
import { priceOf } from '@/lib/shop';
import { siteUrl } from '@/lib/site';
import { regionOfRequest } from '@/lib/region-server';

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

  /*
   * 테마 디자인 건의는 **그 테마를 산 사람만** 넣는다.
   *
   * 상점 화면이 이미 가진 테마에만 칸을 보여 주지만, 그건 화면일 뿐이라 여기서 다시 본다 —
   * 화면을 안 거치고 부를 수 있다.
   *
   * themeAllowed가 아니라 walletOf로 「샀는지」만 본다. themeAllowed는 사진을 내려
   * 잔액이 마이너스면 false가 되는데, 그건 **쓰는 것**을 잠그는 규칙이다. 산 테마에
   * 대해 할 말이 있는 것과 지금 그걸 걸고 있는지는 별개다.
   *
   * 어느 테마인지는 제목 앞에 붙여 둔다. 열이 따로 없어서인데, 관리자가 목록에서 바로
   * 읽는 것이 목적이라 이 정도로 충분하다. 테마별로 세거나 걸러야 할 만큼 쌓이면
   * tickets에 theme 열을 두는 편이 낫다.
   */
  let finalTitle = title;
  if (kind === 'theme') {
    const theme = typeof body?.theme === 'string' ? toCardTheme(body.theme) : 'default';
    if (priceOf(theme) == null) {
      return await errJson(E.badRequest, 400);
    }
    const wallet = await walletOf(user.id);
    if (!wallet.owned.includes(theme) && !isAdmin(user)) {
      return await errJson(E.themeNotOwned, 403);
    }
    finalTitle = `「${CARD_THEMES[theme].label.ko}」 ${title}`;
  }

  await ensureUser(user);
  const profile = (await getProfiles())[user.id];
  // 관리자 알림 문구에 실릴 이름 — 받는 관리자의 언어로 정해진다
  const name = localName(profile, user.name);
  const ticket = await createTicket({
    userId: user.id,
    userName: name,
    kind: kind as TicketKind,
    title: finalTitle,
    ...(detail ? { body: detail } : {}),
    origin: siteUrl(regionOfRequest(req), req.nextUrl.origin),
    region: regionOfRequest(req),
  });
  return NextResponse.json({ ok: true, ...ticket });
}
