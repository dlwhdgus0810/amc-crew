'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES } from '@/lib/categories';

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

const GENDER_LABEL: Record<string, string> = { male: '남성', female: '여성' };

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [kakaoName, setKakaoName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editingInfo, setEditingInfo] = useState(false);
  const [bInput, setBInput] = useState('');
  const [gInput, setGInput] = useState<'male' | 'female' | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
    ])
      .then(([auth, sub]) => {
        setUser(auth.user ?? null);
        setNickname(auth.nickname ?? null);
        setKakaoName(auth.kakaoName ?? '');
        setBirthday(auth.birthday ?? '');
        setGender(auth.gender ?? '');
        setSubs(new Set(sub.subscriptions ?? []));
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveProfile(body: Record<string, unknown>, okText: string) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '저장 실패');
      setUser((u) => (u ? { ...u, name: data.name } : u));
      setNickname(data.nickname ?? null);
      setKakaoName(data.kakaoName ?? '');
      setBirthday(data.birthday ?? '');
      setGender(data.gender ?? '');
      setEditingName(false);
      setEditingInfo(false);
      setMsg({ type: 'ok', text: okText });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '저장 실패' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleSub(category: string) {
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

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  if (!user) {
    return (
      <>
        <h1>프로필</h1>
        <div className="card">
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 500 }}>
              카카오 로그인 후 프로필을 관리할 수 있어요.
            </span>
            <a className="kakao-btn" href="/api/auth/login">
              <KakaoIcon />
              카카오 로그인
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>프로필</h1>
      <p className="subtitle">닉네임, 기본 정보, 구독을 관리해요.</p>

      <h2>닉네임</h2>
      <div className="card">
        {editingName ? (
          <div>
            <div className="field-row">
              <input
                type="text"
                placeholder="닉네임"
                value={nameInput}
                maxLength={20}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !saving && saveProfile({ nickname: nameInput }, '닉네임을 저장했어요.')}
                autoFocus
              />
              <button className="secondary" disabled={saving} onClick={() => saveProfile({ nickname: nameInput }, '닉네임을 저장했어요.')}>
                {saving ? '저장 중…' : '저장'}
              </button>
              <button className="secondary" disabled={saving} onClick={() => setEditingName(false)}>
                취소
              </button>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, margin: '10px 2px 0' }}>
              비워두고 저장하면 카카오 닉네임({kakaoName})을 사용해요.
            </p>
          </div>
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 17 }}>
              {user.name}
              <span style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, marginLeft: 10 }}>
                카카오: {kakaoName}
              </span>
            </span>
            <button
              className="secondary"
              onClick={() => {
                setNameInput(nickname ?? '');
                setEditingName(true);
              }}
            >
              수정
            </button>
          </div>
        )}
      </div>

      <h2>기본 정보</h2>
      <div className="card">
        {editingInfo ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div className="field-label">생년월일</div>
              <input
                type="date"
                value={bInput}
                min="1900-01-01"
                onChange={(e) => setBInput(e.target.value)}
                style={{ maxWidth: 220 }}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <div className="field-label">성별</div>
              <div className="seg-group">
                <button className={`seg ${gInput === 'male' ? 'on' : ''}`} onClick={() => setGInput('male')}>
                  남성
                </button>
                <button className={`seg ${gInput === 'female' ? 'on' : ''}`} onClick={() => setGInput('female')}>
                  여성
                </button>
              </div>
            </div>
            <div className="field-row">
              <button
                className="secondary"
                disabled={saving || !bInput || !gInput}
                onClick={() => saveProfile({ birthday: bInput, gender: gInput }, '기본 정보를 저장했어요.')}
              >
                {saving ? '저장 중…' : '저장'}
              </button>
              <button className="secondary" disabled={saving} onClick={() => setEditingInfo(false)}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500 }}>
              {birthday || '미입력'}
              <span style={{ marginLeft: 16, color: 'var(--text-dim)' }}>{GENDER_LABEL[gender] ?? ''}</span>
            </span>
            <button
              className="secondary"
              onClick={() => {
                setBInput(birthday);
                setGInput(gender);
                setEditingInfo(true);
              }}
            >
              수정
            </button>
          </div>
        )}
      </div>

      <h2>구독 중인 취미</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
          구독한 취미에 새 모임이 올라오면 알림을 받아요.
        </p>
        <div className="field-row">
          {CATEGORIES.filter((c) => c.kind === 'posts').map((c) => (
            <button
              key={c.slug}
              className={`seg ${subs.has(c.slug) ? 'on' : ''}`}
              style={subs.has(c.slug) ? { background: c.color, borderColor: c.color, color: c.fg } : undefined}
              onClick={() => toggleSub(c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div style={{ marginTop: 28 }}>
        <button className="danger" onClick={logout}>
          로그아웃
        </button>
      </div>
    </>
  );
}
