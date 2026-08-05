import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { getPostView } from '@/lib/db/posts';
import { deleteRating, saveRating } from '@/lib/db/ratings';
import { ratable, toStored } from '@/lib/ratings';

export const dynamic = 'force-dynamic';

/**
 * 무비나잇 평점 — 매기기·고쳐 매기기·무르기.
 *
 * 조회는 없다. 모임 상세가 서버에서 그려지면서 이미 들고 내려간다.
 *
 * 관리자도 예외를 두지 않았다. 정산은 남의 잘못 적은 금액을 고쳐 줄 일이 있지만,
 * 평점은 각자의 감상이라 대신 매겨 줄 만한 것이 아니다.
 */
async function guard(id: string) {
  const user = await getSessionUser();
  if (!user) return { err: await errJson(E.loginRequired, 401) };

  const banned = await banGuard(user);
  if (banned) return { err: banned };

  const post = await getPostView(id, user.id);
  if (!post) return { err: await errJson(E.postNotFound, 404) };

  // 「끝났는지」는 서버가 판정한다 — 브라우저 시계를 돌려 미리 매기는 일이 없도록
  if (!ratable(post)) return { err: await errJson(E.ratingClosed, 403) };
  if (!post.participants.some((p) => p.id === user.id)) {
    return { err: await errJson(E.ratingParticipantOnly, 403) };
  }
  return { user, post };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (g.err) return g.err;

  const body = await req.json().catch(() => null);
  const stored = toStored(body?.score);
  if (stored == null) return await errJson(E.ratingScore, 400);

  await saveRating(id, g.user.id, stored);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (g.err) return g.err;

  await deleteRating(id, g.user.id);
  return NextResponse.json({ ok: true });
}
