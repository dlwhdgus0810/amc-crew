'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCategory } from '@/lib/categories';
import type { PostView } from '@/lib/db/posts';

interface SessionUser {
  id: string;
  name: string;
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

function todayLocal(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
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

export default function PostClient({ id }: { id: string }) {
  const [post, setPost] = useState<PostView | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [commentInput, setCommentInput] = useState('');

  async function loadPost() {
    const res = await fetch(`/api/posts/${id}`);
    if (!res.ok) {
      setNotFound(true);
      return;
    }
    const data = await res.json();
    setPost(data.post ?? null);
  }

  useEffect(() => {
    Promise.all([
      loadPost(),
      fetch('/api/auth/me').then((r) => r.json()),
    ])
      .then(([, auth]) => {
        setUser(auth.user ?? null);
        setIsAdmin(Boolean(auth.isAdmin));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function join() {
    if (!post || !user) return;
    setBusy(true);
    setMsg(null);
    const joined = post.participants.some((p) => p.id === user.id);
    const res = await fetch(`/api/posts/${post.id}/join`, { method: joined ? 'DELETE' : 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? '요청 실패' });
    } else if (!joined) {
      setMsg({ type: 'ok', text: '참가 완료! 모임에서 만나요.' });
    }
    await loadPost();
    setBusy(false);
  }

  async function sendComment() {
    if (!post) return;
    const text = commentInput.trim();
    if (!text) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/posts/${post.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? '댓글 작성 실패' });
    } else {
      setCommentInput('');
    }
    await loadPost();
    setBusy(false);
  }

  async function removeComment(commentId: string) {
    if (!confirm('댓글을 삭제할까요?')) return;
    setBusy(true);
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? '댓글 삭제 실패' });
    }
    await loadPost();
    setBusy(false);
  }

  async function copyLink() {
    const url = `${window.location.origin}/p/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMsg({ type: 'ok', text: '모임 링크를 복사했어요. 카톡에 붙여넣어 공유하세요!' });
    } catch {
      /* 사용자가 공유 시트를 닫은 경우 등 */
    }
  }

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  if (notFound || !post) {
    return (
      <>
        <h1>모임을 찾을 수 없어요</h1>
        <p className="subtitle">링크가 잘못됐거나 이미 취소된 모임이에요.</p>
        <Link href="/" className="profile-link">홈으로 →</Link>
      </>
    );
  }

  const cat = getCategory(post.category);
  const color = cat?.color ?? '#101010';
  const joined = user ? post.participants.some((p) => p.id === user.id) : false;
  const mine = user?.id === post.authorId;
  const full = post.capacity != null && post.participants.length >= post.capacity;
  const past = post.date < todayLocal();
  const loginNext = `/api/auth/login?next=${encodeURIComponent(`/p/${id}`)}`;

  return (
    <>
      <div className="feed-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <h1 style={{ margin: 0 }}>{cat?.name ?? post.category}</h1>
          <span className="feed-dot" style={{ background: color }} />
        </div>
        <div className="feed-actions">
          <Link href={`/c/${post.category}`} className="profile-link">
            전체 모임 보기 →
          </Link>
        </div>
      </div>

      <div className="card">
        {post.title && (
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>〈{post.title}〉</div>
        )}
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px' }}>
          {dateLabel(post.date)} {to12h(post.startTime)} ~ {to12h(post.endTime)}
        </div>
        <div style={{ marginTop: 8, fontSize: 15.5 }}>
          {post.location} — {post.authorName}
        </div>
        {post.description && (
          <div style={{ marginTop: 8, color: 'var(--text-dim)' }}>“{post.description}”</div>
        )}
        <div style={{ marginTop: 14, fontWeight: 700, color }}>
          {post.participants.length}
          {post.capacity != null ? `/${post.capacity}` : ''}명 참여
          {past ? ' — 지난 모임' : full ? ' — 마감' : ''}
        </div>
        {post.participants.length > 0 && (
          <div style={{ marginTop: 6, color: 'var(--text-dim)' }}>
            {post.participants.map((p) => p.name + (user?.id === p.id ? ' (나)' : '')).join(', ')}
          </div>
        )}

        <div className="field-row" style={{ marginTop: 20 }}>
          {past ? null : user ? (
            mine ? (
              <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>내가 만든 모임이에요.</span>
            ) : (
              <button disabled={busy || (!joined && full)} onClick={join}>
                {joined ? '참가 취소' : full ? '마감' : '참가하기 →'}
              </button>
            )
          ) : (
            <a className="kakao-btn" href={loginNext}>
              <KakaoIcon />
              카카오 로그인하고 참가하기
            </a>
          )}
          <button className="secondary" onClick={copyLink}>링크 공유</button>
        </div>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <h2>댓글 {post.comments.length > 0 ? post.comments.length : ''}</h2>
      <div className="comments" style={{ marginTop: 0 }}>
        {post.comments.length === 0 && (
          <div className="comment-row" style={{ color: 'var(--text-dim)' }}>첫 댓글을 남겨보세요.</div>
        )}
        {post.comments.map((c) => (
          <div key={c.id} className="comment-row">
            <span className="comment-author">{c.name}</span>
            <span className="comment-body">{c.body}</span>
            {(user?.id === c.userId || isAdmin) && (
              <button className="danger comment-delete" disabled={busy} onClick={() => removeComment(c.id)}>
                삭제
              </button>
            )}
          </div>
        ))}
        {user ? (
          <div className="field-row" style={{ marginTop: 12 }}>
            <input
              type="text"
              placeholder="댓글 남기기"
              value={commentInput}
              maxLength={300}
              onChange={(e) => setCommentInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && sendComment()}
              style={{ maxWidth: 420 }}
            />
            <button className="secondary" disabled={busy || !commentInput.trim()} onClick={sendComment}>
              등록
            </button>
          </div>
        ) : (
          <div className="comment-row" style={{ color: 'var(--text-dim)' }}>카카오 로그인 후 댓글을 남길 수 있어요.</div>
        )}
      </div>
    </>
  );
}
