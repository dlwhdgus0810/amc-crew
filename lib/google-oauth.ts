import { REGIONS, type Region } from './region';
import type { Provider } from './provider';

/**
 * 구글 로그인 — 서버 전용.
 *
 * 환경변수: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (Google Cloud Console의 OAuth 클라이언트).
 * 어느 지역이 구글 문을 여는지는 lib/region.ts의 loginProviders가 정하고, 여기서는
 * 「설정에 있고 키도 있는가」까지 본다 — 키를 안 넣은 배포에 죽은 단추가 뜨면 안 된다.
 *
 * SDK 없이 OAuth 2.0을 직접 부른다 (카카오와 같은 방식). 리프레시 토큰은 안 받는다 —
 * 로그인 순간 프로필만 읽고 우리 세션을 따로 발급하므로 남의 자격증명을 들고 있을 이유가 없다.
 */
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
/** 셋 다 민감하지 않은 범위라 동의 화면을 공개하는 데 구글 심사가 없다 */
export const GOOGLE_SCOPE = 'openid email profile';

/** 콘솔에 등록한 주소와 글자까지 같아야 한다 — 요청이 들어온 호스트로 만든다 (카카오와 같다) */
export function googleRedirectUri(origin: string): string {
  return `${origin}/api/auth/google/callback`;
}

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** 이 지역이 구글 문을 열었고 키도 있는가 */
export function googleLoginEnabled(region: Region): boolean {
  return REGIONS[region].loginProviders.includes('google') && googleConfigured();
}

/** 화면에 그릴 로그인 단추 — 설정 목록에서 키 없는 것을 뺀다 (카카오는 늘 있다) */
export function enabledLoginProviders(region: Region): Provider[] {
  return REGIONS[region].loginProviders.filter((p) => p !== 'google' || googleConfigured());
}
