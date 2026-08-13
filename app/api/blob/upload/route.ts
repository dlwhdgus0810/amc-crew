import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import {
  MAX_ORIGINAL_BYTES,
  MAX_UPLOAD_BYTES,
  ORIGINAL_TYPES,
  originalPathAllowed,
  pathAllowed,
  thumbPathAllowed,
} from '@/lib/photos';

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
 * 여기서 보는 것은 「이 사람이 자기 자리에 쓰려는가」뿐이다. 모임과의 관계는 여기서 안 본다 —
 * 모임을 만들면서 고른 사진은 그 시점에 모임이 아직 없기 때문이다. 어느 모임에 매다는지는
 * 저장할 때 확인한다 (app/api/posts/route.ts, app/api/posts/[id]/photos/route.ts).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        const user = await getSessionUser();
        if (!user) throw new Error('로그인이 필요합니다');
        if (await banGuard(user)) throw new Error('지금은 올릴 수 없습니다');

        /*
         * 토큰은 이 경로에 묶인다 — 안 막으면 저장소 아무 데나 쓸 수 있다.
         *
         * 한 장이 두 벌로 올라온다: 화면에 뿌릴 것(브라우저가 줄여 구운 JPEG)과
         * 받아갈 원본(고른 파일 그대로). 경로 모양으로 갈리고, 붙는 규칙도 다르다 —
         * 원본은 HEIC일 수 있고 훨씬 크다.
         */
        const isOriginal = originalPathAllowed(pathname, user.id);
        /*
         * 썸네일도 따로 본다. pathAllowed로도 통과하긴 하는데(접미사 자리에 -thumb가
         * 들어간다) 그건 우연이고, 저장소가 무작위 접미사를 붙인 뒤에는 통과하지 못한다 —
         * 실제로 그 어긋남 때문에 백필이 멈췄다 (lib/photos.ts의 thumbPathAllowed).
         */
        if (!isOriginal && !thumbPathAllowed(pathname, user.id) && !pathAllowed(pathname, user.id)) {
          throw new Error('경로가 올바르지 않습니다');
        }

        return {
          /*
           * 비공개 스토어다 — 주소를 알아도 서명 없이는 403이다.
           * 그래서 비공개 모임 사진이 링크만으로 열리는 일이 없다. 대신 화면에 그릴 때마다
           * 서버가 서명해 준다 (lib/blob.ts).
           */
          access: 'private' as const,
          // 화면용은 브라우저가 canvas로 항상 다시 굽는다 — 그 자리에는 JPEG만 온다
          allowedContentTypes: isOriginal ? [...ORIGINAL_TYPES] : ['image/jpeg'],
          maximumSizeInBytes: isOriginal ? MAX_ORIGINAL_BYTES : MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      /*
       * 여기에 DB 쓰기를 넣지 말 것.
       *
       * 저장소가 우리 배포본으로 되전화하는 방식이라 localhost에서는 아예 안 불린다.
       * 넣으면 프로덕션에서만 되는 기능이 된다. 행은 올리기가 끝난 뒤 브라우저가 따로 남긴다.
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
