import { NextRequest, NextResponse } from 'next/server';
import { LOGIN_NEXT_COOKIE, STATE_COOKIE } from '@/lib/auth';
import { finishLogin } from '@/lib/auth-finish';
import { LOCALE_COOKIE, Msg, pick, toLocale } from '@/lib/i18n';

const T = {
  talkOn: {
    ko: '카카오톡 알림을 켰어요. 구독한 취미에 새 모임이 올라오면 여기로 알려드릴게요.',
    en: 'KakaoTalk alerts are on. We’ll message you here when a new meetup is posted in the hobbies you follow.',
    es: 'Avisos por KakaoTalk activados. Te escribiremos aquí cuando se abra una quedada en tus aficiones.',
  },
  openApp: { ko: '앱 열기', en: 'Open the app', es: 'Abrir la app' },
  expired: { ko: '로그인 요청이 만료됐어요. 다시 시도해주세요.', en: 'The login request expired. Please try again.', es: 'La solicitud de inicio de sesión caducó. Inténtalo otra vez.' },
  tokenFailed: { ko: '카카오 토큰 발급에 실패했어요.', en: 'Kakao token exchange failed.', es: 'Falló el intercambio de token con Kakao.' },
  profileFailed: { ko: '카카오 프로필 조회에 실패했어요.', en: 'Couldn’t load your Kakao profile.', es: 'No se pudo cargar tu perfil de Kakao.' },
};

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const savedState = req.cookies.get(STATE_COOKIE)?.value;
  // 프로필의 "카톡 알림 켜기"로 시작된 재동의 흐름인지

  const clearTemp = (res: NextResponse) => {
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(LOGIN_NEXT_COOKIE);
    return res;
  };

  // 로그인 실패 안내도 저장된 언어(쿠키)로
  const locale = toLocale(req.cookies.get(LOCALE_COOKIE)?.value);
  const fail = (reason: Msg) =>
    clearTemp(NextResponse.redirect(`${origin}/?login_error=${encodeURIComponent(pick(locale, reason))}`));

  if (!code || !state || !savedState || state !== savedState) {
    return fail(T.expired);
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
    return fail(T.tokenFailed);
  }
  const token = await tokenRes.json();

  const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) return fail(T.profileFailed);
  const me = await meRes.json();

  const id = String(me.id);
  const name: string =
    me.kakao_account?.profile?.nickname ?? me.properties?.nickname ?? `카카오${id.slice(-4)}`;

  // 그다음은 구글과 같다 — 프로필·관리자 알림·세션·복귀 (lib/auth-finish.ts)
  return clearTemp(await finishLogin(req, { id, name }, { logTag: 'kakao' }));
}
