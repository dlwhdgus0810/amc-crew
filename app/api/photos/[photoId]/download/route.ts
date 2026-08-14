import { NextRequest } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { E, errJson } from '@/lib/apierr';
import { adminIds, getSessionUser } from '@/lib/auth';
import { getDb } from '@/lib/db/index';
import { postPhotos } from '@/lib/db/schema';
import { getPostView } from '@/lib/db/posts';
import { signedUrl } from '@/lib/blob';

export const dynamic = 'force-dynamic';

/**
 * 사진 받기 — 저장소 파일을 **우리 주소로** 흘려보낸다.
 *
 * 예전에는 저장소의 서명 주소를 그대로 눌러 열게 했다. 데스크톱에서는 잘 됐는데
 * 폰에서는 멈췄다: 홈 화면에 추가한 앱은 새 창을 여는데, 그 창이 받은 응답은 그릴 것이
 * 없는 첨부파일이라 흰 화면인 채로 남고 돌아갈 길도 없다. 같은 주소로 내려보내면
 * <a download>가 먹어서 창을 아예 안 연다.
 *
 * **주소에 모임 id를 넣지 않는다.** 예전 주소는 /api/posts/{postId}/photos/{photoId}였는데,
 * 그 값이 모아보기 응답에 그대로 실렸다. 비공개 모임은 /p/{id}가 곧 초대장이라, 사진만
 * 열어 둔 모임의 id가 회원 전체에게 나가는 셈이었다 — 화면에서 링크를 지워도 개발자
 * 도구에는 남는다. 사진 id 하나면 어느 모임인지는 서버가 찾을 수 있으므로 그렇게 한다.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  const { photoId } = await params;

  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  const db = await getDb();
  const [row] = await db
    .select()
    .from(postPhotos)
    .where(and(eq(postPhotos.id, photoId), isNull(postPhotos.deletedAt)));
  if (!row) return await errJson(E.photoNotFound, 404);

  const post = await getPostView(row.postId, user.id);
  if (!post?.photos) return await errJson(E.photoNotFound, 404);

  /*
   * **보는 것과 받는 것을 여기서 가른다.**
   *
   * post.photos는 참가자·관리자에 더해 호스트가 열어 둔 모임(photosPublic)에도 채워진다.
   * 그건 「보여 주기」까지고, 안 갔던 사람이 파일을 가져가는 것까지 연 것은 아니다.
   * 그래서 받기는 갔던 사람과 관리자만이다.
   *
   * 화면에서도 그 묶음에는 받기 주소를 안 싣지만(lib/db/photos.ts의 myPhotoWall),
   * 주소는 짐작할 수 있으므로 여기서 다시 본다 — 화면에서만 감추면 감춘 것이 아니다.
   *
   * 익명 카테고리에서도 이 검사가 맞다. 명단은 남의 회원번호만 가리고 보고 있는 본인
   * 번호는 그대로 남기기 때문이다 (lib/db/posts.ts).
   */
  const joined = post.participants.some((p) => p.id === user.id);
  if (!joined && !adminIds().includes(user.id)) return await errJson(E.photoNotFound, 404);

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
