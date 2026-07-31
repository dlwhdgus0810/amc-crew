import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/index';
import { posts, settlements, users } from '@/lib/db/schema';
import { getSettlement } from '@/lib/db/settlements';
import { venmoLink } from '@/lib/money';
import { catName } from '@/lib/categories';
import { dateLabelShort } from '@/lib/datefmt';
import { DEFAULT_LOCALE } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * 짧은 결제 링크 — 앱 밖의 사람에게 전달하는 주소다.
 *
 * 금액이 박힌 venmo.com 주소는 100자 가까이 되어 알림 본문에서 읽기 어렵다.
 * 여기서 지금 금액을 계산해 넘겨주므로, 정산을 고치면 이미 보낸 링크도 새 금액을 가리킨다.
 *
 * 로그인을 요구하지 않는다 — 받을 사람이 앱에 없는 사람에게 건네라고 만든 주소다.
 * 대신 알려주는 것은 "누구에게 얼마" 뿐이고, 참가자 명단이나 항목은 나가지 않는다.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const db = await getDb();
  const [row] = await db.select().from(settlements).where(eq(settlements.shortCode, code));
  // 지워졌거나 없는 코드 — 홈으로 보낸다 (없는 페이지를 보여줄 이유가 없다)
  if (!row) return NextResponse.redirect(new URL('/', req.nextUrl.origin));

  const view = await getSettlement(row.postId);
  const [payee] = await db.select({ venmo: users.venmo }).from(users).where(eq(users.id, row.payeeId));
  if (!view || !payee?.venmo) {
    return NextResponse.redirect(new URL(`/p/${row.postId}`, req.nextUrl.origin));
  }

  // 앱 밖 인원 한 명이 낼 금액 — 외부 인원이 걸린 항목만 더한다
  const cents = view.items.reduce(
    (sum, i) => (i.extraPeople > 0 && i.heads > 0 ? sum + Math.floor(i.amountCents / i.heads) : sum),
    0
  );
  if (cents <= 0) return NextResponse.redirect(new URL(`/p/${row.postId}`, req.nextUrl.origin));

  const [post] = await db.select().from(posts).where(eq(posts.id, row.postId));
  const note = post
    ? `${catName(post.category, DEFAULT_LOCALE)} ${dateLabelShort(post.date, DEFAULT_LOCALE)}`
    : 'Kansas Korean';

  return NextResponse.redirect(venmoLink(payee.venmo, cents, note));
}
