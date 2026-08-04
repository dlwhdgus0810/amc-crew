import { NextRequest, NextResponse } from 'next/server';
import {
  LOGIN_NEXT_COOKIE,
  safeNextPath,
  STATE_COOKIE,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const clientId = process.env.KAKAO_REST_API_KEY;
  if (!clientId) {
    return NextResponse.json(
      { error: 'KAKAO_REST_API_KEY is not configured.' },
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
  // 닉네임만 받는다 — 카톡으로 알림을 보내지 않으므로 talk_message 동의를 구할 이유가 없다
  url.searchParams.set('scope', 'profile_nickname');

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
