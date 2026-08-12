import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { getDb } from './index';
import { postPhotos } from './schema';
import { signedUrls } from '../blob';

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

export async function photoStrips(postIds: string[]): Promise<Map<string, { urls: string[]; count: number }>> {
  const out = new Map<string, { urls: string[]; count: number }>();
  if (postIds.length === 0) return out;

  const db = await getDb();
  const rows = await db
    .select({ postId: postPhotos.postId, pathname: postPhotos.pathname })
    .from(postPhotos)
    .where(and(inArray(postPhotos.postId, postIds), isNull(postPhotos.deletedAt)))
    .orderBy(asc(postPhotos.createdAt));

  const byPost = new Map<string, string[]>();
  for (const r of rows) {
    const list = byPost.get(r.postId) ?? [];
    list.push(r.pathname);
    byPost.set(r.postId, list);
  }

  // 서명은 실을 것만 — 자른 뒤의 것까지 서명하면 그만큼이 그대로 낭비다
  const toSign = [...byPost.values()].flatMap((list) => list.slice(0, STRIP_LIMIT));
  const signed = await signedUrls(toSign);

  for (const [postId, list] of byPost) {
    const urls = list.slice(0, STRIP_LIMIT).map((p) => signed.get(p)).filter((u): u is string => Boolean(u));
    // 한 장도 서명을 못 만들었으면 아예 안 내보낸다 — 깨진 그림을 띄우는 것보다 낫다
    if (urls.length) out.set(postId, { urls, count: list.length });
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
  const signed = await signedUrls(rows.map((r) => r.pathname));
  return rows
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      url: signed.get(r.pathname) ?? '',
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
 */
export async function allPhotoPaths(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select({ pathname: postPhotos.pathname }).from(postPhotos);
  return rows.map((r) => r.pathname);
}
