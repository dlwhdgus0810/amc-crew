import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getCategory } from '@/lib/categories';
import { addSignup, listSignups, notifySignupReached, removeSignup } from '@/lib/db/signups';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * 카테고리 참가신청 — 「사람이 먼저, 모임은 그다음」인 카테고리에서만 쓴다.
 *
 * 명단은 회원 누구나 본다. 누가 신청했는지 보여야 「나도 할까」가 되고,
 * 다 모인 뒤에 그 사람들끼리 이야기를 시작할 수 있다.
 */
function guardCategory(category: string) {
  const cat = getCategory(category);
  // 참가신청을 안 쓰는 카테고리에 명단을 만들지 않는다 — 그쪽은 모임을 바로 만드는 곳이다
  return cat?.signup ? null : errJson(E.badCategory, 400);
}

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? '';
  const bad = guardCategory(category);
  if (bad) return await bad;
  const user = await getSessionUser();
  if (!user) {
    // 비로그인에게는 인원수만 — 이름은 회원끼리 본다
    return NextResponse.json({ count: (await listSignups(category)).length, signups: [], mine: false });
  }
  const signups = await listSignups(category);
  return NextResponse.json({
    count: signups.length,
    signups,
    mine: signups.some((s) => s.userId === user.id),
  });
}

/** 신청하기 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;

  const body = await req.json().catch(() => null);
  const category = typeof body?.category === 'string' ? body.category : '';
  const bad = guardCategory(category);
  if (bad) return await bad;

  await ensureUser(user);
  const { count, reached } = await addSignup(category, user.id);
  /*
   * 목표 인원을 이 신청이 처음 채웠을 때만 알린다. 알림이 실패해도 신청은 성공이다 —
   * 명단에 든 것이 먼저고, 못 알린 것은 화면을 열면 어차피 보인다.
   */
  if (reached) {
    try {
      await notifySignupReached(category, siteUrl(req.nextUrl.origin));
    } catch (e) {
      console.error('[signups] notify failed:', e);
    }
  }
  return NextResponse.json({ ok: true, count, reached });
}

/** 신청 취소 */
export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;

  const category = req.nextUrl.searchParams.get('category') ?? '';
  const bad = guardCategory(category);
  if (bad) return await bad;

  const count = await removeSignup(category, user.id);
  return NextResponse.json({ ok: true, count });
}
