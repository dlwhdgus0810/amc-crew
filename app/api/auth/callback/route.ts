import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  LOGIN_NEXT_COOKIE,
  LOGIN_PURPOSE_COOKIE,
  safeNextPath,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  STATE_COOKIE,
  TALK_MESSAGE_PURPOSE,
} from '@/lib/auth';
import { updateProfile } from '@/lib/store';
import { recordTalkMessageConsent, saveKakaoTokens, sendKakaoMemos, TalkMessageStatus } from '@/lib/kakao';
import { dbGetUser } from '@/lib/db/users';
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, Msg, pick, toLocale } from '@/lib/i18n';

const T = {
  talkOn: {
    ko: '카카오톡 알림을 켰어요. 구독한 취미에 새 모임이 올라오면 여기로 알려드릴게요.',
    en: 'KakaoTalk alerts are on. We’ll message you here when a new meetup is posted in the hobbies you follow.',
  },
  openApp: { ko: '앱 열기', en: 'Open the app' },
  expired: { ko: '로그인 요청이 만료됐어요. 다시 시도해주세요.', en: 'The login request expired. Please try again.' },
  tokenFailed: { ko: '카카오 토큰 발급에 실패했어요.', en: 'Kakao token exchange failed.' },
  profileFailed: { ko: '카카오 프로필 조회에 실패했어요.', en: 'Couldn’t load your Kakao profile.' },
};

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { origin, searchParams } = req.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const savedState = req.cookies.get(STATE_COOKIE)?.value;
  const next = safeNextPath(req.cookies.get(LOGIN_NEXT_COOKIE)?.value);
  // 프로필의 "카톡 알림 켜기"로 시작된 재동의 흐름인지
  const isConsentFlow = req.cookies.get(LOGIN_PURPOSE_COOKIE)?.value === TALK_MESSAGE_PURPOSE;

  const clearTemp = (res: NextResponse) => {
    res.cookies.delete(STATE_COOKIE);
    res.cookies.delete(LOGIN_NEXT_COOKIE);
    res.cookies.delete(LOGIN_PURPOSE_COOKIE);
    return res;
  };

  // 로그인 실패 안내도 저장된 언어(쿠키)로
  const locale = toLocale(req.cookies.get(LOCALE_COOKIE)?.value);
  const fail = (reason: Msg) =>
    clearTemp(NextResponse.redirect(`${origin}/?login_error=${encodeURIComponent(pick(locale, reason))}`));

  /** 재동의 흐름은 홈으로 튕기지 않고 원래 페이지로 결과 플래그와 함께 복귀 */
  const backWithStatus = (status: TalkMessageStatus | 'denied') => {
    const url = new URL(next, origin);
    url.searchParams.set('kakao_talk', status);
    return clearTemp(NextResponse.redirect(url));
  };

  if (!code || !state || !savedState || state !== savedState) {
    // 카카오 동의 화면에서 취소 (error=access_denied) — 이미 로그인 상태이므로 세션은 그대로 둔다
    if (isConsentFlow && searchParams.get('error')) return backWithStatus('denied');
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

  // 카카오 닉네임을 프로필에 기록하고 토큰을 보관 (카톡 알림용). 실패해도 로그인은 진행.
  let consentStatus: TalkMessageStatus = 'unknown';
  let savedLocale: string | null = null;
  try {
    await updateProfile(id, { kakaoName: name });
    await saveKakaoTokens(id, token);
    savedLocale = (await dbGetUser(id))?.locale ?? null; // 다른 기기에서도 저장한 언어로 열리도록
    // 매 로그인마다 실제 동의 상태를 확정한다 — 예전 사용자의 미확인(null) 상태와
    // 카카오 설정에서 사후 철회한 경우가 여기서 자동으로 정정된다.
    consentStatus = await recordTalkMessageConsent(id, token.access_token);
  } catch (e) {
    console.error('[kakao] profile/token upsert failed:', e);
  }

  // 재동의로 켜진 경우에만 확인 메모 1건 (평범한 재로그인에는 보내지 않는다)
  if (isConsentFlow && consentStatus === 'on') {
    const memoLocale = toLocale(savedLocale ?? locale);
    await sendKakaoMemos([id], pick(memoLocale, T.talkOn), `${origin}/`, pick(memoLocale, T.openApp));
  }

  const redirectUrl = new URL(next, origin);
  if (isConsentFlow) redirectUrl.searchParams.set('kakao_talk', consentStatus);
  const res = NextResponse.redirect(redirectUrl);
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
