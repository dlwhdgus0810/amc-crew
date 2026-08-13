import { NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db/index';
import { postPhotos } from '@/lib/db/schema';
import { getPostView } from '@/lib/db/posts';
import { signedUrl } from '@/lib/blob';

export const dynamic = 'force-dynamic';

/**
 * 사진 받기 — 저장소 파일을 **우리 주소로** 흘려보낸다.
 *
 * 예전에는 저장소의 서명 주소를 그대로 눌러 열게 했다. 데스크톱에서는 저장소가 보낸
 * Content-Disposition을 브라우저가 받아 파일로 떨궈서 잘 됐는데, 폰에서는 멈췄다:
 * 홈 화면에 추가한 앱은 target=_blank가 앱 안쪽 브라우저 창을 여는데, 그 창이 받은
 * 응답은 그릴 것이 없는 첨부파일이라 흰 화면인 채로 남는다. 돌아갈 길도 없다.
 *
 * 같은 주소(same-origin)로 내려보내면 <a download>가 그제야 먹는다 — 창을 새로
 * 열지 않으므로 보던 화면이 그대로 있고, 폰은 이것을 그냥 「받기」로 처리한다.
 *
 * 덤으로 서명 주소가 화면에 안 나간다. 서명에는 유효기간이 있을 뿐 자격 확인이 없어서,
 * 주소만 알면 누구나 열 수 있었다. 이제 받을 자격을 여기서 매번 확인한다.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const { id, photoId } = await params;

  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  /*
   * 볼 수 있는 사람인지는 post.photos로 가린다.
   *
   * 참가자·관리자, 그리고 호스트가 열어 둔 모임(photosPublic)이면 채워지고 그 밖에는
   * null이다 — 화면이 쓰는 것과 **같은 판정**이라 둘이 어긋날 수 없다.
   */
  const post = await getPostView(id, user.id);
  if (!post?.photos) return await errJson(E.photoNotFound, 404);

  const db = await getDb();
  const [row] = await db
    .select()
    .from(postPhotos)
    .where(and(eq(postPhotos.id, photoId), eq(postPhotos.postId, id), isNull(postPhotos.deletedAt)));
  if (!row) return await errJson(E.photoNotFound, 404);

  // 올린 그대로의 파일이 있으면 그것, 없으면 화면에 보이는 줄인 사진
  const pathname = row.originalPathname ?? row.pathname;
  const url = await signedUrl(pathname);
  if (!url) return await errJson(E.photoNotFound, 404);

  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) return await errJson(E.photoNotFound, 404);

  /*
   * 받는 사람 폰에 남을 이름. 저장소 경로는 임의의 문자열이라 그대로 쓰면 뜻이 없다 —
   * 어느 모임 사진인지 알아볼 수 있게 카테고리와 날짜로 짓는다.
   */
  const ext = (pathname.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'jpg').toLowerCase();
  const name = `${post.category}-${post.date ?? 'undated'}-${photoId.slice(0, 8)}.${ext}`;

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`,
      ...(upstream.headers.get('content-length')
        ? { 'Content-Length': upstream.headers.get('content-length')! }
        : {}),
      // 서명 주소가 만료되면 이 응답도 못 만든다 — 중간에 담아 두지 않게 한다
      'Cache-Control': 'private, no-store',
    },
  });
}
