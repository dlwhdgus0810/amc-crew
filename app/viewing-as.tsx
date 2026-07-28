'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';

const T = {
  viewing: { ko: '지금 {name} 계정으로 보는 중', en: 'Viewing as {name}' },
  back: { ko: '관리자로 돌아가기', en: 'Back to admin' },
};

/**
 * 관리자가 테스트 계정으로 보는 동안 화면 맨 위에 띄우는 띠.
 * 지금 누구로 보고 있는지 늘 보이지 않으면, 관리자 화면이 사라진 걸 고장으로 오해한다.
 */
export default function ViewingAs() {
  const pathname = usePathname();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const bar = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => setName(auth.viewingAs ? (auth.user?.name ?? '') : null))
      .catch(() => {});
  }, [pathname]);

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
