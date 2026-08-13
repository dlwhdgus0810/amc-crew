import { NextRequest } from 'next/server';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db/index';
import { postPhotos } from '@/lib/db/schema';
import { getPostView } from '@/lib/db/posts';
import { signedUrls } from '@/lib/blob';
import { zipStream, type ZipEntry } from '@/lib/zip';

export const dynamic = 'force-dynamic';
/**
 * 사진을 한 장씩 받아 흘려보내는 동안 함수가 살아 있어야 한다. 기본 10초로는
 * 열 장짜리도 못 넘긴다. 60초는 Vercel에서 이 요금제가 허용하는 최대치다.
 */
export const maxDuration = 60;

/**
 * 이 모임 사진 전부를 ZIP 한 파일로.
 *
 * 한 장씩 누르는 것을 서른 번 하는 것이 실제로 사람들이 하던 일이라 묶어 준다.
 * 폰에서는 한 장씩 받기가 더 나쁘다 — 브라우저가 두 번째부터 막는다.
 *
 * 자격은 한 장 받기(../[photoId]/download)와 **같은 판정**이다: post.photos가 채워지는
 * 사람만. 묶음이라고 더 넓히면 한 장은 못 받는데 전부는 받아지는 꼴이 된다.
 *
 * 압축하지 않는다(lib/zip.ts). JPEG는 이미 압축돼 있어서 줄지 않고, 대신 한 장씩
 * 흘려보낼 수 있어 함수가 쓰는 메모리가 사진 한 장에서 멈춘다.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const post = await getPostView(id, user.id);
  if (!post?.photos) return await errJson(E.photoNotFound, 404);

  const db = await getDb();
  const rows = await db
    .select()
    .from(postPhotos)
    .where(and(eq(postPhotos.postId, id), isNull(postPhotos.deletedAt)))
    .orderBy(asc(postPhotos.createdAt));
  if (rows.length === 0) return await errJson(E.photoNotFound, 404);

  /*
   * 서명은 한 번에 몰아서 받는다. 장마다 따로 발급하면 서른 장에 서른 번 왕복이고,
   * 그 시간이 그대로 「받기가 시작되기까지」로 쌓인다.
   */
  const paths = rows.map((r) => r.originalPathname ?? r.pathname);
  const signed = await signedUrls(paths);

  const when = post.date ?? 'undated';
  const entries: ZipEntry[] = rows.map((r, i) => {
    const pathname = r.originalPathname ?? r.pathname;
    const ext = (pathname.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'jpg').toLowerCase();
    return {
      // 푼 뒤에도 찍은 순서가 남게 번호를 앞에 둔다 (이름순 = 올린 순)
      name: `${post.category}-${when}-${String(i + 1).padStart(2, '0')}.${ext}`,
      fetch: async () => {
        const url = signed.get(pathname);
        if (!url) return null;
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          return new Uint8Array(await res.arrayBuffer());
        } catch {
          return null; // 한 장이 실패해도 나머지는 묶인다
        }
      },
    };
  });

  return new Response(zipStream(entries), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${post.category}-${when}-photos.zip"`,
      // 길이를 미리 알 수 없다(다 받아 재야 안다) — 중간에 담아 두지도 않게 한다
      'Cache-Control': 'private, no-store',
    },
  });
}
