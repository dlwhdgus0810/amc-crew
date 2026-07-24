'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

  // 앱 닉네임 편집
  const [nickname, setNickname] = useState<string | null>(null);
  const [kakaoName, setKakaoName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);

  // 카카오 로그인 실패 시 콜백에서 넘어온 에러 표시
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
        setNickname(auth.nickname ?? null);
        setKakaoName(auth.kakaoName ?? '');
        setSubs(new Set(sub.subscriptions ?? []));
      })
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setSubs(new Set());
    setMsg(null);
  }

  async function saveNickname() {
    setSavingName(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nameInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '닉네임 저장 실패');
      setUser((u) => (u ? { ...u, name: data.name } : u));
      setNickname(data.nickname ?? null);
      setKakaoName(data.kakaoName ?? '');
      setEditingName(false);
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '닉네임 저장 실패' });
    } finally {
      setSavingName(false);
    }
  }

  async function toggleSub(category: string) {
    if (!user) {
      setMsg({ type: 'err', text: '카카오 로그인 후 구독할 수 있어요.' });
      return;
    }
    const next = !subs.has(category);
    // 낙관적 업데이트
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

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  return (
    <>
      <h1>오늘 뭐 하고 놀까?</h1>
      <p className="subtitle">
        취미를 골라 모임을 만들거나 참가하세요. 구독한 취미에 새 모임이 올라오면 알림을 받아요.
      </p>

      <div className="card">
        {user ? (
          editingName ? (
            <div>
              <div className="field-row">
                <input
                  type="text"
                  placeholder="닉네임"
                  value={nameInput}
                  maxLength={20}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !savingName && saveNickname()}
                  autoFocus
                />
                <button className="secondary" disabled={savingName} onClick={saveNickname}>
                  {savingName ? '저장 중…' : '저장'}
                </button>
                <button
                  className="secondary"
                  style={{ background: 'var(--surface-2)' }}
                  disabled={savingName}
                  onClick={() => setEditingName(false)}
                >
                  취소
                </button>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 600, margin: '10px 2px 0' }}>
                비워두고 저장하면 카카오 닉네임({kakaoName})을 사용해요.
              </p>
            </div>
          ) : (
            <div className="field-row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700 }}>
                👋 {user.name}님
                <button
                  className="secondary"
                  style={{ padding: '4px 12px', fontSize: 12.5, marginLeft: 8, verticalAlign: 'middle' }}
                  onClick={() => {
                    setNameInput(nickname ?? '');
                    setEditingName(true);
                  }}
                >
                  ✏️ 닉네임
                </button>
              </span>
              <button className="secondary" onClick={logout}>로그아웃</button>
            </div>
          )
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 600 }}>
              카카오 로그인하고 모임에 참가해보세요.
            </span>
            <a className="kakao-btn" href="/api/auth/login">
              <KakaoIcon />
              카카오 로그인
            </a>
          </div>
        )}
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div className="hub-grid">
        {CATEGORIES.map((c) => (
          <Link key={c.slug} href={c.kind === 'movie' ? '/movie' : `/c/${c.slug}`} className="hub-card">
            <span className="hub-emoji">{c.emoji}</span>
            <span className="hub-name">{c.name}</span>
            <span className="hub-desc">{c.description}</span>
            {c.kind === 'posts' && user && (
              <button
                className={`sub-toggle ${subs.has(c.slug) ? 'on' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleSub(c.slug);
                }}
              >
                {subs.has(c.slug) ? '🔔 구독중' : '🔕 구독'}
              </button>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
