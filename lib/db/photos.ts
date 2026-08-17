import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { getDb } from './index';
import { postParticipants, postPhotos, posts } from './schema';
import { signedUrls } from '../blob';
import { NO_EXIF, type PhotoExifInput } from '../photos';
import { getCategory } from '../categories';

/**
 * 모임 사진 — DB 쪽.
 *
 * 사진 자체는 Vercel Blob에 있고 여기에는 경로만 있다. 스토어가 비공개라 주소는 서명해야
 * 열리고 유효기간이 있어서, 밖으로 내보낼 때 그때그때 서명해 준다.
 *
 * 지우는 것은 두 곳(행과 파일)이라 부르는 쪽이 순서를 지켜야 한다 — 행 먼저, 파일 나중.
 */

/**
 * 받기 주소 — 저장소가 아니라 **우리 주소**다.
 *
 * 저장소의 서명 주소를 그대로 주면 폰에서 멈춘다: 홈 화면에 추가한 앱은 새 창을 여는데,
 * 그 창이 받은 것은 그릴 게 없는 첨부파일이라 흰 화면인 채로 남는다. 같은 주소로
 * 내려보내면 <a download>가 먹어서 창을 아예 안 연다
 * (app/api/posts/[id]/photos/[photoId]/download).
 *
 * 서명하지 않아도 되는 것이 덤이다 — 눌러야 쓰이는 주소라 대부분 그냥 버려졌다.
 *
 * **모임 id는 안 넣는다.** 넣었더니 모아보기 응답에 그 값이 그대로 실렸고, 비공개
 * 모임은 /p/{id}가 곧 초대장이라 사진만 열어 둔 모임의 id가 회원 전체에게 나갔다.
 * 어느 모임인지는 사진 id로 서버가 찾는다.
 */
function downloadPath(photoId: string): string {
  return `/api/photos/${photoId}/download`;
}

export interface PhotoView {
  id: string;
  userId: string;
  /** 크게 볼 때 쓰는 1600px */
  url: string;
  /** 격자에 그릴 400px — 없는 옛 사진은 url과 같다 (느릴 뿐 안 깨진다) */
  thumbUrl: string;
  /**
   * 받기 주소 — **언제나 있다.**
   *
   * 원본이 저장돼 있으면 그 파일, 없으면 화면에 보이는 줄인 사진을 준다.
   * 예전에는 원본이 없으면 받기 줄 자체를 안 그렸는데, 그러면 「왜 이 사진만 받기가
   * 없지」가 되고 고장인지 원래 그런 건지 구분이 안 된다. 받을 것은 언제나 있으므로
   * 버튼도 언제나 둔다 — 무엇을 받는지는 아래 값으로 갈라 말해 준다.
   */
  downloadUrl: string;
  /** 위 주소가 올린 파일 그대로인지 (false면 줄인 사진이다) */
  downloadIsOriginal: boolean;
  width: number | null;
  height: number | null;
  createdAt: string;
  /**
   * 찍은 시각 (ISO) — 여행 타임라인이 쓴다. 올린 시각(createdAt)과 다르다:
   * 여행 마지막 날 찍은 사진을 돌아온 다음 주에 올릴 수 있다.
   *
   * 여행이 아닌 카테고리에서는 언제나 null이다 — 애초에 안 담는다 (lib/photos.ts).
   */
  takenAt: string | null;
  /** 찍은 자리의 UTC 오프셋(분). 그때 거기서의 벽시계 시각을 되살릴 때 쓴다 */
  takenOffset: number | null;
  lat: number | null;
  lon: number | null;
  /** 그 자리의 이름 — 「SomiSomi」나 「The Colony, TX」. 아직 안 물어봤으면 null */
  place: string | null;
}

/**
 * 카드가 쓰는 사진 묶음 — 첫 장(카드에 실리는 것)과 넘겨 볼 나머지.
 *
 * 카드에는 한 장만 보이지만 누르면 넘겨 봐야 하므로 주소를 여러 개 들고 간다.
 * 다만 무한정은 아니다: 서명 주소 한 줄이 500자 남짓이라, 지난 모임 30개에 60장씩이면
 * 목록 응답이 통째로 무거워진다. 그래서 앞의 몇 장만 싣고 나머지는 상세에서 본다.
 * count는 자른 수가 아니라 **실제 전체 장수**다 — 카드 배지가 그걸 보여줘야 한다.
 */
const STRIP_LIMIT = 10;

/** 격자와 확대가 함께 필요한 만큼만 읽어 온 한 줄 */
interface PhotoRow {
  id: string;
  pathname: string;
  thumbPathname: string | null;
  originalPathname: string | null;
}

/**
 * 한 장에 서명해야 할 경로들 — 화면용과 (있으면) 썸네일.
 *
 * 둘 다 서명하는 이유: 격자는 썸네일을 그리지만, 그 자리를 눌러 크게 보면 곧바로
 * 화면용이 필요하다. 그때 가서 서명하러 다녀오면 확대 창이 잠깐 비어 있게 된다.
 */
function displayAndThumb(p: PhotoRow): string[] {
  return p.thumbPathname ? [p.pathname, p.thumbPathname] : [p.pathname];
}

/**
 * 격자에 그릴 주소. 썸네일이 없거나 서명을 못 만들었으면 화면용으로 떨어진다 —
 * 이 칸이 생기기 전에 올라간 사진들이 여기로 온다 (느릴 뿐 안 깨진다).
 */
function thumbOr(signed: Map<string, string>, p: PhotoRow, fallback: string): string {
  return (p.thumbPathname && signed.get(p.thumbPathname)) || fallback;
}

export interface PhotoStrip {
  /**
   * 카드에 실리는 그림들 (앞의 몇 장) — **크게 볼 때 쓰는 1600px 쪽**이다.
   * 카드에 그릴 작은 그림은 아래 thumbs를 쓴다.
   */
  urls: string[];
  /**
   * urls와 같은 순서의 **격자용 400px.** 썸네일이 없는 옛 사진은 그 자리에 urls의 것이
   * 그대로 들어간다 — 느릴 뿐 깨지지 않는다.
   */
  thumbs: string[];
  /**
   * 위 urls와 **같은 순서**의 받기 주소. 카드에서 사진을 눌러 크게 봤을 때 쓴다.
   *
   * 처음에는 안 실었는데, 그래서 카드에서 연 확대 창에만 받기 버튼이 없었다 —
   * 모임에 들어가서 열면 있고 목록에서 열면 없으니, 쓰는 사람에게는 고장으로 보인다.
   *
   * **갔던 모임에만 채운다** (아래 downloadableIds). 호스트가 사진을 열어 둔 모임은
   * 보이기는 해도 받기는 안 된다 — 연 것은 보여 주기까지다.
   */
  downloads: { url: string; isOriginal: boolean }[];
  /** 자른 수가 아니라 실제 전체 장수 */
  count: number;
}

export async function photoStrips(
  postIds: string[],
  /**
   * 이 중 **받기까지 되는** 모임. 안 주면 전부 된다 (부르는 쪽이 이미 좁혀 놓은 경우).
   * 사진이 보이는 범위보다 좁다 — photosPublic으로 열린 모임은 여기 안 들어간다.
   */
  downloadableIds?: string[]
): Promise<Map<string, PhotoStrip>> {
  const out = new Map<string, PhotoStrip>();
  if (postIds.length === 0) return out;

  const db = await getDb();
  const rows = await db
    .select({
      id: postPhotos.id,
      postId: postPhotos.postId,
      pathname: postPhotos.pathname,
      thumbPathname: postPhotos.thumbPathname,
      originalPathname: postPhotos.originalPathname,
    })
    .from(postPhotos)
    .where(and(inArray(postPhotos.postId, postIds), isNull(postPhotos.deletedAt)))
    .orderBy(asc(postPhotos.createdAt));

  const byPost = new Map<string, (typeof rows)[number][]>();
  for (const r of rows) {
    const list = byPost.get(r.postId) ?? [];
    list.push(r);
    byPost.set(r.postId, list);
  }

  /*
   * 서명은 **화면에 그릴 것만.** 받기 주소는 우리 라우트라 서명이 필요 없다 —
   * 예전에는 원본까지 같이 서명했는데, 그건 눌러야 쓰이는 주소라 대부분 그냥 버려졌다.
   */
  const shown = [...byPost.values()].flatMap((list) => list.slice(0, STRIP_LIMIT));
  const signed = await signedUrls(shown.flatMap(displayAndThumb));

  const canGet = downloadableIds ? new Set(downloadableIds) : null;
  for (const [postId, list] of byPost) {
    const urls: string[] = [];
    const thumbs: string[] = [];
    const downloads: PhotoStrip['downloads'] = [];
    for (const p of list.slice(0, STRIP_LIMIT)) {
      const url = signed.get(p.pathname);
      if (!url) continue; // 서명을 못 만든 장은 통째로 뺀다 (깨진 그림보다 낫다)
      urls.push(url);
      thumbs.push(thumbOr(signed, p, url));
      if (!canGet || canGet.has(postId)) {
        downloads.push({ url: downloadPath(p.id), isOriginal: Boolean(p.originalPathname) });
      }
    }
    // 한 장도 서명을 못 만들었으면 아예 안 내보낸다
    if (urls.length) out.set(postId, { urls, thumbs, downloads, count: list.length });
  }
  return out;
}

/** 사진 모아보기(/photos) — 모임 하나가 한 묶음 */
export interface PhotoWallGroup {
  /**
   * 그 모임으로 가는 길. **안 갔던 모임이면 null이다.**
   *
   * 여기 실렸는데 안 갔다는 것은 호스트가 사진을 열어 뒀다는 뜻인데(photosPublic),
   * 그 사람이 연 것은 사진이지 모임이 아니다. 비공개 모임은 /p/{id}가 곧 초대장이라
   * id를 실어 보내는 것만으로 초대가 나간다 — 화면에서 링크를 안 그려도 개발자 도구에
   * 남으므로, 값 자체를 안 준다.
   *
   * 묶음을 가리키는 열쇠로도 쓸 수 없게 되어서, 화면은 첫 사진 주소로 key를 만든다.
   */
  postId: string | null;
  category: string;
  title: string | null;
  date: string | null;
  startTime: string | null;
  /** 마지막 날 — 여행처럼 며칠짜리 모임에서만. 머리줄이 「8/14(금) ~ 8/16(일)」이 된다 */
  endDate: string | null;
  /** 실린 사진 (앞의 몇 장) — 크게 볼 때 쓰는 1600px 쪽 */
  urls: string[];
  /** urls와 같은 순서의 격자용 400px (없는 옛 사진은 urls의 것이 들어간다) */
  thumbs: string[];
  /**
   * urls와 같은 순서의 받기 주소. **안 갔던 모임이면 빈 배열이다.**
   *
   * 호스트가 연 것은 「보여 주기」다. 안 갔던 사람이 사진을 가져가는 것까지 연 것은
   * 아니라서, 그 묶음에는 받기 주소를 안 싣는다 — 라우트도 같은 기준으로 막는다
   * (app/api/photos/[photoId]/download).
   */
  downloads: { url: string; isOriginal: boolean }[];
  /**
   * urls와 **같은 순서**의 찍은 시각·자리. 타임라인을 쓰는 카테고리에서만 채워진다
   * (lib/categories.ts의 timeline). 그 밖에는 빈 배열이라 모아보기가 격자로 그린다.
   *
   * 나란한 배열을 하나 더 다는 것이 못생겼지만, 여기 urls·thumbs·downloads가 이미
   * 그 모양이라 혼자만 객체 배열로 가면 화면 쪽이 두 규칙을 알게 된다.
   */
  taken: {
    takenAt: string | null;
    takenOffset: number | null;
    lat: number | null;
    lon: number | null;
    place: string | null;
  }[];
  /** 숙소 좌표 — 있으면 그 근처 자리에 「숙소」가 붙는다 */
  lodgingAt: { lat: number; lon: number } | null;
  /** 자른 수가 아니라 그 모임의 실제 전체 장수 */
  count: number;
  /**
   * 호스트가 이 모임 사진을 회원 전체에게 열어 뒀는지.
   *
   * 안 갔던 사람에게는 「내가 왜 이걸 보고 있지」의 답이고, 갔던 사람에게는 「우리
   * 사진이 지금 열려 있다」는 알림이다. 그래서 양쪽 모두에게 붙인다.
   */
  photosPublic: boolean;
}

/**
 * 모아보기에 싣는 모임 수 · 모임당 장수 — 이 저장소에는 무한 스크롤이 없다 (전부 자른다).
 *
 * 한 모임에 6장만 싣고 나머지는 「+n장 더」로 상세에 미뤘었는데, 모아보기는 사진을
 * 보러 오는 화면이라 여섯 장에서 끊고 다른 화면으로 보내면 온 이유가 없어진다.
 * 한 모임에 올릴 수 있는 상한이 MAX_PHOTOS_PER_POST(60장)라 전부 싣지는 않고,
 * 스무 장까지 늘린다 — 그보다 많은 모임에서만 「+n장 더」가 남는다.
 */
const WALL_POSTS = 20;
const WALL_PER_POST = 20;

/**
 * 모아보기에 실리는 모임들의 사진 — 최근 모임부터.
 *
 * **기본은 내가 참가한 모임이다.** 사진은 같이 논 사람들 사이의 것이라, 모임 상세에서도
 * 참가자·관리자에게만 붙고 그 밖에는 사진이 있다는 사실조차 응답에 안 나간다
 * (lib/db/posts.ts의 photoPostIds). 모아보는 화면이라고 그 전제를 혼자 넓히지 않는다.
 *
 * 넓히는 길은 하나뿐이다 — 그 모임의 호스트나 관리자가 photosPublic을 켠 경우
 * (schema.ts의 주석). 그때는 안 갔던 사람도, 로그인만 했으면 그 모임 사진을 본다.
 * 비공개(link) 모임도 켤 수 있다: 켠 사람이 그걸 알고 켠다.
 *
 * 사진이 한 장도 없는 모임은 스무 개 자리를 차지하지 않는다. 예전에는 최근 스무 개를
 * 먼저 고르고 그중 사진 있는 것만 남겼는데, 요즘 모임에 사진이 없으면 더 옛날 모임에
 * 사진이 있어도 화면이 통째로 비었다.
 */
export async function myPhotoWall(viewerId: string): Promise<PhotoWallGroup[]> {
  const db = await getDb();
  /*
   * 실을 수 있는 모임을 최근 순으로 먼저 고른다. 사진부터 읽어 오면 못 보여줄 모임의
   * 사진까지 가져온 뒤에 버리는 셈이라, 「보여줘도 되는 것」을 먼저 좁히는 순서를 지킨다.
   */
  const [joined, withPhotos] = await Promise.all([
    db.select({ postId: postParticipants.postId }).from(postParticipants).where(eq(postParticipants.userId, viewerId)),
    db.selectDistinct({ postId: postPhotos.postId }).from(postPhotos).where(isNull(postPhotos.deletedAt)),
  ]);
  if (withPhotos.length === 0) return [];

  const joinedIds = new Set(joined.map((j) => j.postId));
  const mine = await db
    .select({
      id: posts.id,
      category: posts.category,
      title: posts.title,
      date: posts.date,
      startTime: posts.startTime,
      endDate: posts.endDate,
      lodgingLat: posts.lodgingLat,
      lodgingLon: posts.lodgingLon,
      photosPublic: posts.photosPublic,
    })
    .from(posts)
    .where(
      and(
        isNull(posts.deletedAt),
        inArray(posts.id, withPhotos.map((p) => p.postId)),
        // 내가 갔던 모임이거나, 호스트가 사진을 열어 둔 모임
        joinedIds.size ? or(inArray(posts.id, [...joinedIds]), eq(posts.photosPublic, true)) : eq(posts.photosPublic, true)
      )
    )
    .orderBy(desc(posts.date), desc(posts.startTime))
    .limit(WALL_POSTS);
  if (mine.length === 0) return [];

  const rows = await db
    .select({
      id: postPhotos.id,
      postId: postPhotos.postId,
      pathname: postPhotos.pathname,
      thumbPathname: postPhotos.thumbPathname,
      originalPathname: postPhotos.originalPathname,
      takenAt: postPhotos.takenAt,
      takenOffset: postPhotos.takenOffset,
      lat: postPhotos.lat,
      lon: postPhotos.lon,
      place: postPhotos.place,
    })
    .from(postPhotos)
    .where(and(inArray(postPhotos.postId, mine.map((m) => m.id)), isNull(postPhotos.deletedAt)))
    .orderBy(asc(postPhotos.createdAt));

  const byPost = new Map<string, (typeof rows)[number][]>();
  for (const r of rows) {
    const list = byPost.get(r.postId) ?? [];
    list.push(r);
    byPost.set(r.postId, list);
  }

  // 서명은 화면에 그릴 것만 (photoStrips와 같은 규칙 — 받기 주소는 우리 라우트다)
  const shown = [...byPost.values()].flatMap((list) => list.slice(0, WALL_PER_POST));
  const signed = await signedUrls(shown.flatMap(displayAndThumb));

  const out: PhotoWallGroup[] = [];
  for (const m of mine) {
    const list = byPost.get(m.id);
    if (!list) continue; // 사진이 없는 모임은 묶음을 만들지 않는다
    const joined = joinedIds.has(m.id);
    const urls: string[] = [];
    const thumbs: string[] = [];
    const downloads: PhotoWallGroup['downloads'] = [];
    const taken: PhotoWallGroup['taken'] = [];
    /*
     * 찍은 시각·자리는 타임라인을 쓰는 카테고리에서만 싣는다. 다른 카테고리는 애초에
     * 그 칸이 비어 있지만(lib/photos.ts의 exifFromBody), 내보내는 자리에서도 한 번 더 막는다.
     */
    const withTime = Boolean(getCategory(m.category)?.timeline);
    for (const p of list.slice(0, WALL_PER_POST)) {
      const url = signed.get(p.pathname);
      if (!url) continue;
      urls.push(url);
      thumbs.push(thumbOr(signed, p, url));
      // 갔던 모임에만 받기를 붙인다 (위 downloads 주석)
      if (joined) downloads.push({ url: downloadPath(p.id), isOriginal: Boolean(p.originalPathname) });
      if (withTime) {
        taken.push({
          takenAt: p.takenAt?.toISOString() ?? null,
          takenOffset: p.takenOffset,
          lat: p.lat,
          lon: p.lon,
          place: p.place,
        });
      }
    }
    if (urls.length) {
      out.push({
        // 안 갔던 모임이면 id를 안 내보낸다 (위 postId 주석)
        postId: joined ? m.id : null,
        category: m.category,
        title: m.title,
        date: m.date,
        startTime: m.startTime,
        endDate: m.endDate,
        urls,
        thumbs,
        downloads,
        taken,
        lodgingAt:
          withTime && m.lodgingLat != null && m.lodgingLon != null
            ? { lat: m.lodgingLat, lon: m.lodgingLon }
            : null,
        count: list.length,
        photosPublic: m.photosPublic,
      });
    }
  }
  return out;
}

/** 한 모임의 사진 전부 — 모임 상세에서만 쓴다 (올린 사람 이름은 참가자 명단에서 찾는다) */
export async function listPhotos(
  postId: string,
  opts?: {
    anonymous?: boolean;
    viewerId?: string;
    /**
     * 받기 주소를 붙일지. **안 갔던 사람에게는 안 붙인다.**
     *
     * 이 화면에 사진이 보이는 것과 파일을 가져갈 수 있는 것은 다르다 — 호스트가
     * photosPublic으로 연 것은 보여 주기까지다. 라우트도 같은 기준으로 막는다
     * (app/api/photos/[photoId]/download).
     */
    canDownload?: boolean;
  }
): Promise<PhotoView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(postPhotos)
    .where(and(eq(postPhotos.postId, postId), isNull(postPhotos.deletedAt)))
    .orderBy(asc(postPhotos.createdAt));
  /*
   * 익명 카테고리에서는 「누가 올렸는지」를 응답에서 지운다.
   *
   * 화면에 이름을 안 그리는 것만으로는 부족하다 — 여기 담긴 회원번호가 그대로 나가면
   * 개발자 도구를 여는 것만으로 어느 사진을 누가 올렸는지 읽힌다 (명단의 회원번호를
   * anon:N으로 바꿔 두는 lib/db/posts.ts와 같은 이유다).
   *
   * 보고 있는 본인 것만 진짜 번호를 남긴다. 그 값으로 「내가 올린 사진」의 지우기
   * 버튼이 결정되고, 그건 본인이 이미 아는 사실이라 새로 새는 것이 없다.
   */
  const hide = (userId: string) =>
    opts?.anonymous && userId !== opts.viewerId ? '' : userId;
  /*
   * 화면에 그릴 것만 서명한다 — 받기는 우리 라우트를 거치므로 서명이 필요 없다.
   * 격자용(썸네일)과 확대용(화면용) 둘 다 미리 서명해 둔다: 격자를 눌러 크게 볼 때
   * 그제야 서명하러 다녀오면 확대 창이 잠깐 비어 있다.
   */
  const signed = await signedUrls(rows.flatMap(displayAndThumb));
  return rows
    .map((r) => ({
      id: r.id,
      userId: hide(r.userId),
      url: signed.get(r.pathname) ?? '',
      thumbUrl: thumbOr(signed, r, signed.get(r.pathname) ?? ''),
      downloadUrl: opts?.canDownload === false ? '' : downloadPath(r.id),
      downloadIsOriginal: Boolean(r.originalPathname),
      width: r.width,
      height: r.height,
      createdAt: r.createdAt.toISOString(),
      takenAt: r.takenAt?.toISOString() ?? null,
      takenOffset: r.takenOffset,
      lat: r.lat,
      lon: r.lon,
      place: r.place,
    }))
    .filter((p) => p.url);
}

export async function countPhotos(postId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ id: postPhotos.id })
    .from(postPhotos)
    .where(and(eq(postPhotos.postId, postId), isNull(postPhotos.deletedAt)));
  return rows.length;
}

export async function addPhoto(input: {
  postId: string;
  userId: string;
  pathname: string;
  /** 고른 파일 그대로의 경로. 원본을 못 올렸으면 null — 화면용만 있어도 사진은 남는다 */
  originalPathname?: string | null;
  /** 격자용 400px. 못 올렸으면 null — 그때는 격자가 화면용을 쓴다 */
  thumbPathname?: string | null;
  width: number | null;
  height: number | null;
  /**
   * 찍은 시각·자리 (EXIF). 부르는 쪽이 lib/photos.ts의 exifFromBody로 걸러서 넘긴다 —
   * 타임라인을 안 쓰는 카테고리에서는 통째로 null이 온다.
   */
  exif?: PhotoExifInput;
}): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const { exif, ...rest } = input;
  await db.insert(postPhotos).values({ id, ...rest, ...(exif ?? NO_EXIF) });
  return id;
}

/** 지울 사진 한 장 — 없거나 남의 것이면 null (부르는 쪽이 권한을 확인한다) */
export async function getPhoto(photoId: string): Promise<(PhotoView & { postId: string; pathname: string }) | null> {
  const db = await getDb();
  const [r] = await db.select().from(postPhotos).where(and(eq(postPhotos.id, photoId), isNull(postPhotos.deletedAt)));
  if (!r) return null;
  return {
    id: r.id,
    postId: r.postId,
    userId: r.userId,
    // 지울 때 쓰는 값이라 서명하지 않는다 (del은 경로를 받는다)
    url: '',
    thumbUrl: '',
    downloadUrl: '',
    downloadIsOriginal: false,
    pathname: r.pathname,
    width: r.width,
    height: r.height,
    createdAt: r.createdAt.toISOString(),
    // 지우는 자리라 안 쓴다 — 모양만 맞춘다
    takenAt: null,
    takenOffset: null,
    lat: null,
    lon: null,
    place: null,
  };
}

/**
 * 사진 지우기 — 행에 표시만 하고 저장소의 파일은 그대로 둔다.
 *
 * 파일까지 지우면 되살려도 깨진 그림만 남는다. 아래 allPhotoPaths가 지워진 사진도
 * 「주인 있는 파일」로 세기 때문에, 청소(blob-sweep)가 그 파일을 가져가지도 않는다.
 */
export async function deletePhotoRow(photoId: string): Promise<void> {
  const db = await getDb();
  await db.update(postPhotos).set({ deletedAt: new Date() }).where(eq(postPhotos.id, photoId));
}

/**
 * 청소가 「주인 있는 파일」을 가려내는 데 쓴다.
 *
 * **지워진 사진도 센다 (isNull을 붙이지 않는다).** 붙이면 청소가 그 파일을 주인 없는
 * 것으로 보고 지워버려서, 되살릴 수 있다는 말이 거짓이 된다.
 *
 * **세 벌을 다 센다.** 한 장이 파일 셋(화면용·원본·썸네일)이라, 하나라도 빠뜨리면
 * 청소가 그걸 주인 없는 것으로 보고 전부 걷어간다 — 「원본 받기」가 조용히 죽는 길이
 * 정확히 이것이고, 썸네일을 더할 때도 같은 자리를 고쳐야 한다.
 *
 * 경로에 적힌 회원번호는 여기서 보지 않는다. 청소는 「행이 가리키는 파일인가」로만
 * 가리므로, 백필처럼 관리자가 남의 사진 썸네일을 자기 자리에 올려도 그대로 지켜진다.
 */
export async function allPhotoPaths(): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({
      pathname: postPhotos.pathname,
      originalPathname: postPhotos.originalPathname,
      thumbPathname: postPhotos.thumbPathname,
    })
    .from(postPhotos);
  return rows.flatMap((r) =>
    [r.pathname, r.originalPathname, r.thumbPathname].filter((p): p is string => Boolean(p))
  );
}
