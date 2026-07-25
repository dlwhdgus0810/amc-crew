'use client';

import { useEffect, useRef, useState } from 'react';
import { getCategory } from '@/lib/categories';
import type { TitleMeta, TitleSearchResult } from '@/lib/tmdb';
import { TMDB_IMG } from '@/lib/tmdb';

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
  title: string | null;
  titleMeta: TitleMeta | null;
  recurringRuleId: string | null;
  isPast: boolean;
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

/** 요일 한 글자 (예: '토') — 매주 반복 안내·뱃지용 */
function weekdayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
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
  const titleLabel = getCategory(slug)?.titleLabel;

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fTitleMeta, setFTitleMeta] = useState<TitleMeta | null>(null);
  const [titleResults, setTitleResults] = useState<TitleSearchResult[]>([]);
  const [tmdbOff, setTmdbOff] = useState(false); // TMDB_API_KEY 미설정 시 자동완성 비활성
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fDate, setFDate] = useState('');
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fLocation, setFLocation] = useState('');
  const [fMemo, setFMemo] = useState('');
  const [fCapacity, setFCapacity] = useState('');
  const [fRepeat, setFRepeat] = useState(false); // 매주 반복 (새 모임 만들 때만)

  function resetForm() {
    setFTitle('');
    setFTitleMeta(null);
    setTitleResults([]);
    setFDate('');
    setFStart('');
    setFEnd('');
    setFLocation('');
    setFMemo('');
    setFCapacity('');
    setFRepeat(false);
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
          title: fTitle,
          titleMeta: fTitleMeta ?? undefined,
          date: fDate,
          startTime: fStart,
          endTime: fEnd,
          location: fLocation,
          description: fMemo,
          capacity: fCapacity || undefined,
          repeatWeekly: fRepeat,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '모임 만들기 실패');
      setMsg({
        type: 'ok',
        text: data.repeatWeekly
          ? `매주 ${weekdayLabel(fDate)}요일 모임으로 만들었어요! 다음 회차는 한 주 전에 자동으로 열려요.`
          : '모임을 만들었어요! 구독자들에게 알림이 갔어요.',
      });
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
    setFTitle(post.title ?? '');
    setFTitleMeta(post.titleMeta);
    setTitleResults([]);
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
          title: fTitle,
          titleMeta: fTitleMeta ?? undefined,
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

  // 제목 입력 → 디바운스 TMDB 검색 (키 미설정이면 첫 503 이후 조용히 비활성)
  function onTitleChange(value: string) {
    setFTitle(value);
    setFTitleMeta(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = value.trim();
    if (q.length < 2 || tmdbOff) {
      setTitleResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tmdb/search?q=${encodeURIComponent(q)}`);
        if (res.status === 503) {
          setTmdbOff(true);
          setTitleResults([]);
          return;
        }
        if (!res.ok) {
          setTitleResults([]);
          return;
        }
        const data = await res.json();
        setTitleResults(data.results ?? []);
      } catch {
        setTitleResults([]);
      }
    }, 300);
  }

  async function pickTitle(r: TitleSearchResult) {
    setFTitle(r.title);
    setTitleResults([]);
    try {
      const res = await fetch(`/api/tmdb/detail?type=${r.mediaType}&id=${r.tmdbId}`);
      if (res.ok) {
        const data = await res.json();
        setFTitleMeta(data.meta ?? null);
        return;
      }
    } catch {
      /* 상세 조회 실패 시 검색 결과 수준의 정보만 저장 */
    }
    setFTitleMeta(r);
  }

  async function share(post: PostView) {
    const url = `${window.location.origin}/p/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${name} 모임${post.title ? ` 〈${post.title}〉` : ''} · ${dateLabel(post.date)} ${to12h(post.startTime)} · ${post.location}`,
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMsg({ type: 'ok', text: '모임 링크를 복사했어요. 카톡에 붙여넣으면 바로 참가할 수 있어요!' });
    } catch {
      /* 사용자가 공유 시트를 닫은 경우 등 */
    }
  }

  /** 반복 중단 — 규칙만 끄고 이미 열린 회차는 남는다 */
  async function stopRepeat(post: PostView) {
    if (!post.recurringRuleId) return;
    if (!confirm('매주 반복을 중단할까요? 이미 열린 모임은 그대로 남아요.')) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/recurring/${post.recurringRuleId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? '반복 중단 실패' });
    } else {
      setMsg({ type: 'ok', text: '반복을 중단했어요. 다음 주부터는 자동으로 열리지 않아요.' });
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

  const editForm = (onSave: () => void, onCancel: () => void, saveLabel: string, isCreate = false) => (
    <div style={{ marginTop: 20 }}>
      {titleLabel && (
        <div className="field-row" style={{ marginBottom: 14 }}>
          <div className="search-wrap">
            <input
              type="text"
              placeholder={`${titleLabel} 제목 검색 (예: 듄: 파트2)`}
              value={fTitle}
              maxLength={100}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={() => setTimeout(() => setTitleResults([]), 200)}
            />
            {titleResults.length > 0 && (
              <div className="search-drop">
                {titleResults.map((r) => (
                  <div key={`${r.mediaType}-${r.tmdbId}`} className="search-item" onMouseDown={() => pickTitle(r)}>
                    {r.posterPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`${TMDB_IMG}/w92${r.posterPath}`} alt="" />
                    ) : (
                      <span className="si-noposter" />
                    )}
                    <span>
                      {r.title}
                      <span className="si-sub">
                        {[r.mediaType === 'tv' ? '드라마' : '영화', r.year, r.rating ? `★ ${r.rating.toFixed(1)}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {fTitleMeta && (
        <div className="title-meta-box">
          {fTitleMeta.posterPath && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${TMDB_IMG}/w154${fTitleMeta.posterPath}`} alt="" />
          )}
          <div>
            <div style={{ fontWeight: 800 }}>
              〈{fTitleMeta.title}〉{fTitleMeta.year ? ` (${fTitleMeta.year})` : ''}
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
              {[
                fTitleMeta.rating ? `★ ${fTitleMeta.rating.toFixed(1)}` : null,
                fTitleMeta.director ? `${fTitleMeta.mediaType === 'tv' ? '크리에이터' : '감독'} ${fTitleMeta.director}` : null,
                fTitleMeta.cast?.length ? `출연 ${fTitleMeta.cast.join(', ')}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <button
            className="danger"
            style={{ marginLeft: 'auto', flex: 'none' }}
            onClick={() => setFTitleMeta(null)}
          >
            선택 해제
          </button>
        </div>
      )}
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
      <div className="field-row" style={{ marginBottom: isCreate ? 14 : 0 }}>
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
      {isCreate && (
        <label className="repeat-check">
          <input type="checkbox" checked={fRepeat} onChange={(e) => setFRepeat(e.target.checked)} />
          <span>
            매주 반복
            {fDate && (
              <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
                {' '}
                — 매주 {weekdayLabel(fDate)}요일 같은 시간에 모임이 자동으로 열려요
              </span>
            )}
          </span>
        </label>
      )}
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

      {showForm && <div className="card">{editForm(createPost, () => setShowForm(false), '만들기', true)}</div>}

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
          {post.recurringRuleId && <span className="repeat-badge">매주 {weekdayLabel(post.date)}</span>}
        </span>
        <span className="post-meta">
          {post.title && (
            <span style={{ display: 'block', fontWeight: 800, color: 'var(--text)' }}>〈{post.title}〉</span>
          )}
          {post.titleMeta && (
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text-dim)' }}>
              {[
                post.titleMeta.rating ? `★ ${post.titleMeta.rating.toFixed(1)}` : null,
                post.titleMeta.year,
                post.titleMeta.director
                  ? `${post.titleMeta.mediaType === 'tv' ? '크리에이터' : '감독'} ${post.titleMeta.director}`
                  : null,
                post.titleMeta.cast?.length ? post.titleMeta.cast.join(', ') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
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
            {!past && (
              <button className="secondary" disabled={busy} onClick={() => share(post)}>
                공유
              </button>
            )}
            <button className="secondary" disabled={busy} onClick={() => toggleComments(post.id)}>
              댓글 {post.comments.length > 0 ? post.comments.length : ''}
            </button>
            {/* 정기 모임은 작성자도 이번 주만 빠질 수 있다 */}
            {!past && (!mine || post.recurringRuleId) && (
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
                {!past && post.recurringRuleId && (
                  <button className="secondary" disabled={busy} onClick={() => stopRepeat(post)}>
                    반복 중단
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
