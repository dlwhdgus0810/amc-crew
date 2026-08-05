import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from './index';
import { postPhotos } from './schema';

/**
 * 모임 사진 — DB 쪽.
 *
 * 사진 자체는 Vercel Blob에 있고 여기에는 주소만 있다.
 * 지우는 것은 두 곳(행과 파일)이라 부르는 쪽이 순서를 지켜야 한다 — 아래 deletePhoto 참고.
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
 * 여러 모임의 사진 수를 한 번에.
 * 목록 화면이 모임마다 따로 묻지 않도록 정산·평점 요약과 같은 모양으로 둔다.
 */
export async function photoCounts(postIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (postIds.length === 0) return out;

  const db = await getDb();
  const rows = await db
    .select({ postId: postPhotos.postId, url: postPhotos.url })
    .from(postPhotos)
    .where(inArray(postPhotos.postId, postIds));
  for (const r of rows) out.set(r.postId, (out.get(r.postId) ?? 0) + 1);
  return out;
}

/**
 * 카드에 한 장만 띄우기 위한 「첫 사진」 — 모임마다 가장 먼저 올라온 것.
 * 수와 함께 필요해서 같은 질의에서 뽑는다.
 */
export async function photoCovers(postIds: string[]): Promise<Map<string, { cover: string; count: number }>> {
  const out = new Map<string, { cover: string; count: number }>();
  if (postIds.length === 0) return out;

  const db = await getDb();
  const rows = await db
    .select({ postId: postPhotos.postId, url: postPhotos.url })
    .from(postPhotos)
    .where(inArray(postPhotos.postId, postIds))
    .orderBy(asc(postPhotos.createdAt));

  for (const r of rows) {
    const prev = out.get(r.postId);
    // 올라온 순서라 처음 만난 것이 곧 첫 장이다
    if (!prev) out.set(r.postId, { cover: r.url, count: 1 });
    else prev.count += 1;
  }
  return out;
}

/** 한 모임의 사진 전부 — 모임 상세에서만 쓴다 (올린 사람 이름은 참가자 명단에서 찾는다) */
export async function listPhotos(postId: string): Promise<PhotoView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(postPhotos)
    .where(eq(postPhotos.postId, postId))
    .orderBy(asc(postPhotos.createdAt));
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    url: r.url,
    width: r.width,
    height: r.height,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function countPhotos(postId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.select({ id: postPhotos.id }).from(postPhotos).where(eq(postPhotos.postId, postId));
  return rows.length;
}

export async function addPhoto(input: {
  postId: string;
  userId: string;
  url: string;
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
  const [r] = await db.select().from(postPhotos).where(eq(postPhotos.id, photoId));
  if (!r) return null;
  return {
    id: r.id,
    postId: r.postId,
    userId: r.userId,
    url: r.url,
    pathname: r.pathname,
    width: r.width,
    height: r.height,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function deletePhotoRow(photoId: string): Promise<void> {
  const db = await getDb();
  await db.delete(postPhotos).where(and(eq(postPhotos.id, photoId)));
}

/** 모임을 지울 때 같이 지울 파일 주소들 — CASCADE는 행만 지우고 저장소는 모른다 */
export async function photoUrlsForPost(postId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select({ url: postPhotos.url }).from(postPhotos).where(eq(postPhotos.postId, postId));
  return rows.map((r) => r.url);
}

/** 청소가 「주인 있는 파일」을 가려내는 데 쓴다 */
export async function allPhotoUrls(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select({ url: postPhotos.url }).from(postPhotos);
  return rows.map((r) => r.url);
}
