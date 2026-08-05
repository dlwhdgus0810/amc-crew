import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getPostView, isParticipant } from '@/lib/db/posts';
import { countPhotos } from '@/lib/db/photos';
import { canAddPhotos, MAX_PHOTOS_PER_POST, MAX_UPLOAD_BYTES, pathAllowed } from '@/lib/photos';

export const dynamic = 'force-dynamic';

/**
 * 사진을 올릴 수 있는 짧은 토큰을 내준다.
 *
 * 바이트는 브라우저에서 저장소로 곧장 간다. 서버리스를 통과시키지 않는 이유가 셋 있다.
 *  - Vercel 서버리스는 요청 본문이 4.5MB에서 잘린다. 폰으로 찍은 사진 한 장이 그 근처다.
 *  - 그림을 함수로 들여보냈다 내보내면 대역폭을 두 번 문다. 함수가 그 바이트에 대해
 *    할 말이 없는데도 그렇다.
 *  - upload()가 주는 진행률을 쓸 수 있다. 폰 데이터에서는 그게 있고 없고가 다르다.
 *
 * 여기서 내준 토큰은 브라우저가 저장소에 직접 쓰게 해 준다. 그래서 판정을 전부 여기서 끝낸다 —
 * 이 함수 뒤에는 아무 관문도 없다.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const user = await getSessionUser();
        if (!user) throw new Error('로그인이 필요합니다');
        if (await banGuard(user)) throw new Error('지금은 올릴 수 없습니다');

        const payload = clientPayload ? JSON.parse(clientPayload) : null;
        const kind = payload?.kind === 'flyer' ? 'flyer' : 'photo';

        if (kind === 'photo') {
          const postId = typeof payload?.postId === 'string' ? payload.postId : '';
          const post = await getPostView(postId, user.id);
          if (!post) throw new Error('모임을 찾을 수 없습니다');
          // 「끝났는지」는 서버가 판정한다 — 브라우저 시계를 돌려 미리 올리는 일이 없도록
          if (!canAddPhotos(post)) throw new Error('모임이 끝난 뒤에 올릴 수 있습니다');
          if (!(await isParticipant(postId, user.id)) && !isAdmin(user)) {
            throw new Error('모임에 참가한 사람만 올릴 수 있습니다');
          }
          if ((await countPhotos(postId)) >= MAX_PHOTOS_PER_POST) {
            throw new Error('사진이 가득 찼습니다');
          }
          // 토큰은 이 경로에 묶인다 — 안 막으면 저장소 아무 데나 쓸 수 있다
          if (!pathAllowed(pathname, 'photo', postId)) throw new Error('경로가 올바르지 않습니다');
        } else {
          /*
           * 플라이어는 모임을 만들기 전에 고르므로 여기서는 postId가 없다.
           * 그래서 「로그인했고 정지가 아니다」까지만 본다 — 회원이면 누구나 모임을 만들 수
           * 있으니 그게 딱 필요한 권한이다. 어느 모임에 매다는지는 저장할 때 확인한다
           * (app/api/posts/route.ts, app/api/posts/[id]/route.ts).
           */
          if (!pathAllowed(pathname, 'flyer', user.id)) throw new Error('경로가 올바르지 않습니다');
        }

        return {
          /*
           * 비공개 스토어다 — 주소를 알아도 서명 없이는 403이다.
           * 그래서 비공개 모임 사진이 링크만으로 열리는 일이 없다. 대신 화면에 그릴 때마다
           * 서버가 서명해 준다 (lib/blob.ts).
           */
          access: 'private' as const,
          // 브라우저가 canvas로 항상 다시 굽는다 — 고른 파일이 그대로 올라가는 일은 없다
          allowedContentTypes: ['image/jpeg'],
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id, kind }),
        };
      },
      /*
       * 여기에 DB 쓰기를 넣지 말 것.
       *
       * 저장소가 우리 배포본으로 되전화하는 방식이라 localhost에서는 아예 안 불린다.
       * 넣으면 프로덕션에서만 되는 기능이 된다. 행은 올리기가 끝난 뒤 브라우저가
       * POST /api/posts/[id]/photos로 따로 남긴다.
       */
      onUploadCompleted: async ({ blob }) => {
        console.info('[blob] 업로드 완료:', blob.pathname);
      },
    });
    return NextResponse.json(result);
  } catch (e) {
    // 무엇이 막았는지는 화면에 그대로 보여준다 (권한·크기·형식 다 여기로 온다)
    return NextResponse.json({ error: e instanceof Error ? e.message : '올리지 못했어요.' }, { status: 403 });
  }
}
