'use client';

import { useEffect, useState } from 'react';
import { getCategory } from '@/lib/categories';

interface SessionUser {
  id: string;
  name: string;
}

interface CommentView {
  id: string;
  userId: string;
  name: string;
  body: string;
  createdAt: string;
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
  comments: CommentView[];
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

export default function CategoryClient({ slug, name }: { slug: string; name: string; emoji?: string }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const color = getCategory(slug)?.color ?? '#101010';

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

  // 지난 모임
  const [pastPosts, setPastPosts] = useState<PostView[] | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [loadingPast, setLoadingPast] = useState(false);

  // 댓글
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  async function loadPosts() {
    const data = await fetch(`/api/posts?category=${slug}`).then((r) => r.json());
    setPosts(data.posts ?? []);
  }

  async function loadPast() {
    setLoadingPast(true);
    const data = await fetch(`/api/posts?category=${slug}&past=1`).then((r) => r.json());
    setPastPosts(data.posts ?? []);
    setLoadingPast(false);
  }

  async function togglePast() {
    const next = !showPast;
    setShowPast(next);
    if (next && pastPosts === null) await loadPast();
  }

  async function reloadAll() {
    await loadPosts();
    if (pastPosts !== null) await loadPast();
  }

  function toggleComments(postId: string) {
    setOpenComments((prev) => {
      const s = new Set(prev);
      if (s.has(postId)) s.delete(postId);
      else s.add(postId);
      return s;
    });
  }

  async function sendComment(postId: string) {
    const text = (commentInputs[postId] ?? '').trim();
    if (!text) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? '댓글 작성 실패' });
    } else {
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
    }
    await reloadAll();
    setBusy(false);
  }

  async function removeComment(comment: CommentView) {
    if (!confirm('댓글을 삭제할까요?')) return;
    setBusy(true);
    const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? '댓글 삭제 실패' });
    }
    await reloadAll();
    setBusy(false);
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
    await reloadAll();
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
    await reloadAll();
    setBusy(false);
  }

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  const editForm = (onSave: () => void, onCancel: () => void, saveLabel: string) => (
    <div style={{ marginTop: 20 }}>
      <div className="field-row" style={{ marginBottom: 14 }}>
        <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} style={{ maxWidth: 170 }} />
        <input type="time" value={fStart} onChange={(e) => setFStart(e.target.value)} style={{ maxWidth: 140 }} />
        <span style={{ color: 'var(--text-dim)' }}>~</span>
        <input type="time" value={fEnd} onChange={(e) => setFEnd(e.target.value)} style={{ maxWidth: 140 }} />
      </div>
      <div className="field-row" style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="장소 (예: Lifetime OP 피클볼 코트)"
          value={fLocation}
          maxLength={100}
          onChange={(e) => setFLocation(e.target.value)}
          style={{ maxWidth: 420 }}
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
          style={{ maxWidth: 420 }}
        />
        <button disabled={busy || !fDate || !fStart || !fEnd || !fLocation.trim()} onClick={onSave}>
          {busy ? '저장 중…' : saveLabel}
        </button>
        <button className="secondary" disabled={busy} onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="feed-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <h1 style={{ margin: 0 }}>{name}</h1>
          <span className="feed-dot" style={{ background: color }} />
        </div>
        <div className="feed-actions">
          <button onClick={toggleSub}>{subscribed ? '구독중' : '구독'}</button>
          {user && (
            <button
              onClick={() => {
                setEditId(null);
                if (!showForm) resetForm();
                setShowForm((v) => !v);
              }}
            >
              {showForm ? '닫기' : '모임 만들기 +'}
            </button>
          )}
        </div>
      </div>

      {showForm && <div className="card">{editForm(createPost, () => setShowForm(false), '만들기')}</div>}

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {posts.length === 0 && (
        <div className="card" style={{ color: 'var(--text-dim)' }}>
          아직 예정된 모임이 없어요. 첫 모임을 만들어보세요.
        </div>
      )}

      {posts.map((post) => renderPost(post, false))}

      <h2 style={{ marginTop: 64 }}>
        <button className="secondary" style={{ fontFamily: 'inherit', fontSize: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: 'inherit', border: 'none' }} onClick={togglePast}>
          지난 모임 {showPast ? '−' : '+'}
        </button>
      </h2>
      {showPast && (
        loadingPast ? (
          <p className="subtitle">불러오는 중…</p>
        ) : (pastPosts ?? []).length === 0 ? (
          <div className="card" style={{ color: 'var(--text-dim)' }}>아직 지난 모임이 없어요.</div>
        ) : (
          (pastPosts ?? []).map((post) => renderPost(post, true))
        )
      )}
    </>
  );

  function renderPost(post: PostView, past: boolean) {
    const joined = user ? post.participants.some((p) => p.id === user.id) : false;
    const mine = user?.id === post.authorId;
    const full = post.capacity != null && post.participants.length >= post.capacity;
    const commentsOpen = openComments.has(post.id);
    return (
      <div key={post.id} className="post-row" style={past ? { opacity: 0.75 } : undefined}>
        <span className="post-when">
          {dateLabel(post.date)} {to12h(post.startTime)} ~ {to12h(post.endTime)}
        </span>
        <span className="post-meta">
          {post.location} — {post.authorName}
          {post.description && <span className="post-desc" style={{ display: 'block' }}>“{post.description}”</span>}
          {post.participants.length > 0 && (
            <span style={{ display: 'block', marginTop: 6 }}>
              {post.participants.map((p) => p.name + (user?.id === p.id ? ' (나)' : '')).join(', ')}
            </span>
          )}
        </span>
        <span className="post-count" style={{ color }}>
          {post.participants.length}
          {post.capacity != null ? `/${post.capacity}` : ''}명{!past && full ? ' — 마감' : ''}
        </span>
        {editId === post.id ? (
          <div style={{ flexBasis: '100%' }}>{editForm(saveEditPost, () => { setEditId(null); resetForm(); }, '저장')}</div>
        ) : (
          <span style={{ display: 'flex', gap: 20, flex: 'none' }}>
            <button className="secondary" disabled={busy} onClick={() => toggleComments(post.id)}>
              댓글 {post.comments.length > 0 ? post.comments.length : ''}
            </button>
            {!past && !mine && (
              <button disabled={busy || (!joined && full)} onClick={() => join(post)}>
                {joined ? '참가 취소' : full ? '마감' : '참가하기 →'}
              </button>
            )}
            {(mine || isAdmin) && (
              <>
                {!past && (
                  <button className="secondary" disabled={busy} onClick={() => startEditPost(post)}>
                    수정
                  </button>
                )}
                <button className="danger" disabled={busy} onClick={() => remove(post)}>
                  삭제
                </button>
              </>
            )}
          </span>
        )}
        {commentsOpen && (
          <div className="comments">
            {post.comments.length === 0 && (
              <div className="comment-row" style={{ color: 'var(--text-dim)' }}>첫 댓글을 남겨보세요.</div>
            )}
            {post.comments.map((c) => (
              <div key={c.id} className="comment-row">
                <span className="comment-author">{c.name}</span>
                <span className="comment-body">{c.body}</span>
                {(user?.id === c.userId || isAdmin) && (
                  <button className="danger comment-delete" disabled={busy} onClick={() => removeComment(c)}>
                    삭제
                  </button>
                )}
              </div>
            ))}
            {user ? (
              <div className="field-row" style={{ marginTop: 12 }}>
                <input
                  type="text"
                  placeholder="댓글 남기기 (예: 10분 늦어요 / 재밌었다!)"
                  value={commentInputs[post.id] ?? ''}
                  maxLength={300}
                  onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && !busy && sendComment(post.id)}
                  style={{ maxWidth: 420 }}
                />
                <button className="secondary" disabled={busy || !(commentInputs[post.id] ?? '').trim()} onClick={() => sendComment(post.id)}>
                  등록
                </button>
              </div>
            ) : (
              <div className="comment-row" style={{ color: 'var(--text-dim)' }}>카카오 로그인 후 댓글을 남길 수 있어요.</div>
            )}
          </div>
        )}
      </div>
    );
  }
}
