import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE, STATE_COOKIE } from '@/lib/auth';
import { updateProfile } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const savedState = req.cookies.get(STATE_COOKIE)?.value;

  const fail = (reason: string) => {
    const res = NextResponse.redirect(`${origin}/?login_error=${encodeURIComponent(reason)}`);
    res.cookies.delete(STATE_COOKIE);
    return res;
  };

  if (!code || !state || !savedState || state !== savedState) {
    return fail('로그인 요청이 만료됐어요. 다시 시도해주세요.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.KAKAO_REST_API_KEY ?? '',
    redirect_uri: `${origin}/api/auth/callback`,
    code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    body.set('client_secret', process.env.KAKAO_CLIENT_SECRET);
  }

  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  if (!tokenRes.ok) {
    console.error('[kakao] token exchange failed:', tokenRes.status, await tokenRes.text());
    return fail('카카오 토큰 발급에 실패했어요.');
  }
  const token = await tokenRes.json();

  const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) return fail('카카오 프로필 조회에 실패했어요.');
  const me = await meRes.json();

  const id = String(me.id);
  const name: string =
    me.kakao_account?.profile?.nickname ?? me.properties?.nickname ?? `카카오${id.slice(-4)}`;

  // 카카오 닉네임을 프로필에 기록 (변경 이력 포함). 실패해도 로그인은 진행.
  try {
    await updateProfile(id, { kakaoName: name });
  } catch (e) {
    console.error('[kakao] profile upsert failed:', e);
  }

  const res = NextResponse.redirect(`${origin}/`);
  res.cookies.set(SESSION_COOKIE, createSessionToken({ id, name }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  res.cookies.delete(STATE_COOKIE);
  return res;
}
