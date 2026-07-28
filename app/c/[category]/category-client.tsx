'use client';

import { useEffect, useRef, useState } from 'react';
import { DEFAULT_LOCATION_HINT, DEFAULT_LOCATION_LABEL, getCategory } from '@/lib/categories';
import { useLocale, useT } from '../../i18n';
import { dateLabel as fmtDate, timeLabel as fmtTime, weekdayLabel as fmtWeekday } from '@/lib/datefmt';
import type { TitleMeta, TitleSearchResult } from '@/lib/tmdb';
import { TMDB_IMG } from '@/lib/tmdb';
import CommentThread, { CommentView } from '../../comment-thread';
import { siteUrl } from '@/lib/site';

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  subscribed: { ko: '구독중', en: 'Subscribed' },
  subscribe: { ko: '구독', en: 'Subscribe' },
  close: { ko: '닫기', en: 'Close' },
  newMeetup: { ko: '모임 만들기 +', en: 'New meetup +' },
  create: { ko: '만들기', en: 'Create' },
  save: { ko: '저장', en: 'Save' },
  saving: { ko: '저장 중…', en: 'Saving…' },
  cancel: { ko: '취소', en: 'Cancel' },
  edit: { ko: '수정', en: 'Edit' },
  del: { ko: '삭제', en: 'Delete' },
  share: { ko: '공유', en: 'Share' },
  comments: { ko: '댓글', en: 'Comments' },
  join: { ko: '참가하기 →', en: 'Join →' },
  leave: { ko: '참가 취소', en: 'Leave' },
  full: { ko: '마감', en: 'Full' },
  people: { ko: '{n}명', en: '{n} joined' },
  peopleCap: { ko: '{n}/{cap}명', en: '{n}/{cap} joined' },
  fullSuffix: { ko: ' — 마감', en: ' — full' },
  me: { ko: ' (나)', en: ' (you)' },
  stopRepeat: { ko: '반복 중단', en: 'Stop repeating' },
  repeatWeekly: { ko: '매주 반복', en: 'Repeat weekly' },
  repeatHint: {
    ko: '— 매주 {day}요일 같은 시간에 모임이 자동으로 열려요',
    en: '— a meetup opens automatically every {day} at the same time',
  },
  repeatBadge: { ko: '매주 {day}', en: 'Every {day}' },
  emptyUpcoming: {
    ko: '아직 예정된 모임이 없어요. 첫 모임을 만들어보세요.',
    en: 'No upcoming meetups yet. Create the first one.',
  },
  pastSection: { ko: '지난 모임', en: 'Past meetups' },
  emptyPast: { ko: '아직 지난 모임이 없어요.', en: 'No past meetups yet.' },
  capacityPh: { ko: '정원 (선택)', en: 'Capacity (optional)' },
  memoPh: { ko: '메모 (선택)', en: 'Note (optional)' },
  titleSearchPh: { ko: '{label} 제목 검색 (예: 듄: 파트2)', en: 'Search {label} (e.g. Dune: Part Two)' },
  titleFreePh: { ko: '{label} (선택)', en: '{label} (optional)' },
  clearPick: { ko: '선택 해제', en: 'Clear' },
  tv: { ko: '드라마', en: 'TV' },
  movie: { ko: '영화', en: 'Movie' },
  creator: { ko: '크리에이터', en: 'Creator' },
  director: { ko: '감독', en: 'Director' },
  cast: { ko: '출연 {names}', en: 'Cast {names}' },
  loginToSubscribe: { ko: '카카오 로그인 후 구독할 수 있어요.', en: 'Log in with Kakao to subscribe.' },
  loginToJoin: { ko: '카카오 로그인 후 참가할 수 있어요.', en: 'Log in with Kakao to join.' },
  createFailed: { ko: '모임 만들기 실패', en: 'Couldn’t create the meetup' },
  createdOnce: {
    ko: '모임을 만들었어요! 구독자들에게 알림이 갔어요.',
    en: 'Meetup created — subscribers have been notified.',
  },
  createdWeekly: {
    ko: '매주 {day}요일 모임으로 만들었어요! 다음 회차는 한 주 전에 자동으로 열려요.',
    en: 'Set to repeat every {day}. The next one opens automatically a week ahead.',
  },
  editFailed: { ko: '수정 실패', en: 'Couldn’t save the changes' },
  edited: {
    ko: '모임을 수정했어요. 참가자들에게 변경 알림이 갔어요.',
    en: 'Meetup updated — participants have been notified.',
  },
  requestFailed: { ko: '요청 실패', en: 'Request failed' },
  shareTitle: {
    ko: '{cat} 모임{title} · {when} · {place}',
    en: '{cat} meetup{title} · {when} · {place}',
  },
  shareCopied: {
    ko: '모임 링크를 복사했어요. 카톡에 붙여넣으면 바로 참가할 수 있어요!',
    en: 'Link copied — paste it in a chat and anyone can join.',
  },
  stopRepeatConfirm: {
    ko: '매주 반복을 중단할까요? 이미 열린 모임은 그대로 남아요.',
    en: 'Stop the weekly repeat? Meetups already created will stay.',
  },
  stopRepeatFailed: { ko: '반복 중단 실패', en: 'Couldn’t stop the repeat' },
  stoppedRepeat: {
    ko: '반복을 중단했어요. 다음 주부터는 자동으로 열리지 않아요.',
    en: 'Repeat stopped. No new meetups will open from next week.',
  },
  deleteConfirm: {
    ko: '이 모임을 취소(삭제)할까요? 참가자들에게 취소 알림이 가요.',
    en: 'Cancel (delete) this meetup? Participants will be notified.',
  },
  deleteFailed: { ko: '삭제 실패', en: 'Couldn’t delete' },
};

interface SessionUser {
  id: string;
  name: string;
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

export default function CategoryClient({ slug }: { slug: string }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [posts, setPosts] = useState<PostView[]>([]);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const t = useT();
  const locale = useLocale();
  const category = getCategory(slug);
  const name = category ? t(category.name) : slug;
  const color = category?.color ?? '#101010';
  const titleLabel = category?.titleLabel ? t(category.titleLabel) : undefined;
  const useTitleSearch = category?.titleSearch === 'tmdb'; // 자동완성은 영화/드라마만
  const locationPlaceholder = `${t(category?.locationLabel ?? DEFAULT_LOCATION_LABEL)} (${t(
    category?.locationHint ?? DEFAULT_LOCATION_HINT
  )})`;
  // 날짜·시간은 현재 언어 포맷으로
  const dateLabel = (d: string) => fmtDate(d, locale);
  const to12h = (time: string) => fmtTime(time, locale);
  const weekdayLabel = (d: string) => fmtWeekday(d, locale);

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
      setMsg({ type: 'err', text: t(T.loginToSubscribe) });
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
      if (!res.ok) throw new Error(data.error ?? t(T.createFailed));
      setMsg({
        type: 'ok',
        text: data.repeatWeekly
          ? t(T.createdWeekly, { day: weekdayLabel(fDate) })
          : t(T.createdOnce),
      });
      setShowForm(false);
      resetForm();
      await loadPosts();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.createFailed) });
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
      if (!res.ok) throw new Error(data.error ?? t(T.editFailed));
      setMsg({ type: 'ok', text: t(T.edited) });
      setEditId(null);
      resetForm();
      await loadPosts();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.editFailed) });
    } finally {
      setBusy(false);
    }
  }

  async function join(post: PostView) {
    if (!user) {
      setMsg({ type: 'err', text: t(T.loginToJoin) });
      return;
    }
    setBusy(true);
    setMsg(null);
    const joined = post.participants.some((p) => p.id === user.id);
    const res = await fetch(`/api/posts/${post.id}/join`, { method: joined ? 'DELETE' : 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? t(T.requestFailed) });
    }
    await reloadAll();
    setBusy(false);
  }

  // 제목 입력 → 디바운스 TMDB 검색 (키 미설정이면 첫 503 이후 조용히 비활성)
  function onTitleChange(value: string) {
    setFTitle(value);
    if (!useTitleSearch) return; // 메뉴 등 자유 입력 카테고리는 검색하지 않는다
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
    const url = `${siteUrl(window.location.origin)}/p/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: t(T.shareTitle, {
            cat: name,
            title: post.title ? ` 〈${post.title}〉` : '',
            when: `${dateLabel(post.date)} ${to12h(post.startTime)}`,
            place: post.location,
          }),
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMsg({ type: 'ok', text: t(T.shareCopied) });
    } catch {
      /* 사용자가 공유 시트를 닫은 경우 등 */
    }
  }

  /** 반복 중단 — 규칙만 끄고 이미 열린 회차는 남는다 */
  async function stopRepeat(post: PostView) {
    if (!post.recurringRuleId) return;
    if (!confirm(t(T.stopRepeatConfirm))) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/recurring/${post.recurringRuleId}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? t(T.stopRepeatFailed) });
    } else {
      setMsg({ type: 'ok', text: t(T.stoppedRepeat) });
    }
    await reloadAll();
    setBusy(false);
  }

  async function remove(post: PostView) {
    if (!confirm(t(T.deleteConfirm))) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? t(T.deleteFailed) });
    }
    await reloadAll();
    setBusy(false);
  }

  if (loading) return <p className="subtitle">{t(T.loading)}</p>;

  const editForm = (onSave: () => void, onCancel: () => void, saveLabel: string, isCreate = false) => (
    <div style={{ marginTop: 20 }}>
      {titleLabel && (
        <div className="field-row" style={{ marginBottom: 14 }}>
          <div className="search-wrap">
            <input
              type="text"
              placeholder={
                useTitleSearch
                  ? t(T.titleSearchPh, { label: titleLabel ?? '' })
                  : t(T.titleFreePh, { label: titleLabel ?? '' })
              }
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
                        {[r.mediaType === 'tv' ? t(T.tv) : t(T.movie), r.year, r.rating ? `★ ${r.rating.toFixed(1)}` : null]
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
                fTitleMeta.director
                  ? `${fTitleMeta.mediaType === 'tv' ? t(T.creator) : t(T.director)} ${fTitleMeta.director}`
                  : null,
                fTitleMeta.cast?.length ? t(T.cast, { names: fTitleMeta.cast.join(', ') }) : null,
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
            {t(T.clearPick)}
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
          placeholder={locationPlaceholder}
          value={fLocation}
          maxLength={100}
          onChange={(e) => setFLocation(e.target.value)}
          style={{ maxWidth: 420 }}
        />
        <input
          type="number"
          placeholder={t(T.capacityPh)}
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
          placeholder={t(T.memoPh)}
          value={fMemo}
          maxLength={500}
          onChange={(e) => setFMemo(e.target.value)}
          style={{ maxWidth: 420 }}
        />
        <button disabled={busy || !fDate || !fStart || !fEnd || !fLocation.trim()} onClick={onSave}>
          {busy ? t(T.saving) : saveLabel}
        </button>
        <button className="secondary" disabled={busy} onClick={onCancel}>
          {t(T.cancel)}
        </button>
      </div>
      {isCreate && (
        <label className="repeat-check">
          <input type="checkbox" checked={fRepeat} onChange={(e) => setFRepeat(e.target.checked)} />
          <span>
            {t(T.repeatWeekly)}
            {fDate && (
              <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
                {' '}
                {t(T.repeatHint, { day: weekdayLabel(fDate) })}
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
          <button onClick={toggleSub}>{subscribed ? t(T.subscribed) : t(T.subscribe)}</button>
          {user && (
            <button
              onClick={() => {
                setEditId(null);
                if (!showForm) resetForm();
                setShowForm((v) => !v);
              }}
            >
              {showForm ? t(T.close) : t(T.newMeetup)}
            </button>
          )}
        </div>
      </div>

      {showForm && <div className="card">{editForm(createPost, () => setShowForm(false), t(T.create), true)}</div>}

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {posts.length === 0 && (
        <div className="card" style={{ color: 'var(--text-dim)' }}>
          {t(T.emptyUpcoming)}
        </div>
      )}

      {posts.map((post) => renderPost(post, false))}

      <h2 style={{ marginTop: 64 }}>
        <button className="section-toggle" aria-expanded={showPast} onClick={togglePast}>
          {t(T.pastSection)} {showPast ? '−' : '+'}
        </button>
      </h2>
      {showPast && (
        loadingPast ? (
          <p className="subtitle">{t(T.loading)}</p>
        ) : (pastPosts ?? []).length === 0 ? (
          <div className="card" style={{ color: 'var(--text-dim)' }}>{t(T.emptyPast)}</div>
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
          {post.recurringRuleId && (
            <span className="repeat-badge">{t(T.repeatBadge, { day: weekdayLabel(post.date) })}</span>
          )}
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
                  ? `${post.titleMeta.mediaType === 'tv' ? t(T.creator) : t(T.director)} ${post.titleMeta.director}`
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
              {post.participants.map((p) => p.name + (user?.id === p.id ? t(T.me) : '')).join(', ')}
            </span>
          )}
        </span>
        <span className="post-count" style={{ color }}>
          {post.capacity != null
            ? t(T.peopleCap, { n: post.participants.length, cap: post.capacity })
            : t(T.people, { n: post.participants.length })}
          {!past && full ? t(T.fullSuffix) : ''}
        </span>
        {editId === post.id ? (
          <div style={{ flexBasis: '100%' }}>{editForm(saveEditPost, () => { setEditId(null); resetForm(); }, t(T.save))}</div>
        ) : (
          <span className="post-actions">
            {!past && (
              <button className="secondary" disabled={busy} onClick={() => share(post)}>
                {t(T.share)}
              </button>
            )}
            <button className="secondary" disabled={busy} onClick={() => toggleComments(post.id)}>
              {t(T.comments)} {post.comments.length > 0 ? post.comments.length : ''}
            </button>
            {/* 정기 모임은 작성자도 이번 주만 빠질 수 있다 */}
            {!past && (!mine || post.recurringRuleId) && (
              <button disabled={busy || (!joined && full)} onClick={() => join(post)}>
                {joined ? t(T.leave) : full ? t(T.full) : t(T.join)}
              </button>
            )}
            {(mine || isAdmin) && (
              <>
                {!past && (
                  <button className="secondary" disabled={busy} onClick={() => startEditPost(post)}>
                    {t(T.edit)}
                  </button>
                )}
                {!past && post.recurringRuleId && (
                  <button className="secondary" disabled={busy} onClick={() => stopRepeat(post)}>
                    {t(T.stopRepeat)}
                  </button>
                )}
                <button className="danger" disabled={busy} onClick={() => remove(post)}>
                  {t(T.del)}
                </button>
              </>
            )}
          </span>
        )}
        {commentsOpen && (
          <CommentThread
            postId={post.id}
            comments={post.comments}
            {...(user ? { currentUserId: user.id } : {})}
            isAdmin={isAdmin}
            onChanged={reloadAll}
            onError={(text) => setMsg({ type: 'err', text })}
          />
        )}
      </div>
    );
  }
}
