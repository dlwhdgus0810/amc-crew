'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface CategoryRequest {
  id: string;
  userId: string;
  userName: string;
  name: string;
  color: string;
  description: string;
  featureRequest: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
  createdAt: string;
}

/** 기존 카테고리와 잘 어울리는 추천 색 */
const PRESET_COLORS = [
  '#E8380D', '#008542', '#E9A300', '#002FA7', '#5B2A86',
  '#C2185B', '#00838F', '#5D4037', '#37474F', '#7CB342',
];

const STATUS_LABEL: Record<CategoryRequest['status'], string> = {
  pending: '검토 중',
  approved: '승인됨',
  rejected: '반려됨',
};

/** 배경색 위에 올릴 글자색 — YIQ 밝기 기준(128)으로 결정 */
function foregroundOf(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#101010' : '#F6F4EE';
}

export default function SuggestPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<CategoryRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [description, setDescription] = useState('');
  const [feature, setFeature] = useState('');

  async function load() {
    const res = await fetch('/api/category-requests?mine=1');
    if (res.ok) {
      const data = await res.json();
      setRequests(data.requests ?? []);
    }
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then(async (auth) => {
        setLoggedIn(Boolean(auth.user));
        if (auth.user) await load();
      })
      .finally(() => setLoading(false));
  }, []);

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/category-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color, description, featureRequest: feature }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '제출 실패');
      setMsg({ type: 'ok', text: '제안을 보냈어요! 검토 후 알림으로 알려드릴게요.' });
      setName('');
      setDescription('');
      setFeature('');
      await load();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '제출 실패' });
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  if (!loggedIn) {
    return (
      <>
        <h1>카테고리 제안</h1>
        <p className="subtitle">카카오 로그인 후 새 취미 카테고리를 제안할 수 있어요.</p>
        <a className="kakao-btn" href="/api/auth/login?next=/suggest">
          카카오 로그인
        </a>
      </>
    );
  }

  const fg = foregroundOf(color);

  return (
    <>
      <h1>카테고리 제안</h1>
      <p className="subtitle">
        하고 싶은 취미가 목록에 없나요? 이름·색·부제목을 정해서 제안해주세요. 검토 후 추가해드릴게요.
      </p>

      <div className="card">
        <div className="suggest-grid">
          <div>
            <div className="field-label">이름</div>
            <input
              type="text"
              placeholder="예: 등산"
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              style={{ marginBottom: 22 }}
            />

            <div className="field-label">부제목</div>
            <input
              type="text"
              placeholder="예: 같이 오를 사람 모집"
              value={description}
              maxLength={50}
              onChange={(e) => setDescription(e.target.value)}
              style={{ marginBottom: 22 }}
            />

            <div className="field-label">색상</div>
            <div className="swatches">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`swatch ${color.toLowerCase() === c.toLowerCase() ? 'on' : ''}`}
                  style={{ background: c }}
                  aria-label={c}
                  onClick={() => setColor(c)}
                />
              ))}
              <label className="swatch-custom">
                직접 고르기
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              </label>
            </div>
          </div>

          {/* 홈 카드와 같은 모양의 미리보기 */}
          <div>
            <div className="field-label">미리보기</div>
            <div className="suggest-preview" style={{ background: color, color: fg }}>
              <span className="car-idx">{(name || '새 카테고리').toUpperCase()}</span>
              <div>
                <div className="car-name" style={{ fontSize: 34 }}>{name || '이름'}</div>
                <div className="car-desc">{description || '부제목이 여기에 보여요'}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 26 }}>
          <div className="field-label">원하는 기능 (선택)</div>
          <p className="subtitle" style={{ fontSize: 13.5, margin: '0 0 10px' }}>
            부제목과 별개로, 이 카테고리에 있으면 좋을 기능을 적어주세요. 예를 들어 무비나잇에는 영화를 검색하면
            평점·감독·배우를 자동으로 가져오는 기능이 붙어 있어요.
          </p>
          <textarea
            rows={4}
            placeholder="예: 등산 코스를 검색하면 거리와 고도를 가져왔으면 좋겠어요"
            value={feature}
            maxLength={1000}
            onChange={(e) => setFeature(e.target.value)}
          />
        </div>

        {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

        <div style={{ marginTop: 20 }}>
          <button disabled={busy || !name.trim() || !description.trim()} onClick={submit}>
            {busy ? '보내는 중…' : '제안 보내기 →'}
          </button>
        </div>
      </div>

      <h2>내가 보낸 제안</h2>
      {requests.length === 0 ? (
        <div className="card" style={{ color: 'var(--text-dim)' }}>아직 보낸 제안이 없어요.</div>
      ) : (
        requests.map((r) => (
          <div key={r.id} className="card">
            <div className="field-row" style={{ justifyContent: 'space-between' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}>
                <span className="feed-dot" style={{ background: r.color }} />
                {r.name}
                <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>{r.description}</span>
              </span>
              <span className={`req-status ${r.status}`}>{STATUS_LABEL[r.status]}</span>
            </div>
            {r.featureRequest && (
              <div style={{ marginTop: 10, color: 'var(--text-dim)', fontSize: 14 }}>
                원하는 기능: {r.featureRequest}
              </div>
            )}
            {r.adminNote && (
              <div style={{ marginTop: 10, fontSize: 14 }}>답변: {r.adminNote}</div>
            )}
          </div>
        ))
      )}

      <div style={{ marginTop: 40 }}>
        <Link href="/" className="profile-link">홈으로 →</Link>
      </div>
    </>
  );
}
