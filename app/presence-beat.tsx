'use client';

import { useEffect } from 'react';

/**
 * 신호 주기 — 판정 창(ONLINE_WINDOW_MINUTES, 5분)보다 충분히 짧게.
 *
 * 60초였다. 신호 한 번에 DB 쓰기가 두 번 들어가는데(users.last_seen, presence_sessions),
 * 탭을 켜 둔 사람이 여럿이면 그것만으로 DB가 절전에 들 틈이 없다. Neon은 깨어 있는
 * 시간으로 값을 매기므로 그게 그대로 요금이 된다 — 실제로 컴퓨트 할당량을 다 써서
 * 사이트가 멎었다.
 *
 * 3분이면 쓰기가 3분의 1로 준다. 대신 접속 표시가 최대 3분 늦는데, 「지금 보고 있나」를
 * 분 단위로 맞출 이유는 없다.
 */
const BEAT_MS = 180_000;

/**
 * "지금 보고 있어요" 신호.
 *
 * 서버리스라 연결을 붙들 수 없어서, 앱이 화면에 떠 있는 동안만 주기적으로 알린다.
 * 탭이 숨으면 멈춘다 — 브라우저가 백그라운드 타이머를 크게 늦추기도 하고, 무엇보다
 * 안 보고 있는 사람을 접속 중으로 세면 화면이 거짓말이 된다.
 *
 * 비로그인(401)이나 이용 정지(403)면 첫 응답을 보고 아예 그만둔다.
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
        // 401 비로그인 · 403 이용 정지 — 어느 쪽이든 계속 두드릴 이유가 없다
        if (res.status === 401 || res.status === 403) stop();
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
