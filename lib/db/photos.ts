import { and, asc, desc, eq, inArray, isNull, or } from 'drizzle-orm';
import { getDb } from './index';
import { postParticipants, postPhotos, posts } from './schema';
import { asDownload, signedUrls } from '../blob';

/**
 * 모임 사진 — DB 쪽.
 *
 * 사진 자체는 Vercel Blob에 있고 여기에는 경로만 있다. 스토어가 비공개라 주소는 서명해야
 * 열리고 유효기간이 있어서, 밖으로 내보낼 때 그때그때 서명해 준다.
 *
 * 지우는 것은 두 곳(행과 파일)이라 부르는 쪽이 순서를 지켜야 한다 — 행 먼저, 파일 나중.
 */

export interface PhotoView {
  id: string;
  userId: string;
  url: string;
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

export interface PhotoStrip {
  /** 카드에 실리는 그림들 (앞의 몇 장) */
  urls: string[];
  /**
   * 위 urls와 **같은 순서**의 받기 주소. 카드에서 사진을 눌러 크게 봤을 때 쓴다.
   *
   * 처음에는 안 실었는데, 그래서 카드에서 연 확대 창에만 받기 버튼이 없었다 —
   * 모임에 들어가서 열면 있고 목록에서 열면 없으니, 쓰는 사람에게는 고장으로 보인다.
   */
  downloads: { url: string; isOriginal: boolean }[];
  /** 자른 수가 아니라 실제 전체 장수 */
  count: number;
}

export async function photoStrips(postIds: string[]): Promise<Map<string, PhotoStrip>> {
  const out = new Map<string, PhotoStrip>();
  if (postIds.length === 0) return out;

  const db = await getDb();
  const rows = await db
    .select({ postId: postPhotos.postId, pathname: postPhotos.pathname, originalPathname: postPhotos.originalPathname })
    .from(postPhotos)
    .where(and(inArray(postPhotos.postId, postIds), isNull(postPhotos.deletedAt)))
    .orderBy(asc(postPhotos.createdAt));

  const byPost = new Map<string, { pathname: string; originalPathname: string | null }[]>();
  for (const r of rows) {
    const list = byPost.get(r.postId) ?? [];
    list.push({ pathname: r.pathname, originalPathname: r.originalPathname });
    byPost.set(r.postId, list);
  }

  /*
   * 서명은 실을 것만 — 자른 뒤의 것까지 서명하면 그만큼이 그대로 낭비다.
   * 원본은 있는 것만 서명한다. 없으면 받기 주소로 그림 자체를 쓴다.
   */
  const shown = [...byPost.values()].flatMap((list) => list.slice(0, STRIP_LIMIT));
  const signed = await signedUrls([
    ...shown.map((p) => p.pathname),
    ...shown.map((p) => p.originalPathname).filter((p): p is string => Boolean(p)),
  ]);

  for (const [postId, list] of byPost) {
    const urls: string[] = [];
    const downloads: PhotoStrip['downloads'] = [];
    for (const p of list.slice(0, STRIP_LIMIT)) {
      const url = signed.get(p.pathname);
      if (!url) continue; // 서명을 못 만든 장은 통째로 뺀다 (깨진 그림보다 낫다)
      urls.push(url);
      const orig = p.originalPathname ? signed.get(p.originalPathname) : null;
      downloads.push({ url: asDownload(orig ?? url) ?? url, isOriginal: Boolean(orig) });
    }
    // 한 장도 서명을 못 만들었으면 아예 안 내보낸다
    if (urls.length) out.set(postId, { urls, downloads, count: list.length });
  }
  return out;
}

/** 사진 모아보기(/photos) — 모임 하나가 한 묶음 */
export interface PhotoWallGroup {
  postId: string;
  category: string;
  title: string | null;
  date: string | null;
  startTime: string | null;
  /** 실린 사진 (앞의 몇 장) */
  urls: string[];
  /** urls와 같은 순서의 받기 주소 */
  downloads: { url: string; isOriginal: boolean }[];
  /** 자른 수가 아니라 그 모임의 실제 전체 장수 */
  count: number;
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
    .select({ postId: postPhotos.postId, pathname: postPhotos.pathname, originalPathname: postPhotos.originalPathname })
    .from(postPhotos)
    .where(and(inArray(postPhotos.postId, mine.map((m) => m.id)), isNull(postPhotos.deletedAt)))
    .orderBy(asc(postPhotos.createdAt));

  const byPost = new Map<string, { pathname: string; originalPathname: string | null }[]>();
  for (const r of rows) {
    const list = byPost.get(r.postId) ?? [];
    list.push({ pathname: r.pathname, originalPathname: r.originalPathname });
    byPost.set(r.postId, list);
  }

  // 서명은 실을 것만 (photoStrips와 같은 규칙 — 자른 뒤의 것까지 서명하면 그대로 낭비다)
  const shown = [...byPost.values()].flatMap((list) => list.slice(0, WALL_PER_POST));
  const signed = await signedUrls([
    ...shown.map((p) => p.pathname),
    ...shown.map((p) => p.originalPathname).filter((p): p is string => Boolean(p)),
  ]);

  const out: PhotoWallGroup[] = [];
  for (const m of mine) {
    const list = byPost.get(m.id);
    if (!list) continue; // 사진이 없는 모임은 묶음을 만들지 않는다
    const urls: string[] = [];
    const downloads: PhotoWallGroup['downloads'] = [];
    for (const p of list.slice(0, WALL_PER_POST)) {
      const url = signed.get(p.pathname);
      if (!url) continue;
      urls.push(url);
      const orig = p.originalPathname ? signed.get(p.originalPathname) : null;
      downloads.push({ url: asDownload(orig ?? url) ?? url, isOriginal: Boolean(orig) });
    }
    if (urls.length) {
      out.push({
        postId: m.id,
        category: m.category,
        title: m.title,
        date: m.date,
        startTime: m.startTime,
        urls,
        downloads,
        count: list.length,
      });
    }
  }
  return out;
}

/** 한 모임의 사진 전부 — 모임 상세에서만 쓴다 (올린 사람 이름은 참가자 명단에서 찾는다) */
export async function listPhotos(postId: string): Promise<PhotoView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(postPhotos)
    .where(and(eq(postPhotos.postId, postId), isNull(postPhotos.deletedAt)))
    .orderBy(asc(postPhotos.createdAt));
  // 화면용과 원본을 한 번에 서명한다 — 장마다 두 번 부르면 왕복이 두 배가 된다
  const signed = await signedUrls([
    ...rows.map((r) => r.pathname),
    ...rows.map((r) => r.originalPathname).filter((p): p is string => Boolean(p)),
  ]);
  return rows
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      url: signed.get(r.pathname) ?? '',
      // 열지 말고 받게 — 저장소가 파일로 내려보내도록 표를 붙인다
      downloadUrl:
        asDownload(r.originalPathname ? signed.get(r.originalPathname) : null) ??
        asDownload(signed.get(r.pathname)) ??
        '',
      downloadIsOriginal: Boolean(r.originalPathname && signed.get(r.originalPathname)),
      width: r.width,
      height: r.height,
      createdAt: r.createdAt.toISOString(),
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
  width: number | null;
  height: number | null;
}): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(postPhotos).values({ id, ...input });
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
    downloadUrl: '',
    downloadIsOriginal: false,
    pathname: r.pathname,
    width: r.width,
    height: r.height,
    createdAt: r.createdAt.toISOString(),
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
 * **원본도 같이 센다.** 한 장이 파일 두 개(화면용·원본)라, 화면용만 세면 청소가 원본을
 * 주인 없는 것으로 보고 전부 걷어간다 — 「원본 받기」가 조용히 죽는 길이 정확히 이것이다.
 */
export async function allPhotoPaths(): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ pathname: postPhotos.pathname, originalPathname: postPhotos.originalPathname })
    .from(postPhotos);
  return rows.flatMap((r) => (r.originalPathname ? [r.pathname, r.originalPathname] : [r.pathname]));
}
