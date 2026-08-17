import { NextResponse } from 'next/server';
import { and, asc, eq, inArray, isNull, isNotNull } from 'drizzle-orm';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db/index';
import { postPhotos, posts } from '@/lib/db/schema';
import { signedUrls } from '@/lib/blob';
import { CATEGORIES } from '@/lib/categories';
import { EXIF_HEAD_BYTES, hasAnyExif, readExif } from '@/lib/exif';

export const dynamic = 'force-dynamic';

/**
 * 이미 올라간 사진에서 찍은 시각·자리를 읽어 채운다 (여행 타임라인).
 *
 * 썸네일 백필(app/api/admin/thumb-backfill)과 달리 **여기는 전부 서버가 한다.** 저쪽은
 * 사진을 줄여야 해서 브라우저의 캔버스가 필요했지만, EXIF는 바이트를 읽는 일이라 서버가
 * 그냥 한다. 원본의 **앞 256KB만** 받는다 — EXIF는 파일 머리에 있고, 한 장을 통째로
 * 받아 올 이유가 없다 (lib/exif.ts).
 *
 * 채워지는 것은 타임라인을 쓰는 카테고리뿐이다. 좌표를 남길 자리를 카테고리 하나로
 * 묶어 두는 것이 이 기능의 전제라, 백필도 같은 선을 넘지 않는다.
 *
 * 원본이 없는 사진은 건너뛴다 — 화면용·썸네일은 캔버스로 구운 것이라 EXIF가 없다.
 * 그래서 original_pathname 칸이 생기기 전에 올라간 사진은 영영 못 채운다.
 *
 * 한 번 돌리고 나면 쓸 일이 없다. 그래도 남겨 둔다: 여행 카테고리가 하나 더 생기거나
 * 올릴 때 EXIF만 못 읽고 지나간 사진이 있으면 다시 돌리면 된다.
 */

/** 한 번에 볼 장수. 장당 256KB를 받으므로 이만큼이 25MB 남짓이다 */
const BATCH = 40;

export async function POST() {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);

  const slugs = CATEGORIES.filter((c) => c.timeline).map((c) => c.slug);
  if (slugs.length === 0) return NextResponse.json({ scanned: 0, filled: 0, left: 0 });

  const db = await getDb();
  const pending = () =>
    db
      .select({ id: postPhotos.id, original: postPhotos.originalPathname })
      .from(postPhotos)
      .innerJoin(posts, eq(posts.id, postPhotos.postId))
      .where(
        and(
          inArray(posts.category, slugs),
          isNotNull(postPhotos.originalPathname),
          // 이미 채운 것은 다시 안 본다 — 다시 돌려도 값이 안 든다
          isNull(postPhotos.takenAt),
          isNull(postPhotos.deletedAt),
          isNull(posts.deletedAt)
        )
      )
      .orderBy(asc(postPhotos.createdAt));

  const rows = (await pending()).slice(0, BATCH);
  const signed = await signedUrls(rows.map((r) => r.original!));

  let filled = 0;
  for (const row of rows) {
    const url = signed.get(row.original!);
    if (!url) continue;
    try {
      const res = await fetch(url, { headers: { Range: `bytes=0-${EXIF_HEAD_BYTES - 1}` } });
      if (!res.ok) continue;
      const exif = readExif(new Uint8Array(await res.arrayBuffer()));
      if (!hasAnyExif(exif)) continue;
      await db
        .update(postPhotos)
        .set({ takenAt: exif.takenAt, takenOffset: exif.takenOffset, lat: exif.lat, lon: exif.lon })
        .where(eq(postPhotos.id, row.id));
      filled++;
    } catch {
      /*
       * 한 장이 막혔다고 나머지를 버리지 않는다. 다시 돌리면 이 장만 남아 있고,
       * 그때도 안 되면 그 사진에는 읽을 것이 없는 것이다.
       */
    }
  }

  /*
   * 남은 수는 다시 세어서 준다. **읽을 것이 없던 사진도 남은 것으로 잡힌다** —
   * takenAt이 여전히 비어 있어서다. 스크린샷처럼 아예 EXIF가 없는 사진이 그렇고,
   * 그래서 두 번째로 돌리면 「0장 채웠어요」가 나오면서 그 수가 그대로 남는다.
   */
  return NextResponse.json({ scanned: rows.length, filled, left: (await pending()).length });
}
