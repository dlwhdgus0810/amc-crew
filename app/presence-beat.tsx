'use client';

import { useEffect } from 'react';

/** 신호 주기 — 관리자 화면의 판정 창(3분)보다 충분히 짧게 */
const BEAT_MS = 60_000;

/**
 * "지금 보고 있어요" 신호.
 *
 * 서버리스라 연결을 붙들 수 없어서, 앱이 화면에 떠 있는 동안만 주기적으로 알린다.
 * 탭이 숨으면 멈춘다 — 브라우저가 백그라운드 타이머를 크게 늦추기도 하고, 무엇보다
 * 안 보고 있는 사람을 접속 중으로 세면 화면이 거짓말이 된다.
 *
 * 비로그인이면 첫 응답(401)을 보고 아예 그만둔다.
 */
export default function PresenceBeat() {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    const beat = async () => {
      if (stopped || document.visibilityState !== 'visible') return;
      try {
        const res = await fetch('/api/presence', { method: 'POST' });
        // 로그인하지 않은 사람에게 60초마다 요청을 보낼 이유가 없다
        if (res.status === 401) stop();
      } catch {
        // 네트워크가 끊긴 것뿐이라 다음 차례에 다시 시도한다
      }
    };

    const stop = () => {
      stopped = true;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };

    // 탭으로 돌아오면 바로 한 번 — 다음 주기까지 기다리면 잠깐 오프라인으로 보인다
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };

    beat();
    timer = setInterval(beat, BEAT_MS);
    document.addEventListener('visibilitychange', onVisible);
    return stop;
  }, []);

  return null;
}
