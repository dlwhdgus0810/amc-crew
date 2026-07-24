'use client';

import { useEffect, useState } from 'react';

interface SessionUser {
  id: string;
  name: string;
}

interface PostView {
  id: string;
  category: string;
  authorId: string;
  authorName: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  capacity: number | null;
  participants: { id: string; name: string }[];
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function to12h(time: string): string {
  const [h, min] = time.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(min).padStart(2, '0')}`;
}

function dateLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return `${m}/${d} (${wd})`;
}

export default function CategoryClient({ slug, name, emoji }: { slug: string; name: string; emoji: string }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 작성/수정 폼 (필드 공유)
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fDate, setFDate] = useState('');
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fLocation, setFLocation] = useState('');
  const [fMemo, setFMemo] = useState('');
  const [fCapacity, setFCapacity] = useState('');

  function resetForm() {
    setFDate('');
    setFStart('');
    setFEnd('');
    setFLocation('');
    setFMemo('');
    setFCapacity('');
  }

  async function loadPosts() {
    const data = await fetch(`/api/posts?category=${slug}`).then((r) => r.json());
    setPosts(data.posts ?? []);
  }

  useEffect(() => {
    Promise.all([
      loadPosts(),
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
    ])
      .then(([, auth, sub]) => {
        setUser(auth.user ?? null);
        setIsAdmin(Boolean(auth.isAdmin));
        setSubscribed((sub.subscriptions ?? []).includes(slug));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function toggleSub() {
    if (!user) {
      setMsg({ type: 'err', text: '카카오 로그인 후 구독할 수 있어요.' });
      return;
    }
    const next = !subscribed;
    setSubscribed(next);
    const res = await fetch('/api/subscriptions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: slug, subscribed: next }),
    });
    if (!res.ok) setSubscribed(!next);
  }

  async function createPost() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: slug,
          date: fDate,
          startTime: fStart,
          endTime: fEnd,
          location: fLocation,
          description: fMemo,
          capacity: fCapacity || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '모임 만들기 실패');
      setMsg({ type: 'ok', text: '모임을 만들었어요! 구독자들에게 알림이 갔어요.' });
      setShowForm(false);
      resetForm();
      await loadPosts();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '모임 만들기 실패' });
    } finally {
      setBusy(false);
    }
  }

  function startEditPost(post: PostView) {
    setMsg(null);
    setShowForm(false);
    setEditId(post.id);
    setFDate(post.date);
    setFStart(post.startTime);
    setFEnd(post.endTime);
    setFLocation(post.location);
    setFMemo(post.description ?? '');
    setFCapacity(post.capacity != null ? String(post.capacity) : '');
  }

  async function saveEditPost() {
    if (!editId) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/posts/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: fDate,
          startTime: fStart,
          endTime: fEnd,
          location: fLocation,
          description: fMemo,
          capacity: fCapacity || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '수정 실패');
      setMsg({ type: 'ok', text: '모임을 수정했어요. 참가자들에게 변경 알림이 갔어요.' });
      setEditId(null);
      resetForm();
      await loadPosts();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '수정 실패' });
    } finally {
      setBusy(false);
    }
  }

  async function join(post: PostView) {
    if (!user) {
      setMsg({ type: 'err', text: '카카오 로그인 후 참가할 수 있어요.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    const joined = post.participants.some((p) => p.id === user.id);
    const res = await fetch(`/api/posts/${post.id}/join`, { method: joined ? 'DELETE' : 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? '요청 실패' });
    }
    await loadPosts();
    setBusy(false);
  }

  async function remove(post: PostView) {
    if (!confirm('이 모임을 취소(삭제)할까요? 참가자들에게 취소 알림이 가요.')) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? '삭제 실패' });
    }
    await loadPosts();
    setBusy(false);
  }

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  return (
    <>
      <h1>
        {emoji} {name}
      </h1>
      <p className="subtitle">모임을 만들거나, 마음에 드는 모임에 참가하세요.</p>

      <div className="card">
        <div className="field-row" style={{ justifyContent: 'space-between' }}>
          <button className={`secondary ${subscribed ? '' : ''}`} onClick={toggleSub}>
            {subscribed ? '🔔 구독중 — 새 모임 알림 받는 중' : '🔕 구독하고 새 모임 알림 받기'}
          </button>
          {user && (
            <button
              className="secondary"
              onClick={() => {
                setEditId(null);
                if (!showForm) resetForm();
                setShowForm((v) => !v);
              }}
            >
              {showForm ? '닫기' : '➕ 모임 만들기'}
            </button>
          )}
        </div>

        {showForm && (
          <div style={{ marginTop: 16 }}>
            <div className="field-row" style={{ marginBottom: 10 }}>
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} style={{ maxWidth: 170 }} />
              <input type="time" value={fStart} onChange={(e) => setFStart(e.target.value)} style={{ maxWidth: 140 }} />
              <span style={{ color: 'var(--text-dim)' }}>~</span>
              <input type="time" value={fEnd} onChange={(e) => setFEnd(e.target.value)} style={{ maxWidth: 140 }} />
            </div>
            <div className="field-row" style={{ marginBottom: 10 }}>
              <input
                type="text"
                placeholder="장소 (예: Lifetime OP 피클볼 코트)"
                value={fLocation}
                maxLength={100}
                onChange={(e) => setFLocation(e.target.value)}
                style={{ maxWidth: 420 }}
              />
            </div>
            <div className="field-row" style={{ marginBottom: 10 }}>
              <input
                type="number"
                placeholder="정원 (선택, 예: 4)"
                value={fCapacity}
                min={2}
                max={99}
                onChange={(e) => setFCapacity(e.target.value)}
                style={{ maxWidth: 170 }}
              />
              <span style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 600 }}>
                비워두면 인원 제한 없음
              </span>
            </div>
            <div className="field-row">
              <input
                type="text"
                placeholder="메모 (선택)"
                value={fMemo}
                maxLength={500}
                onChange={(e) => setFMemo(e.target.value)}
                style={{ maxWidth: 420 }}
              />
              <button disabled={busy || !fDate || !fStart || !fEnd || !fLocation.trim()} onClick={createPost}>
                {busy ? '만드는 중…' : '만들기'}
              </button>
            </div>
          </div>
        )}
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {posts.length === 0 && (
        <div className="card" style={{ color: 'var(--text-dim)' }}>
          아직 예정된 모임이 없어요. 첫 모임을 만들어보세요!
        </div>
      )}

      {posts.map((post) => {
        const joined = user ? post.participants.some((p) => p.id === user.id) : false;
        const mine = user?.id === post.authorId;
        const full = post.capacity != null && post.participants.length >= post.capacity;
        return (
          <div key={post.id} className="card group-card">
            <div className="group-title">
              {dateLabel(post.date)} {to12h(post.startTime)} ~ {to12h(post.endTime)}
              <span className="badge match">
                🙋{post.participants.length}
                {post.capacity != null ? `/${post.capacity}` : ''}명
              </span>
              {full && <span className="badge full">마감</span>}
            </div>
            <div className="post-meta">
              📍 {post.location} · 만든 사람: {post.authorName}
              {post.description && <div className="post-desc">💬 {post.description}</div>}
            </div>
            <div className="member-chips">
              {post.participants.map((p) => (
                <span key={p.id} className="member-chip">
                  {p.name}
                  {user?.id === p.id && ' (나)'}
                </span>
              ))}
            </div>
            {editId === post.id ? (
              <div style={{ marginTop: 14, background: 'var(--surface-2)', borderRadius: 12, padding: 14 }}>
                <div className="field-row" style={{ marginBottom: 10 }}>
                  <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} style={{ maxWidth: 170 }} />
                  <input type="time" value={fStart} onChange={(e) => setFStart(e.target.value)} style={{ maxWidth: 140 }} />
                  <span style={{ color: 'var(--text-dim)' }}>~</span>
                  <input type="time" value={fEnd} onChange={(e) => setFEnd(e.target.value)} style={{ maxWidth: 140 }} />
                </div>
                <div className="field-row" style={{ marginBottom: 10 }}>
                  <input
                    type="text"
                    placeholder="장소"
                    value={fLocation}
                    maxLength={100}
                    onChange={(e) => setFLocation(e.target.value)}
                    style={{ maxWidth: 300 }}
                  />
                  <input
                    type="number"
                    placeholder="정원 (선택)"
                    value={fCapacity}
                    min={2}
                    max={99}
                    onChange={(e) => setFCapacity(e.target.value)}
                    style={{ maxWidth: 140 }}
                  />
                </div>
                <div className="field-row">
                  <input
                    type="text"
                    placeholder="메모 (선택)"
                    value={fMemo}
                    maxLength={500}
                    onChange={(e) => setFMemo(e.target.value)}
                    style={{ maxWidth: 300 }}
                  />
                  <button
                    className="secondary"
                    disabled={busy || !fDate || !fStart || !fEnd || !fLocation.trim()}
                    onClick={saveEditPost}
                  >
                    {busy ? '저장 중…' : '저장'}
                  </button>
                  <button
                    className="secondary"
                    style={{ background: '#fff' }}
                    disabled={busy}
                    onClick={() => {
                      setEditId(null);
                      resetForm();
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                {!mine && (
                  <button
                    className={joined ? 'secondary' : ''}
                    disabled={busy || (!joined && full)}
                    onClick={() => join(post)}
                  >
                    {joined ? '참가 취소' : full ? '마감됐어요' : '🙋 참가하기'}
                  </button>
                )}
                {(mine || isAdmin) && (
                  <>
                    <button className="secondary" disabled={busy} onClick={() => startEditPost(post)}>
                      ✏️ 수정
                    </button>
                    <button className="danger" disabled={busy} onClick={() => remove(post)}>
                      삭제
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
