import { NextRequest, NextResponse } from 'next/server';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/**
 * 배포 진단 — 밖으로 나가는 링크가 왜 그 주소로 나갔는지 확인용.
 *
 * 카톡 알림에 엉뚱한 주소가 박혔을 때, 어느 단계에서 어긋났는지 추측하지 않고 바로 본다:
 *  - requestOrigin: 라우트가 보는 요청 주소 (예전엔 이걸 그대로 링크에 썼다)
 *  - resolvedLink : 지금 링크를 만들면 나오는 주소 (siteUrl의 결과)
 *  - commit       : 이 응답을 만든 배포의 커밋 — 배포 반영 여부를 눈으로 확인
 *
 * 비밀값은 담지 않는다. 공개 주소·커밋·호스트 헤더뿐이라 인증을 걸지 않았다.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  return NextResponse.json({
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
    nodeEnv: process.env.NODE_ENV,

    // 링크 생성에 쓰이는 입력들
    requestOrigin: origin,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,

    // 실제 결과 — 카톡 알림 버튼에 박히는 주소가 이것이다
    resolvedLink: `${siteUrl(origin)}/`,

    headers: {
      host: req.headers.get('host'),
      'x-forwarded-host': req.headers.get('x-forwarded-host'),
      'x-forwarded-proto': req.headers.get('x-forwarded-proto'),
    },
  });
}
