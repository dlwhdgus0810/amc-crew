import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getPostView, isParticipant } from '@/lib/db/posts';
import { getCategory } from '@/lib/categories';
import { getDb } from '@/lib/db/index';
import { postPhotos } from '@/lib/db/schema';

export const dynamic = 'force-dynamic';

/**
 * 타임라인의 한 자리에 이름을 손으로 붙인다.
 *
 * **API가 못 맞히는 자리가 있어서 있는 길이다.** 실제로 밤 8시 반에 나무 아래서 찍은
 * 단체사진에 「Swiss Eye Care」가 붙었다 — 같은 상가에서 그 점에 제일 가까운 등록 업소가
 * 안과였다. 좌표를 아무리 잘 물어도 거기 있던 사람만 아는 것이 있다.
 *
 * 고치는 단위는 **사진이 아니라 자리**다. 한 자리 사진들은 300m 안에 있어서 이름이
 * 하나여야 하고, 화면도 자리마다 한 줄로 보여준다 (lib/photo-timeline.ts).
 * 그래서 브라우저가 그 자리의 사진 id를 통째로 보낸다 — 자리에는 따로 이름표가 없다.
 *
 * 적어 두면 place_source가 'manual'이 되고, 그때부터 백필이 그 자리를 안 건드린다
 * (app/api/admin/photo-place). 비우면 표시까지 지워서 다시 자동으로 붙게 둔다.
 */

/** 한 줄에 들어가야 쓸모가 있다. 시각 옆에 붙는 자리라 길면 지도 링크를 밀어낸다 */
const MAX_LEN = 60;
/** 한 자리에 이만큼 넘게 담길 일이 없다 — 넘어오면 자리 단위로 부르는 게 아니다 */
const MAX_PHOTOS = 60;

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const banned = await banGuard(user);
  if (banned) return banned;

  const post = await getPostView(id, user.id);
  if (!post) return await errJson(E.postNotFound, 404);
  // 타임라인을 안 쓰는 카테고리에는 이름 붙일 자리 자체가 없다
  if (!getCategory(post.category)?.timeline) return await errJson(E.badRequest, 400);
  /*
   * 갔던 사람과 관리자만. 사진을 올릴 수 있는 자격과 같게 둔다 — 이름을 적는 것은
   * 사진을 올리는 것과 같은 종류의 일이고, 자격이 둘로 갈리면 언젠가 어긋난다.
   */
  if (!(await isParticipant(id, user.id)) && !isAdmin(user)) {
    return await errJson(E.photoParticipantOnly, 403);
  }

  const body = await req.json().catch(() => null);
  const ids = Array.isArray(body?.photoIds)
    ? body.photoIds.filter((v: unknown) => typeof v === 'string').slice(0, MAX_PHOTOS)
    : [];
  if (ids.length === 0) return await errJson(E.badRequest, 400);

  const raw = typeof body?.place === 'string' ? body.place.trim().slice(0, MAX_LEN) : '';
  const place = raw || null;

  const db = await getDb();
  /*
   * 이 모임의 사진이 맞는지 다시 본다. 브라우저가 보내는 id라, 그냥 믿으면 남의 모임
   * 사진에 이름을 적을 수 있다 — 그 모임에 못 들어가는 사람이 그 안의 값을 바꾸는 셈이다.
   */
  const own = await db
    .select({ id: postPhotos.id })
    .from(postPhotos)
    .where(and(eq(postPhotos.postId, id), inArray(postPhotos.id, ids), isNull(postPhotos.deletedAt)));
  if (own.length === 0) return await errJson(E.photoNotFound, 404);

  await db
    .update(postPhotos)
    .set({
      place,
      // 비우면 표시까지 지운다 — 손으로 지운 자리는 다음 백필이 다시 자동으로 붙여 준다
      placeSource: place ? 'manual' : null,
    })
    .where(inArray(postPhotos.id, own.map((r) => r.id)));

  return NextResponse.json({ ok: true, place, n: own.length });
}
