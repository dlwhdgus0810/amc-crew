import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { adminIds, getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db/index';
import { posts } from '@/lib/db/schema';
import { getPostView } from '@/lib/db/posts';
import { isAnonymous } from '@/lib/categories';

export const dynamic = 'force-dynamic';

/**
 * 이 모임 사진을 회원 누구나 볼지 — 켜고 끄기.
 *
 * 참가자에게만 보이던 것을 밖으로 여는 스위치라, **여는 사람을 좁게 잡는다**:
 * 이 모임을 연 사람, 같이 연 사람, 관리자. 참가자 아무나 켤 수 있으면 「내가 찍힌
 * 사진」을 남이 공개하는 일이 된다 (사진을 지우는 권한과 같은 줄이다).
 *
 * 화면에서도 이 세 사람에게만 스위치를 그리지만, 판정은 여기서 다시 한다.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const banned = await banGuard(user);
  if (banned) return banned;

  const post = await getPostView(id, user.id);
  if (!post) return await errJson(E.postNotFound, 404);

  const isHost = post.authorId === user.id || post.coHost?.id === user.id;
  if (!isHost && !adminIds().includes(user.id)) return await errJson(E.photosPublicHostOnly, 403);

  /*
   * 익명 카테고리는 켤 수 없다. 이름을 가려 둔 자리인데 사진에는 얼굴이 그대로 찍히므로,
   * 사진만 열면 가린 의미가 없다 — 정산·친구 추가를 막아 둔 것과 같은 이유다.
   */
  if (isAnonymous(post.category)) return await errJson(E.photosPublicAnon, 403);

  const body = await req.json().catch(() => null);
  const open = body?.public === true;

  const db = await getDb();
  await db.update(posts).set({ photosPublic: open }).where(eq(posts.id, id));

  return NextResponse.json({ ok: true, photosPublic: open });
}
