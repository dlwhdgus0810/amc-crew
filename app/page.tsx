'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES } from '@/lib/categories';

interface SessionUser {
  id: string;
  name: string;
}

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.78c.51.06 1.03.1 1.56.1 5.52 0 10-3.54 10-7.88C22 6.54 17.52 3 12 3z"
      />
    </svg>
  );
}

export default function HubPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const carRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('login_error');
    if (err) {
      setMsg({ type: 'err', text: err });
      window.history.replaceState(null, '', '/');
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
    ])
      .then(([auth, sub]) => {
        setUser(auth.user ?? null);
        setSubs(new Set(sub.subscriptions ?? []));
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleSub(category: string) {
    if (!user) {
      setMsg({ type: 'err', text: '카카오 로그인 후 구독할 수 있어요.' });
      return;
    }
    const next = !subs.has(category);
    setSubs((prev) => {
      const s = new Set(prev);
      if (next) s.add(category);
      else s.delete(category);
      return s;
    });
    const res = await fetch('/api/subscriptions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, subscribed: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setSubs(new Set(data.subscriptions ?? []));
    }
  }

  function scroll(dir: number) {
    carRef.current?.scrollBy({ left: dir * 580, behavior: 'smooth' });
  }

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  return (
    <>
      <div className="statement">
        취미로 모이는 크루.
        <br />
        <span className="dim2">오늘 뭐 하고 놀지, 같이 정합니다.</span>
      </div>
      {/* 카테고리를 추가하거나 순서를 바꿔도 따라오도록 목록에서 만든다 */}
      <div className="statement-meta">{CATEGORIES.map((c) => c.en).join(' — ')}</div>

      <div className="home-login">
        {user ? (
          <>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{user.name}</span>
            <Link href="/profile" className="profile-link">
              프로필 →
            </Link>
          </>
        ) : (
          <a className="kakao-btn" href="/api/auth/login">
            <KakaoIcon />
            카카오 로그인
          </a>
        )}
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div className="car" ref={carRef}>
        {CATEGORIES.map((c, i) => (
          <Link
            key={c.slug}
            href={c.kind === 'movie' ? '/movie' : `/c/${c.slug}`}
            className="car-card"
            style={{ background: c.color, color: c.fg }}
          >
            <div className="car-top">
              <span className="car-idx">
                0{i + 1} / {c.en}
              </span>
              {c.kind === 'posts' && user && (
                <button
                  className={`sub-toggle ${subs.has(c.slug) ? 'on' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleSub(c.slug);
                  }}
                >
                  {subs.has(c.slug) ? '구독중' : '구독'}
                </button>
              )}
            </div>
            <div>
              <div className="car-name">{c.name}</div>
              <div className="car-desc">{c.description}</div>
            </div>
          </Link>
        ))}
      </div>
      <div className="car-arrows">
        <Link href="/suggest" className="profile-link" style={{ marginRight: 'auto', alignSelf: 'center' }}>
          하고 싶은 취미가 없나요? 카테고리 제안하기 →
        </Link>
        <button onClick={() => scroll(-1)} aria-label="이전">
          ←
        </button>
        <button onClick={() => scroll(1)} aria-label="다음">
          →
        </button>
      </div>
    </>
  );
}
