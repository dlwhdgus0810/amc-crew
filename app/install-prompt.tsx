'use client';

import { useEffect, useState } from 'react';
import { useT } from './i18n';

const T = {
  // 카톡 인앱 브라우저 — 로그인·홈 화면 추가가 안 되므로 밖으로 빼내야 한다
  kakaoTitle: { ko: '브라우저에서 열어주세요', en: 'Open in your browser' },
  kakaoIos: {
    ko: '카카오톡 안에서는 홈 화면에 추가할 수 없어요. 오른쪽 아래 ⋯ 를 누르고 "다른 브라우저로 열기"를 선택해주세요.',
    en: 'You can’t add this to your home screen inside KakaoTalk. Tap ⋯ at the bottom right and choose “Open in other browser”.',
  },
  kakaoAndroid: {
    ko: '카카오톡 안에서는 홈 화면에 추가할 수 없어요. 크롬으로 열면 앱처럼 쓸 수 있어요.',
    en: 'You can’t add this to your home screen inside KakaoTalk. Open it in Chrome to use it like an app.',
  },
  openChrome: { ko: '크롬으로 열기', en: 'Open in Chrome' },
  copyLink: { ko: '링크 복사', en: 'Copy link' },
  copied: { ko: '복사했어요. 브라우저에 붙여넣어 주세요.', en: 'Copied — paste it into your browser.' },

  // 설치 안내
  installTitle: { ko: '홈 화면에 추가하기', en: 'Add to your home screen' },
  installAndroid: {
    ko: '앱처럼 전체화면으로 열리고, 다음부터 바로 들어올 수 있어요.',
    en: 'It opens full screen like an app, and you can jump back in anytime.',
  },
  installIos: {
    ko: '아래 공유 버튼을 누르고 "홈 화면에 추가"를 선택하면 앱처럼 쓸 수 있어요.',
    en: 'Tap the share button below, then choose “Add to Home Screen” to use it like an app.',
  },
  install: { ko: '설치하기', en: 'Install' },
  dismiss: { ko: '닫기', en: 'Dismiss' },
};

const DISMISS_KEY = 'kk-install-hint-dismissed';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Mode = 'kakao-ios' | 'kakao-android' | 'install-android' | 'install-ios' | null;

export default function InstallPrompt() {
  const t = useT();
  const [mode, setMode] = useState<Mode>(null);
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;

    const ua = navigator.userAgent;
    const inKakao = /KAKAOTALK/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isAndroid = /Android/i.test(ua);
    // 이미 홈 화면에서 실행 중이면 아무것도 띄우지 않는다
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return;

    if (inKakao) {
      setMode(isAndroid ? 'kakao-android' : 'kakao-ios');
      return;
    }
    // iOS Safari에는 설치 API가 없어 안내만 띄운다
    if (isIOS) setMode('install-ios');

    // 안드로이드 크롬은 설치 가능해지면 이 이벤트로 알려준다 (서비스 워커가 있어야 발생)
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
      setMode('install-android');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  function close() {
    localStorage.setItem(DISMISS_KEY, '1');
    setMode(null);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    close();
  }

  /** 안드로이드 카톡에서는 intent 스킴으로 크롬을 띄울 수 있다 (iOS에는 대응 수단이 없다) */
  function openInChrome() {
    const { host, pathname, search } = window.location;
    window.location.href = `intent://${host}${pathname}${search}#Intent;scheme=https;package=com.android.chrome;end`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setNote(t(T.copied));
    } catch {
      /* 클립보드 권한이 없으면 조용히 넘어간다 */
    }
  }

  if (!mode) return null;

  const isKakao = mode === 'kakao-ios' || mode === 'kakao-android';
  const title = isKakao ? t(T.kakaoTitle) : t(T.installTitle);
  const body = {
    'kakao-ios': t(T.kakaoIos),
    'kakao-android': t(T.kakaoAndroid),
    'install-android': t(T.installAndroid),
    'install-ios': t(T.installIos),
  }[mode];

  return (
    <div className="install-hint">
      <div className="install-body">
        <strong>{title}</strong>
        <span>{note ?? body}</span>
      </div>
      <div className="install-actions">
        {mode === 'kakao-android' && (
          <button className="secondary" onClick={openInChrome}>{t(T.openChrome)}</button>
        )}
        {isKakao && <button className="secondary" onClick={copyLink}>{t(T.copyLink)}</button>}
        {mode === 'install-android' && (
          <button className="secondary" onClick={install}>{t(T.install)}</button>
        )}
        <button className="secondary dim" onClick={close}>{t(T.dismiss)}</button>
      </div>
    </div>
  );
}
