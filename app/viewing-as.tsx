'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { useViewer } from './session';

const T = {
  viewing: { ko: '지금 {name} 계정으로 보는 중', en: 'Viewing as {name}', es: 'Viendo como {name}' },
  back: { ko: '관리자로 돌아가기', en: 'Back to admin', es: 'Volver a admin' },
};

/**
 * 관리자가 테스트 계정으로 보는 동안 화면 맨 위에 띄우는 띠.
 * 지금 누구로 보고 있는지 늘 보이지 않으면, 관리자 화면이 사라진 걸 고장으로 오해한다.
 */
export default function ViewingAs() {
  /*
   * 누구로 보는 중인지는 레이아웃이 서버에서 읽어 둔 값을 쓴다.
   * 대리 보기를 켜고 끄는 두 곳(app/admin/page.tsx, 아래 back())이 모두
   * window.location.href — 하드 내비게이션이라 이 값이 낡을 일이 없다.
   */
  const viewer = useViewer();
  const name = viewer.viewingAs ? (viewer.user?.name ?? '') : null;
  const [busy, setBusy] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const t = useT();

  /* 띠는 상단 바 위에 얹히므로, 그만큼 상단 바를 아래로 밀어야 가려지지 않는다.
     글자가 길어져 두 줄이 되는 경우까지 맞추려면 실제 높이를 재서 넘겨야 한다. */
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--viewing-as-h', `${el.offsetHeight}px`);
    set();
    window.addEventListener('resize', set);
    return () => {
      window.removeEventListener('resize', set);
      document.documentElement.style.removeProperty('--viewing-as-h');
    };
  }, [name]);

  if (name === null) return null;

  async function back() {
    setBusy(true);
    await fetch('/api/admin/impersonate', { method: 'DELETE' });
    window.location.href = '/admin';
  }

  return (
    <div className="viewing-as" ref={bar}>
      <span>{t(T.viewing, { name })}</span>
      <button className="link-btn strong" disabled={busy} onClick={back}>
        {t(T.back)}
      </button>
    </div>
  );
}
