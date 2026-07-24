import { NextRequest, NextResponse } from 'next/server';
import { LOGIN_NEXT_COOKIE, safeNextPath, STATE_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    return NextResponse.json(
      { error: 'KAKAO_REST_API_KEY 환경변수가 설정되지 않았어요.' },
      { status: 500 }
    );
  }

  const origin = req.nextUrl.origin;
  const state = crypto.randomUUID();

  const url = new URL('https://kauth.kakao.com/oauth/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', `${origin}/api/auth/callback`);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  // 명시적 scope 요청: 이미 로그인했던 사용자도 아직 동의 안 한 항목(talk_message)의
  // 추가 동의 화면을 보게 된다 (모두 동의된 상태면 화면 없이 통과)
  url.searchParams.set('scope', 'profile_nickname,talk_message');

  const res = NextResponse.redirect(url);
  const cookieOpts = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  } as const;
  res.cookies.set(STATE_COOKIE, state, cookieOpts);
  // 로그인 완료 후 복귀할 경로 (예: 공유받은 모임 링크)
  res.cookies.set(LOGIN_NEXT_COOKIE, safeNextPath(req.nextUrl.searchParams.get('next')), cookieOpts);
  return res;
}
