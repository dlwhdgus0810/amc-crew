import { NextRequest, NextResponse } from 'next/server';
import { GOOGLE_ID_PREFIX, GOOGLE_PKCE_COOKIE, GOOGLE_STATE_COOKIE, LOGIN_NEXT_COOKIE } from '@/lib/auth';
import { finishLogin } from '@/lib/auth-finish';
import { GOOGLE_TOKEN_URL, GOOGLE_USERINFO_URL, googleRedirectUri } from '@/lib/google-oauth';
import { LOCALE_COOKIE, Msg, pick, toLocale } from '@/lib/i18n';
import { REGIONS } from '@/lib/region';
import { regionOfRequest } from '@/lib/region-server';

const T = {
  expired: { ko: '로그인 요청이 만료됐어요. 다시 시도해주세요.', en: 'The login request expired. Please try again.', es: 'La solicitud de inicio de sesión caducó. Inténtalo otra vez.' },
  denied: { ko: '구글 로그인을 취소했어요.', en: 'Google sign-in was cancelled.', es: 'Se canceló el inicio de sesión con Google.' },
  tokenFailed: { ko: '구글 토큰 발급에 실패했어요.', en: 'Google token exchange failed.', es: 'Falló el intercambio de token con Google.' },
  profileFailed: { ko: '구글 프로필 조회에 실패했어요.', en: 'Couldn’t load your Google profile.', es: 'No se pudo cargar tu perfil de Google.' },
};

export const dynamic = 'force-dynamic';

/**
 * 구글이 돌려보낸 자리. 신원(sub, 이름)까지만 여기서 확인하고, 그다음은 카카오와 같은
 * finishLogin이다. 이메일·사진은 받아도 안 쓴다 — 읽는 데가 없는 값은 들고 있지 않는다.
 */
export async function GET(req: NextRequest) {
  const region = regionOfRequest(req);
  if (!REGIONS[region].loginProviders.includes('google')) return new NextResponse(null, { status: 404 });

  const { origin, searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const savedState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  const verifier = req.cookies.get(GOOGLE_PKCE_COOKIE)?.value;

  const clearTemp = (res: NextResponse) => {
    res.cookies.delete(GOOGLE_STATE_COOKIE);
    res.cookies.delete(GOOGLE_PKCE_COOKIE);
    res.cookies.delete(LOGIN_NEXT_COOKIE);
    return res;
  };

  // 로그인 실패 안내도 저장된 언어(쿠키)로 — 홈이 login_error를 읽어 띄운다 (app/home-client.tsx)
  const locale = toLocale(req.cookies.get(LOCALE_COOKIE)?.value);
  const fail = (reason: Msg) =>
    clearTemp(NextResponse.redirect(`${origin}/?login_error=${encodeURIComponent(pick(locale, reason))}`));

  // 동의 화면에서 취소하면 code 없이 error만 온다
  const error = searchParams.get('error');
  if (error) {
    if (error !== 'access_denied') console.error('[google] authorize error:', error);
    return fail(error === 'access_denied' ? T.denied : T.tokenFailed);
  }
  if (!code || !state || !savedState || state !== savedState || !verifier) {
    return fail(T.expired);
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    // 시작할 때 보낸 것과 글자까지 같아야 한다
    redirect_uri: googleRedirectUri(origin),
    code_verifier: verifier,
  });
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  if (!tokenRes.ok) {
    console.error('[google] token exchange failed:', tokenRes.status, await tokenRes.text());
    return fail(T.tokenFailed);
  }
  const token = await tokenRes.json();

  // id_token을 직접 풀어도 되지만 서명 검증이 붙는다 — 한 번 더 물어보는 쪽이 짧고 확실하다
  const meRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!meRes.ok) return fail(T.profileFailed);
  const me = (await meRes.json()) as { sub?: string | number; name?: string };
  if (me.sub === undefined || me.sub === null || me.sub === '') return fail(T.profileFailed);

  const sub = String(me.sub);
  // 회원번호는 카카오 번호와 겹치지 않게 앞말을 붙인다 (lib/provider.ts)
  const id = `${GOOGLE_ID_PREFIX}${sub}`;
  const name = me.name?.trim() || `Google${sub.slice(-4)}`;

  return clearTemp(await finishLogin(req, { id, name }, { logTag: 'google' }));
}
