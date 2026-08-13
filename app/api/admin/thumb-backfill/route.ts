import { NextRequest, NextResponse } from 'next/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db/index';
import { postPhotos } from '@/lib/db/schema';
import { signedUrls } from '@/lib/blob';
import { thumbPathAllowed } from '@/lib/photos';

export const dynamic = 'force-dynamic';

/**
 * 썸네일이 없는 옛 사진 채우기 — **줄이는 일은 브라우저가 한다.**
 *
 * 서버에서 줄이려면 이미지 라이브러리를 새로 들여야 하는데, 이 한 번을 위해 의존성을
 * 늘리지 않는다. 브라우저에는 이미 캔버스가 있고 올릴 때 쓰는 코드도 그대로 있다
 * (lib/photo-client.ts). 그래서 여기는 두 가지만 한다:
 *
 *   GET   아직 썸네일이 없는 사진과 그 화면용 주소를 준다
 *   POST  브라우저가 만들어 올린 썸네일 경로를 행에 적는다
 *
 * 한 번 돌리고 나면 쓸 일이 없는 라우트다. 그래도 남겨 둔다 — 올릴 때 썸네일만 실패한
 * 사진이 생길 수 있고(회선이 끊기면 그렇다), 그때 다시 돌리면 된다.
 */

/** 한 번에 주는 수. 브라우저가 이만큼 받아 줄이고 올린 뒤 다시 물어본다 */
const BATCH = 10;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);

  const db = await getDb();
  const rows = await db
    .select({ id: postPhotos.id, pathname: postPhotos.pathname })
    .from(postPhotos)
    .where(and(isNull(postPhotos.thumbPathname), isNull(postPhotos.deletedAt)))
    .orderBy(asc(postPhotos.createdAt))
    .limit(BATCH);

  // 남은 수도 같이 준다 — 화면이 「12/41」을 보여줄 수 있게
  const left = await db
    .select({ id: postPhotos.id })
    .from(postPhotos)
    .where(and(isNull(postPhotos.thumbPathname), isNull(postPhotos.deletedAt)));

  const signed = await signedUrls(rows.map((r) => r.pathname));
  return NextResponse.json({
    left: left.length,
    photos: rows
      .map((r) => ({ id: r.id, url: signed.get(r.pathname) ?? '' }))
      .filter((p) => p.url),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const thumbPathname = typeof body?.thumbPathname === 'string' ? body.thumbPathname : '';
  if (!id || !thumbPathname) return await errJson(E.badRequest, 400);

  const db = await getDb();
  const [row] = await db.select().from(postPhotos).where(eq(postPhotos.id, id));
  if (!row) return await errJson(E.photoNotFound, 404);

  /*
   * 썸네일은 **백필을 돌린 관리자 자리**에 올라간다. 올리는 토큰이 그 사람 경로에
   * 묶이기 때문이고(app/api/blob/upload), 남의 자리에 쓰게 열어 주는 것보다 낫다.
   *
   * 경로 주인이 사진 주인과 달라도 괜찮다 — 청소는 「행이 가리키는 파일인가」로만
   * 가리므로(lib/db/photos.ts의 allPhotoPaths) 이 파일도 그대로 지켜진다.
   */
  if (!thumbPathAllowed(thumbPathname, user.id)) return await errJson(E.photoBadUrl, 400);

  await db.update(postPhotos).set({ thumbPathname }).where(eq(postPhotos.id, id));
  return NextResponse.json({ ok: true });
}
