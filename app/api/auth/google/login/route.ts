import { NextRequest, NextResponse } from 'next/server';
import { GOOGLE_PKCE_COOKIE, GOOGLE_STATE_COOKIE, LOGIN_NEXT_COOKIE, safeNextPath } from '@/lib/auth';
import { GOOGLE_AUTH_URL, GOOGLE_SCOPE, googleConfigured, googleRedirectUri } from '@/lib/google-oauth';
import { REGIONS } from '@/lib/region';
import { regionOfRequest } from '@/lib/region-server';

export const dynamic = 'force-dynamic';

const base64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');

/**
 * 구글 로그인 시작 — 카카오(app/api/auth/login)와 같은 꼴에 PKCE를 더한 것.
 *
 * **지역이 구글 문을 안 열었으면 404.** 단추가 없는 것으로는 모자란다 — 주소를 손으로
 * 쳐서 캔자스 호스트로 구글 계정을 만드는 길을 막아야 한다 (lib/region.ts의 loginProviders).
 *
 * PKCE는 우리가 시크릿을 가진 클라이언트라 필수는 아니지만, 코드를 이 브라우저에 묶어
 * 두는 값이 쿠키 하나라 넣는다.
 */
export async function GET(req: NextRequest) {
  const region = regionOfRequest(req);
  if (!REGIONS[region].loginProviders.includes('google')) return new NextResponse(null, { status: 404 });

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !googleConfigured()) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET is not configured.' }, { status: 500 });
  }

  const origin = req.nextUrl.origin;
  const state = crypto.randomUUID();
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  );

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', googleRedirectUri(origin));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', GOOGLE_SCOPE);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  // 계정이 여럿인 사람이 어느 것으로 들어올지 고르게 — 자동으로 마지막 계정을 타면 헷갈린다
  url.searchParams.set('prompt', 'select_account');

  const res = NextResponse.redirect(url);
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  } as const;
  res.cookies.set(GOOGLE_STATE_COOKIE, state, cookieOpts);
  res.cookies.set(GOOGLE_PKCE_COOKIE, verifier, cookieOpts);
  // 로그인 완료 후 복귀할 경로 (예: 공유받은 모임 링크)
  res.cookies.set(LOGIN_NEXT_COOKIE, safeNextPath(req.nextUrl.searchParams.get('next')), cookieOpts);
  return res;
}
