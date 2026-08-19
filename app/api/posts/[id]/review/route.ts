import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { getPostView } from '@/lib/db/posts';
import { deleteReview, saveReview } from '@/lib/db/reviews';
import { REVIEW_MAX, REVIEW_MIN } from '@/lib/reviews';

export const dynamic = 'force-dynamic';

/**
 * 모임 한줄 후기 — 남기기·고치기·지우기.
 *
 * 조회는 없다. 모임 상세가 서버에서 그려지면서 이미 들고 내려간다 (평점과 같다).
 *
 * 평점과 다른 점은 **어느 모임에나 쓸 수 있다**는 것뿐이다. 평점은 무비나잇 전용이라
 * ratable()로 카테고리를 보지만, 후기는 다녀온 모임이면 어디든 남길 수 있다.
 */
async function guard(id: string) {
  const user = await getSessionUser();
  if (!user) return { err: await errJson(E.loginRequired, 401) };

  const banned = await banGuard(user);
  if (banned) return { err: banned };

  const post = await getPostView(id, user.id);
  if (!post) return { err: await errJson(E.postNotFound, 404) };

  // 「끝났는지」는 서버가 판정한다 — 브라우저 시계를 돌려 미리 쓰는 일이 없도록
  if (!post.isPast) return { err: await errJson(E.reviewClosed, 403) };
  /*
   * 익명 모임에서도 이 검사가 맞다 — 명단은 남의 번호만 가리고(anon:N)
   * 보고 있는 본인 번호는 그대로 남기기 때문이다 (lib/db/posts.ts).
   */
  if (!post.participants.some((p) => p.id === user.id)) {
    return { err: await errJson(E.reviewParticipantOnly, 403) };
  }
  return { user, post };
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (g.err) return g.err;

  const body = await req.json().catch(() => null);
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  // 길이는 서버가 판정한다 — 화면의 버튼만 막아 두면 그대로 요청을 보내는 길이 남는다
  if (text.length < REVIEW_MIN || text.length > REVIEW_MAX) return await errJson(E.reviewBody, 400);

  await saveReview(id, g.user.id, text);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(id);
  if (g.err) return g.err;

  await deleteReview(id, g.user.id);
  return NextResponse.json({ ok: true });
}
