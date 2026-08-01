'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from './i18n';

/**
 * 이용 정지 안내 — 화면 전체를 덮고 남은 시간을 센다.
 *
 * 이건 보여주기다. 실제로 막는 건 서버(lib/guard.ts)이고, 이 화면을 개발자 도구로
 * 지워도 아무것도 할 수 없다. 둘 다 필요한 이유가 서로 다르다 —
 * 서버만 있으면 왜 안 되는지 알 수 없고, 화면만 있으면 막은 게 아니다.
 *
 * 남은 시간은 종료 시각에서 매번 다시 계산한다. 1초씩 빼는 방식은 화면이 잠들었다
 * 돌아오면 그만큼 뒤처져서, 실제로는 풀렸는데 타이머만 남는다.
 */

const T = {
  title: { ko: '지금은 앱을 쓸 수 없어요', en: 'The app is closed to you right now' },
  desc: {
    ko: '관리자가 이용을 잠시 멈춰 뒀어요. 아래 시간이 지나면 저절로 풀려요.',
    en: 'An admin paused your access. It lifts on its own when the timer runs out.',
  },
  reason: { ko: '사유', en: 'Reason' },
  left: { ko: '남은 시간', en: 'Time left' },
  over: { ko: '정지가 풀렸어요!', en: 'You’re back in' },
  refresh: { ko: '다시 시작하기', en: 'Continue' },
  logout: { ko: '로그아웃', en: 'Log out' },
  days: { ko: '{n}일 ', en: '{n}d ' },
};

interface Ban {
  until: string;
  secondsLeft: number;
  reason: string | null;
}

/** 정지가 걸리거나 풀린 걸 알아채는 주기 — 열어 둔 화면도 곧 따라온다 */
const POLL_MS = 60_000;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export default function BanGate() {
  const [ban, setBan] = useState<Ban | null>(null);
  const [left, setLeft] = useState(0);
  const t = useT();

  const load = useCallback(async () => {
    try {
      const me = await fetch('/api/auth/me', { cache: 'no-store' }).then((r) => r.json());
      setBan(me?.ban ?? null);
    } catch {
      // 통신이 안 되면 그냥 두던 대로 둔다 — 못 불러왔다고 막을 이유는 없다
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // 남은 시간은 종료 시각 기준으로 다시 잰다 (화면이 잠들었다 와도 어긋나지 않게)
  useEffect(() => {
    if (!ban) return;
    const end = new Date(ban.until).getTime();
    const tick = () => setLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [ban]);

  // 화면을 덮는 동안은 뒤가 스크롤되지 않게 잠근다
  useEffect(() => {
    if (!ban) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [ban]);

  if (!ban) return null;

  const days = Math.floor(left / 86400);
  const clock = `${pad(Math.floor((left % 86400) / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/';
  }

  return (
    <div className="ban-back" role="alertdialog" aria-modal="true" aria-label={t(T.title)}>
      <div className="ban-card">
        <div className="ban-emoji" aria-hidden="true">
          ⏳
        </div>
        <h1 className="ban-title">{left > 0 ? t(T.title) : t(T.over)}</h1>

        {left > 0 ? (
          <>
            <p className="ban-desc">{t(T.desc)}</p>
            <div className="ban-left-label">{t(T.left)}</div>
            <div className="ban-clock">
              {days > 0 && <span className="ban-days">{t(T.days, { n: days })}</span>}
              {clock}
            </div>
            {ban.reason && (
              <div className="ban-reason">
                <strong>{t(T.reason)}</strong>
                <span>{ban.reason}</span>
              </div>
            )}
          </>
        ) : (
          // 시간이 다 됐다 — 새로 받아오면 이 화면이 사라진다
          <button className="big-cta" onClick={() => window.location.reload()}>
            {t(T.refresh)}
          </button>
        )}

        <button className="link-btn ban-out" onClick={logout}>
          {t(T.logout)}
        </button>
      </div>
    </div>
  );
}
