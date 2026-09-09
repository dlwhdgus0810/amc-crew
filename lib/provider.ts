/**
 * 어느 문으로 들어온 계정인가 — 카카오 또는 구글.
 *
 * 스키마에 칸을 두지 않고 **회원번호 앞말**로 안다. 카카오는 회원번호(숫자 문자열)
 * 그대로, 구글은 `google:<sub>`. 테스트 계정(`test-*`)은 카카오로 친다.
 *
 * import가 하나도 없는 이유: lib/region.ts(서버+브라우저)와 로그인 단추(클라이언트)가
 * 같이 읽는다. `anon:`은 lib/db/posts.ts가 익명 명단의 자리 번호로 쓰는 앞말이라
 * 실제 회원번호는 그걸로 시작하면 안 된다.
 */
export type Provider = 'kakao' | 'google';

export const GOOGLE_ID_PREFIX = 'google:';

export function providerOf(id: string): Provider {
  return id.startsWith(GOOGLE_ID_PREFIX) ? 'google' : 'kakao';
}
