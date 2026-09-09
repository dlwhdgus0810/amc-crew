'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** 이만큼 넘게 숨어 있었으면 돌아올 때 새로 읽는다 — 앱 스위처 잠깐 다녀온 것까지 매번 서버를 부르지 않게 */
const STALE_MS = 30_000;

/**
 * 설치한 앱을 다시 앞으로 가져오면 화면을 새로 받는다.
 *
 * 앱은 닫히지 않고 뒤로 물러났다 돌아온다. 그동안 남이 모임에 참가해도 어제 열어 둔 홈이
 * 그대로 있었다 — 아무도 서버를 다시 부르지 않았다. router.refresh()는 서버 컴포넌트만 다시
 * 받고 스크롤·입력 상태는 지킨다.
 *
 * visibilitychange(탭·앱 전환)와 pageshow(iOS가 bfcache에서 되살릴 때) 둘 다 본다.
 */
export default function RefreshOnResume() {
  const router = useRouter();
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (hiddenAt && Date.now() - hiddenAt > STALE_MS) {
        hiddenAt = 0;
        router.refresh();
      }
    };
    // bfcache에서 되살아난 문서는 마지막 그 순간 그대로다 — 얼마나 됐는지 모르니 그냥 새로 읽는다
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) router.refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [router]);
  return null;
}
