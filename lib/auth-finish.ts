import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, LOGIN_NEXT_COOKIE, safeNextPath, SESSION_COOKIE, SESSION_MAX_AGE } from './auth';
import { updateProfile } from './store';
import { dbGetUser } from './db/users';
import { notifyAdminsNewUser } from './db/signup';
import { isLocale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from './i18n';
import { siteUrl } from './site';
import { regionOfRequest } from './region-server';

/**
 * 어느 문으로 들어왔든 그다음은 같다 — 카카오·구글 콜백이 신원(id, 이름)을 확인한 뒤
 * 여기로 온다. 예전 카카오 콜백의 꼬리를 그대로 옮긴 것이라, 두 문이 어긋날 수 없다.
 *
 *  1. 프로필 upsert (이름·마지막 로그인 지역) — 실패해도 로그인은 진행
 *  2. 첫 로그인이면 관리자에게 알림
 *  3. 세션 쿠키 + 저장해 둔 언어 쿠키
 *  4. 로그인 전에 있던 자리(login_next)로 리다이렉트
 *
 * 임시 쿠키(state·pkce·login_next)는 부르는 쪽이 지운다 — 이름이 문마다 다르다.
 */
export async function finishLogin(
  req: NextRequest,
  user: { id: string; name: string },
  opts: { logTag: 'kakao' | 'google' }
): Promise<NextResponse> {
  const { id, name } = user;
  const { origin } = req.nextUrl;
  const next = safeNextPath(req.cookies.get(LOGIN_NEXT_COOKIE)?.value);

  /*
   * 제공자 닉네임만 프로필에 기록한다. 실패해도 로그인은 진행한다.
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
    console.error(`[${opts.logTag}] profile upsert failed:`, e);
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
  return res;
}
