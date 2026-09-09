'use client';

import { useEffect, useState } from 'react';
import type { Msg } from '@/lib/i18n';
import { useT } from './i18n';
import { useLoginProviders } from './region-context';

/**
 * 로그인 단추 — 이 도메인이 여는 문만큼 그린다 (lib/region.ts의 loginProviders).
 *
 * 캔자스는 카카오 하나라 **예전 그대로의 카카오 anchor 하나**를 감싸는 것 없이 낸다 —
 * 캔자스 화면은 한 글자도 안 바뀌어야 한다. 펜은 카카오·구글 둘을 한 줄에 놓는다.
 *
 * 카톡 인앱 브라우저에서는 구글 단추를 뺀다. 구글이 웹뷰 안의 로그인을 막아서
 * (disallowed_useragent) 눌러 봐야 구글 오류 화면이다. 「브라우저에서 열어주세요」 안내는
 * app/install-prompt.tsx가 이미 띄운다. useEffect로 판정하므로 서버가 그린 첫 화면과 같고,
 * 카톡 안에서만 잠깐 보였다 사라진다 — 그 정도는 감수한다.
 */

const DEFAULT_KAKAO: Msg = { ko: '카카오 로그인', en: 'Log in with Kakao', es: 'Entrar con Kakao' };
const DEFAULT_GOOGLE: Msg = { ko: 'Google로 로그인', en: 'Sign in with Google', es: 'Iniciar sesión con Google' };

export function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.78c.51.06 1.03.1 1.56.1 5.52 0 10-3.54 10-7.88C22 6.54 17.52 3 12 3z"
      />
    </svg>
  );
}

/** 구글의 네 색 G — 지침대로 원본 그림 그대로, 색을 바꾸지 않는다 */
export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * 로그인 문이 둘 이상인 도메인에서 「카카오 로그인 후 …」 같은 문구를 중립 문구로 바꾼다.
 * 캔자스처럼 하나뿐이면 예전 문구 그대로다 — 화면이 안 바뀐다.
 */
export function useLoginMsg(): (kakaoOnly: Msg, neutral: Msg) => Msg {
  const many = useLoginProviders().length > 1;
  return (kakaoOnly, neutral) => (many ? neutral : kakaoOnly);
}

export default function LoginButtons({
  /** 로그인 뒤 돌아갈 자리 — `?next=` 뒤에 그대로 붙인다 (인코딩은 부르는 쪽이) */
  next,
  kakaoLabel = DEFAULT_KAKAO,
  googleLabel = DEFAULT_GOOGLE,
}: {
  next?: string;
  kakaoLabel?: Msg;
  googleLabel?: Msg;
}) {
  const t = useT();
  const providers = useLoginProviders();
  const [inKakao, setInKakao] = useState(false);
  useEffect(() => {
    setInKakao(/KAKAOTALK/i.test(navigator.userAgent));
  }, []);

  const q = next ? `?next=${next}` : '';
  const kakao = (
    <a className="kakao-btn" href={`/api/auth/login${q}`}>
      <KakaoIcon />
      {t(kakaoLabel)}
    </a>
  );
  const showGoogle = providers.includes('google') && !inKakao;
  if (!showGoogle) return kakao;

  return (
    <span className="login-btns">
      {kakao}
      <a className="google-btn" href={`/api/auth/google/login${q}`}>
        <GoogleIcon />
        {t(googleLabel)}
      </a>
    </span>
  );
}
