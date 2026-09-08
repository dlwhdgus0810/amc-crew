import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  LOGIN_NEXT_COOKIE,
  safeNextPath,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  STATE_COOKIE,
} from '@/lib/auth';
import { updateProfile } from '@/lib/store';
import { dbGetUser } from '@/lib/db/users';
import { notifyAdminsNewUser } from '@/lib/db/signup';
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, Msg, pick, toLocale } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';
import { regionOfRequest } from '@/lib/region-server';

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
  const next = safeNextPath(req.cookies.get(LOGIN_NEXT_COOKIE)?.value);
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

  /*
   * 카카오 닉네임만 프로필에 기록한다. 실패해도 로그인은 진행한다.
   *
   * 예전에는 액세스·리프레시 토큰도 보관했다 — 카톡으로 알림을 보내려고. 그 기능이
   * 없어졌으므로 토큰을 받아 둘 이유도 없다(쓰지 않는 남의 자격증명을 들고 있을 이유는 더 없다).
   */
  // 어느 도메인으로 들어왔나 — 이 사람의 동네(home_region)로 적어 둔다 (마지막 로그인 지역)
  const region = regionOfRequest(req);
  let savedLocale: string | null = null;
  let isNewUser = false;
  try {
    isNewUser = !(await dbGetUser(id)); // upsert 전에 봐야 첫 로그인인지 알 수 있다
    await updateProfile(id, { kakaoName: name, homeRegion: region });
    savedLocale = (await dbGetUser(id))?.locale ?? null; // 다른 기기에서도 저장한 언어로 열리도록
  } catch (e) {
    console.error('[kakao] profile upsert failed:', e);
  }

  // 알림에 담기는 링크는 접속한 호스트가 아니라 공개 주소로 만든다.
  // (origin은 redirect_uri·리다이렉트 전용 — 로컬에서 로그인하면 localhost가 그대로 박혀 나갔다)
  const publicOrigin = siteUrl(region, origin);

  // 가입(첫 로그인)은 관리자에게 알린다 — 실패해도 로그인은 진행
  if (isNewUser) await notifyAdminsNewUser({ userId: id, name, origin: publicOrigin, region });

  const res = NextResponse.redirect(new URL(next, origin));
  res.cookies.set(SESSION_COOKIE, createSessionToken({ id, name }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  });
  if (isLocale(savedLocale)) {
    res.cookies.set(LOCALE_COOKIE, savedLocale, {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      path: '/',
    });
  }
  return clearTemp(res);
}
