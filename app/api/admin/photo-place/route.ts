import { NextResponse } from 'next/server';
import { and, asc, eq, inArray, isNull, isNotNull, or } from 'drizzle-orm';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db/index';
import { postPhotos, posts } from '@/lib/db/schema';
import { CATEGORIES } from '@/lib/categories';
import { geocodeAddress, placeName, placePipeline } from '@/lib/geocode';
import { buildTimeline } from '@/lib/photo-timeline';

export const dynamic = 'force-dynamic';

/**
 * 여행 사진의 좌표에 이름을 붙인다 — **사진 낱장이 아니라 「자리」마다 한 번씩.**
 *
 * 이게 이 라우트의 전부다. 같은 자리 사진들은 300m 안에 있어서 이름이 같으므로,
 * 텍사스 사진 열한 장은 일곱 번만 물으면 된다. 낱개로 물으면 열한 번이고, 초당 한 번
 * 제한이 있어서 그 차이가 그대로 기다리는 시간이 된다.
 *
 * 자리를 나누는 것은 화면과 **같은 함수**(lib/photo-timeline.ts)로 한다. 여기서 따로
 * 나누면 화면이 묶어 놓은 자리와 이름이 어긋난다 — 한 줄에 두 이름이 섞인다.
 *
 * 숙소도 여기서 한 번 좌표로 바꿔 둔다 (posts.lodging_lat). 그 근처 자리에는 이름 대신
 * 「숙소」가 붙는데, 그게 「Fairfield Inn The Colony」보다 읽기 좋다.
 *
 * **구글 키가 생기면 이미 붙은 OSM 이름을 다시 묻는다.** OSM만으로는 대개 도시 이름까지고
 * (「Carrollton, TX」가 세 번 반복됐다) 구글은 가게 이름을 준다. 사람이 손으로 고친 것은
 * 안 건드린다 — 갔던 사람이 적은 이름이 어느 API보다 낫다.
 *
 * 좌표와 숙소 주소가 바깥(OSM)으로 나가는 자리다. 그래서 여행 카테고리에서만, 관리자가
 * 눌렀을 때만 돈다. EXIF 백필(../photo-exif)과 나눠 둔 것도 그래서다 — 저쪽은 우리
 * 저장소 안에서 끝나는 일이라 성격이 다르다.
 */

/** 한 번에 물어볼 횟수. 초당 한 번이라 이만큼이 20초쯤이다 — 더 남으면 화면이 다시 부른다 */
const ASK_LIMIT = 15;

/**
 * 더 물어볼 것이 없는 상태들. 나머지(빈 값과 'osm')는 구글에 다시 묻는다.
 * 빈 값이 여기 없는 것이 핵심이다 — place_source 칸이 생기기 전에 붙은 이름이 그 모양이다.
 */
const ASKED_GOOGLE = new Set(['google', 'manual']);

export async function POST() {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);

  const slugs = CATEGORIES.filter((c) => c.timeline).map((c) => c.slug);
  if (slugs.length === 0) return NextResponse.json({ asked: 0, named: 0, left: 0 });

  const db = await getDb();

  /*
   * 이름이 빠진 사진이 하나라도 있는 모임만 본다. 자리를 나누려면 그 모임 사진을
   * **전부** 읽어야 한다 — 이름 없는 것만 읽으면 자리가 다르게 갈린다.
   */
  const targets = await db
    .select({ id: posts.id, lodging: posts.lodging, lodgingLat: posts.lodgingLat })
    .from(posts)
    .where(and(inArray(posts.category, slugs), isNull(posts.deletedAt)))
    .orderBy(asc(posts.date));

  const pipeline = placePipeline();
  let asked = 0;
  let named = 0;

  for (const post of targets) {
    if (asked >= ASK_LIMIT) break;

    const rows = await db
      .select({
        id: postPhotos.id,
        takenAt: postPhotos.takenAt,
        takenOffset: postPhotos.takenOffset,
        lat: postPhotos.lat,
        lon: postPhotos.lon,
        place: postPhotos.place,
        placeSource: postPhotos.placeSource,
      })
      .from(postPhotos)
      .where(
        and(
          eq(postPhotos.postId, post.id),
          isNotNull(postPhotos.lat),
          isNull(postPhotos.deletedAt)
        )
      );
    if (rows.length === 0) continue;

    /*
     * 숙소 주소를 좌표로 — 모임당 한 번. 이미 해 뒀으면 건너뛴다.
     * 못 찾는 주소면 계속 null이라 다음에 돌려도 또 물어보는데, 여행 하나에 한 번이라
     * 그 값이 크지 않다. 여기서 「못 찾았다」를 따로 적어 두면 주소를 고쳤을 때
     * 다시 안 물어보게 된다.
     */
    if (post.lodging && post.lodgingLat == null && asked < ASK_LIMIT) {
      asked++;
      const at = await geocodeAddress(post.lodging);
      if (at) {
        await db
          .update(posts)
          .set({ lodgingLat: at.lat, lodgingLon: at.lon })
          .where(eq(posts.id, post.id));
      }
    }

    // 화면과 같은 함수로 자리를 나눈다 — 여기서 따로 나누면 이름이 어긋난다
    const { days } = buildTimeline(
      rows.map((r) => ({ ...r, takenAt: r.takenAt?.toISOString() ?? null }))
    );
    const stops = days.flatMap((d) => d.stops);

    for (const stop of stops) {
      if (asked >= ASK_LIMIT) break;
      if (stop.lat == null || stop.lon == null) continue;
      /*
       * 물어볼 자리인가. 두 가지다:
       *  - 아직 이름이 없는 사진이 있다
       *  - 지금 길이 구글인데 이 자리는 아직 구글에 안 물어봤다 (더 좋은 답이 있을 자리)
       *
       * **place_source가 비어 있으면 「구글 이전」이다.** 그 칸이 생기기 전에 붙은 이름들이
       * 그렇다 — 값이 없다고 건너뛰면 정작 올려야 할 이름들이 영영 안 올라간다.
       * 손으로 고친 것('manual')은 어느 쪽에도 안 걸린다.
       */
      const needs = stop.photos.some(
        (p) => !p.place || (pipeline === 'google' && !ASKED_GOOGLE.has(p.placeSource ?? ''))
      );
      if (!needs) continue;

      asked++;
      const { name, source } = await placeName(stop.lat, stop.lon);
      /*
       * 못 찾아도 다 물어본 자리라는 표시는 남긴다. 안 그러면 이름이 안 나오는 자리를
       * 붙들고 영영 다시 묻는다 (화면 쪽 되풀이가 남은 수로 멈추긴 하지만, 매번 거기부터
       * 다시 물어 다음 자리로 못 넘어간다).
       */
      const ids = stop.photos.filter((p) => p.placeSource !== 'manual').map((p) => p.id);
      if (ids.length === 0) continue;
      await db
        .update(postPhotos)
        .set({ ...(name ? { place: name } : {}), placeSource: source })
        .where(inArray(postPhotos.id, ids));
      if (name) named += ids.length;
    }
  }

  /*
   * 남은 수는 **사진 수가 아니라 아직 못 물어본 자리 수**로 세야 맞지만, 그러려면
   * 위를 통째로 한 번 더 돌아야 한다. 이름 없는 사진 수로 대신 센다 — 화면은 이 값이
   * 0이 되는지, 아니면 안 줄어드는지(= 이름을 못 찾는 자리들)만 보면 된다.
   */
  const left = await db
    .select({ id: postPhotos.id })
    .from(postPhotos)
    .innerJoin(posts, eq(posts.id, postPhotos.postId))
    .where(
      and(
        inArray(posts.category, slugs),
        isNotNull(postPhotos.lat),
        isNull(postPhotos.deletedAt),
        isNull(posts.deletedAt),
        // 아직 이름이 없거나, 구글이 붙었는데 아직 구글에 안 물어본 것 (빈 값 = 구글 이전)
        pipeline === 'google'
          ? or(
              isNull(postPhotos.place),
              isNull(postPhotos.placeSource),
              eq(postPhotos.placeSource, 'osm')
            )
          : isNull(postPhotos.place)
      )
    );

  return NextResponse.json({ asked, named, left: left.length, pipeline });
}
