'use client';

/* ============================================================
   app/c/[category]/category-client.tsx 를 이 파일로 교체하세요. (시안 4c)
   달라진 점 — API 호출·상태 로직은 원본과 동일합니다.
   1) 날짜 열을 없애고 날짜를 구분 헤더로 올려 카드가 전폭을 씁니다
      (좁은 폰에서 댓글이 40px 더 넓어집니다)
   2) 참여자 전용 행 — 아바타 + 이름, 오른쪽 "3/8 ▾"를 눌러 전체 명단을 펼칩니다
   3) 구독은 헤더 텍스트 토글, 모임 만들기는 날짜 헤더 옆 ＋, 참가는 밑줄 텍스트 —
      색 버튼을 최소화했습니다
   4) 댓글은 "댓글 2 ▾"로 열고 닫습니다 (닫힘이 기본)
   ============================================================ */

import {useEffect, useRef, useState} from 'react';
import {DEFAULT_LOCATION_HINT, DEFAULT_LOCATION_LABEL, getCategory} from '@/lib/categories';
import PlaceLink from '@/app/place-link';
import {useLocale, useT} from '../../i18n';
import {dateLabel as fmtDate, timeLabel as fmtTime, weekdayLabel as fmtWeekday} from '@/lib/datefmt';
import {addDays, todayLocal} from '@/lib/dates';
import type {TitleMeta, TitleSearchResult} from '@/lib/tmdb';
import {TMDB_IMG} from '@/lib/tmdb';
import CommentThread, {CommentView} from '../../comment-thread';
import {siteUrl} from '@/lib/site';

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  subscribed: { ko: '구독중', en: 'Subscribed' },
  subscribe: { ko: '구독', en: 'Subscribe' },
  newMeetup: { ko: '＋ 만들기', en: '＋ New' },
  newMeetupWide: { ko: '＋ 모임 만들기', en: '＋ New meetup' },
  newMeetupTitle: { ko: '모임 만들기', en: 'New meetup' },
  editMeetupTitle: { ko: '모임 수정', en: 'Edit meetup' },
  create: { ko: '모임 만들기', en: 'Create meetup' },
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
  thisWeek: { ko: '이번 주', en: 'This week' },
  today: { ko: '오늘', en: 'Today' },
  tomorrow: { ko: '내일', en: 'Tomorrow' },
  seats: { ko: '{n}자리 남음', en: '{n} spots left' },
  people: { ko: '{n}명', en: '{n}' },
  peopleCap: { ko: '{n}/{cap}명', en: '{n}/{cap}' },
  me: { ko: '나', en: 'You' },
  tabUpcoming: { ko: '예정 {n}', en: 'Upcoming {n}' },
  tabPast: { ko: '지난 {n}', en: 'Past {n}' },
  tabPastPlain: { ko: '지난 모임', en: 'Past' },
  stopRepeat: { ko: '반복 중단', en: 'Stop repeating' },
  repeatWeekly: { ko: '매주 반복', en: 'Repeat weekly' },
  repeatHint: {
    ko: '— 매주 {day}요일 같은 시간에 모임이 자동으로 열려요',
    en: '— a meetup opens automatically every {day} at the same time',
  },
  repeatBadge: { ko: '매주 {day}', en: 'Every {day}' },
  privateToggle: { ko: '비공개 모임', en: 'Private meetup' },
  privateHint: {
    ko: '— 링크를 받은 사람만 볼 수 있어요. 목록·구독 알림에 나오지 않아요',
    en: '— only people with the link can see it. It stays out of the feed and subscriber alerts',
  },
  privateBadge: { ko: '비공개', en: 'Private' },
  notifyHintPrivate: {
    ko: '알림 없이 만들어져요 — 링크를 직접 보내주세요',
    en: 'Created quietly — send the link yourself',
  },
  emptyUpcoming: {
    ko: '아직 예정된 모임이 없어요. 첫 모임을 만들어보세요.',
    en: 'No upcoming meetups yet. Create the first one.',
  },
  emptyPast: { ko: '아직 지난 모임이 없어요.', en: 'No past meetups yet.' },
  secWhen: { ko: '언제', en: 'When' },
  secWhere: { ko: '어디서', en: 'Where' },
  secWho: { ko: '함께', en: 'Who' },
  secTitle: { ko: '무엇을', en: 'What' },
  fieldDate: { ko: '날짜', en: 'Date' },
  fieldStart: { ko: '시작', en: 'Starts' },
  fieldEnd: { ko: '종료', en: 'Ends' },
  capacityPh: { ko: '정원 (선택)', en: 'Capacity (optional)' },
  memoPh: { ko: '메모 (선택) — 준비물, 실력대, 주차 안내 등', en: 'Note (optional) — what to bring, skill level, parking' },
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
  proposedBy: { ko: '{name} 님이 제안한 카테고리예요.', en: 'Suggested by {name}.' },
  createFailed: { ko: '모임 만들기 실패', en: 'Couldn’t create the meetup' },
  createdOnce: {
    ko: '모임을 만들었어요! 구독자들에게 알림이 갔어요.',
    en: 'Meetup created — subscribers have been notified.',
  },
  createdWeekly: {
    ko: '매주 {day}요일 모임으로 만들었어요! 다음 회차는 한 주 전에 자동으로 열려요.',
    en: 'Set to repeat every {day}. The next one opens automatically a week ahead.',
  },
  notifyHint: { ko: '구독자에게 알림이 갑니다', en: 'Subscribers will be notified' },
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
  visibility: 'public' | 'link';
  participants: { id: string; name: string; avatar: string | null }[];
  comments: CommentView[];
}

/** 같은 날짜의 모임을 한 덩어리로 묶는다 (서버가 이미 날짜순으로 준다) */
function groupByDate(list: PostView[]) {
  const out: { date: string; posts: PostView[] }[] = [];
  for (const p of list) {
    const last = out[out.length - 1];
    if (last && last.date === p.date) last.posts.push(p);
    else out.push({ date: p.date, posts: [p] });
  }
  return out;
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

  /** 날짜 헤더 오른쪽에 붙는 짧은 힌트 — 오늘/내일/이번 주 */
  function whenHint(date: string) {
    const today = todayLocal();
    if (date === today) return t(T.today);
    if (date === addDays(today, 1)) return t(T.tomorrow);
    if (date <= addDays(today, 6)) return t(T.thisWeek);
    return null;
  }

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
  const [fPrivate, setFPrivate] = useState(false); // 비공개 — 링크를 아는 사람만

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
    setFPrivate(false);
  }

  // 지난 모임
  const [pastPosts, setPastPosts] = useState<PostView[] | null>(null);
  const [showPast, setShowPast] = useState(false);
  const [loadingPast, setLoadingPast] = useState(false);

  // 펼침 상태 — 댓글, 참여자 명단
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [openPeople, setOpenPeople] = useState<Set<string>>(new Set());

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
    setShowPast(!showPast);
  }

  async function reloadAll() {
    await loadPosts();
    if (pastPosts !== null) await loadPast();
  }

  function toggleIn(set: Set<string>, id: string) {
    const s = new Set(set);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return s;
  }

  useEffect(() => {
    Promise.all([
      loadPosts(),
      // 탭 라벨에 개수를 바로 띄우려면 눌리기 전에 받아 둬야 한다 (최대 30개짜리 조회다)
      loadPast(),
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
    ])
      .then(([, , auth, sub]) => {
        setUser(auth.user ?? null);
        setIsAdmin(Boolean(auth.isAdmin));
        setSubscribed((sub.subscriptions ?? []).includes(slug));
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // 만들기 패널이 열려 있는 동안은 뒤 페이지가 스크롤되지 않게 잠근다
  const panelOpen = showForm || editId !== null;
  useEffect(() => {
    if (!panelOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [panelOpen]);

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

  /** 날짜 헤더의 ＋ — 그 날짜를 미리 채운 채로 만들기 패널을 연다 */
  function openCreate(date?: string) {
    setEditId(null);
    resetForm();
    if (date) setFDate(date);
    setShowForm(true);
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
          visibility: fPrivate ? 'link' : 'public',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.createFailed));
      setMsg({
        type: 'ok',
        text: data.repeatWeekly ? t(T.createdWeekly, { day: weekdayLabel(fDate) }) : t(T.createdOnce),
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
    setFPrivate(post.visibility === 'link');
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
          visibility: fPrivate ? 'link' : 'public',
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

  return (
    <>
      <div className="feed-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="feed-dot" style={{ background: color }} />
          <h1 style={{ margin: 0 }}>{name}</h1>
        </div>
        <button
          className={`sub-text ${subscribed ? 'on' : ''}`}
          onClick={toggleSub}
          aria-pressed={subscribed}
          style={subscribed ? { color } : undefined}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 3h15z" />
            <path d="M10 21h4" />
          </svg>
          {subscribed ? t(T.subscribed) : t(T.subscribe)}
        </button>
      </div>

      {category?.proposedBy && (
        <p className="feed-credit" style={{ background: color, color: category.fg }}>
          <span className="feed-credit-icon" aria-hidden>
            ✦
          </span>
          {t(T.proposedBy, { name: category.proposedBy })}
        </p>
      )}

      <div className="feed-tabs">
        <button className={showPast ? '' : 'on'} onClick={() => setShowPast(false)}>
          {t(T.tabUpcoming, { n: posts.length })}
        </button>
        <button className={showPast ? 'on' : ''} onClick={togglePast}>
          {pastPosts ? t(T.tabPast, { n: pastPosts.length }) : t(T.tabPastPlain)}
        </button>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {!showPast && (
        <>
          {posts.length === 0 && (
            <div className="feed-empty">
              {t(T.emptyUpcoming)}
              {user && (
                <button className="new-inline" onClick={() => openCreate()}>
                  {t(T.newMeetupWide)}
                </button>
              )}
            </div>
          )}
          {groupByDate(posts).map((group) => renderGroup(group, false))}
          {user && posts.length > 0 && (
            <button className="new-inline" onClick={() => openCreate()}>
              {t(T.newMeetupWide)}
            </button>
          )}
        </>
      )}

      {showPast &&
        (loadingPast ? (
          <p className="subtitle">{t(T.loading)}</p>
        ) : (pastPosts ?? []).length === 0 ? (
          <div className="feed-empty">{t(T.emptyPast)}</div>
        ) : (
          groupByDate(pastPosts ?? []).map((group) => renderGroup(group, true))
        ))}

      {panelOpen && renderCreatePanel()}
    </>
  );

  function renderGroup(group: { date: string; posts: PostView[] }, past: boolean) {
    const hint = past ? null : whenHint(group.date);
    return (
      <section className="day-block" key={`${past ? 'past-' : ''}${group.date}`}>
        <div className="day-head">
          <h2 className="day-title">
            {dateLabel(group.date)}
            {hint && <span className="day-hint">{hint}</span>}
          </h2>
          {user && !past && (
            <button className="link-btn" onClick={() => openCreate(group.date)}>
              {t(T.newMeetup)}
            </button>
          )}
        </div>
        {group.posts.map((post) => renderPost(post, past))}
      </section>
    );
  }

  /** 모임 만들기 / 수정 — 전체 화면 패널 */
  function renderCreatePanel() {
    const isCreate = !editId;
    const onSave = isCreate ? createPost : saveEditPost;
    const onCancel = () => {
      setShowForm(false);
      setEditId(null);
      resetForm();
    };
    const canSave = Boolean(fDate && fStart && fEnd && fLocation.trim());
    return (
      <div className="create-panel" role="dialog" aria-modal="true">
        <div className="create-head">
          <button className="icon-btn" onClick={onCancel} aria-label={t(T.cancel)}>
            ‹
          </button>
          <strong className="create-title">{isCreate ? t(T.newMeetupTitle) : t(T.editMeetupTitle)}</strong>
          <span className="create-cat">
            <span className="feed-dot" style={{ background: color, width: 8, height: 8 }} />
            {name}
          </span>
        </div>

        <div className="create-body">
          {titleLabel && (
            <div className="form-section">
              <div className="field-label">{t(T.secTitle)}</div>
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
                            {[
                              r.mediaType === 'tv' ? t(T.tv) : t(T.movie),
                              r.year,
                              r.rating ? `★ ${r.rating.toFixed(1)}` : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {fTitleMeta && (
                <div className="title-meta-box" style={{ marginTop: 10, marginBottom: 0 }}>
                  {fTitleMeta.posterPath && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`${TMDB_IMG}/w154${fTitleMeta.posterPath}`} alt="" />
                  )}
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      〈{fTitleMeta.title}〉{fTitleMeta.year ? ` (${fTitleMeta.year})` : ''}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>
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
                  <button className="link-btn danger-text" style={{ marginLeft: 'auto', flex: 'none' }} onClick={() => setFTitleMeta(null)}>
                    {t(T.clearPick)}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="form-section">
            <div className="field-label">{t(T.secWhen)}</div>
            <label className="stack-field">
              <span className="stack-label">{t(T.fieldDate)}</span>
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </label>
            <div className="field-row" style={{ marginTop: 8 }}>
              <label className="stack-field">
                <span className="stack-label">{t(T.fieldStart)}</span>
                <input type="time" value={fStart} onChange={(e) => setFStart(e.target.value)} />
              </label>
              <label className="stack-field">
                <span className="stack-label">{t(T.fieldEnd)}</span>
                <input type="time" value={fEnd} onChange={(e) => setFEnd(e.target.value)} />
              </label>
            </div>
            {isCreate && (
              <label className="repeat-check" style={{ marginTop: 6 }}>
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

          <div className="form-section">
            <div className="field-label">{t(T.secWhere)}</div>
            <input
              type="text"
              placeholder={locationPlaceholder}
              value={fLocation}
              maxLength={100}
              onChange={(e) => setFLocation(e.target.value)}
            />
          </div>

          <div className="form-section">
            <div className="field-label">{t(T.secWho)}</div>
            <input
              type="number"
              placeholder={t(T.capacityPh)}
              value={fCapacity}
              min={2}
              max={99}
              onChange={(e) => setFCapacity(e.target.value)}
            />
            <textarea
              placeholder={t(T.memoPh)}
              value={fMemo}
              maxLength={500}
              rows={3}
              onChange={(e) => setFMemo(e.target.value)}
              style={{ marginTop: 8 }}
            />
            <label className="repeat-check" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={fPrivate} onChange={(e) => setFPrivate(e.target.checked)} />
              <span>
                {t(T.privateToggle)}
                <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> {t(T.privateHint)}</span>
              </span>
            </label>
          </div>
        </div>

        <div className="create-foot">
          <button className="big-cta" disabled={busy || !canSave} onClick={onSave}>
            {busy ? t(T.saving) : isCreate ? t(T.create) : t(T.save)}
          </button>
          {isCreate && (
            <div className="create-hint">{fPrivate ? t(T.notifyHintPrivate) : t(T.notifyHint)}</div>
          )}
        </div>
      </div>
    );
  }

  function renderPost(post: PostView, past: boolean) {
    const joined = user ? post.participants.some((p) => p.id === user.id) : false;
    const mine = user?.id === post.authorId;
    const full = post.capacity != null && post.participants.length >= post.capacity;
    const commentsOpen = openComments.has(post.id);
    const peopleOpen = openPeople.has(post.id);
    const canJoin = !past && (!mine || post.recurringRuleId);
    // 이름 줄을 얼굴로 바꾼 만큼 자리가 넉넉해져 10명까지 보여준다 (겹쳐 놓아서 폭은 얼마 안 든다)
    const shown = post.participants.slice(0, 10);
    const left = post.capacity != null ? post.capacity - post.participants.length : null;
    // 참여자 이름 요약 — 나는 "나"로 바꿔 한 줄에 더 들어가게 한다
    const namesLine = post.participants
      .map((p) => (user && p.id === user.id ? t(T.me) : p.name))
      .join(', ');

    return (
      <article key={post.id} className={`post-card ${past ? 'past' : ''}`}>
        <div className="post-when">
          {to12h(post.startTime)} – {to12h(post.endTime)}
          {post.visibility === 'link' && <span className="repeat-badge private">{t(T.privateBadge)}</span>}
          {post.recurringRuleId && (
            <span className="repeat-badge">{t(T.repeatBadge, { day: weekdayLabel(post.date) })}</span>
          )}
        </div>

        {post.title && <div className="post-title">〈{post.title}〉</div>}
        {post.titleMeta && (
          <div className="post-titlemeta">
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
          </div>
        )}
        <div className="post-meta">
          <PlaceLink location={post.location} /> · {post.authorName}
        </div>
        {post.description && <div className="post-desc">“{post.description}”</div>}

        {/* 참여자 — 눌러서 전체 명단을 펼친다 */}
        <button
          className={`people-row ${peopleOpen ? 'open' : ''}`}
          onClick={() => setOpenPeople((s) => toggleIn(s, post.id))}
          aria-expanded={peopleOpen}
          /* 얼굴만 보이는 줄이라, 읽어 주는 기계에는 이름을 그대로 넘긴다 */
          aria-label={namesLine || undefined}
        >
          <span className="ava-stack" aria-hidden="true">
            {shown.map((p) => (
              <span className={`ava ${user && p.id === user.id ? 'me' : ''}`} key={p.id} title={p.name}>
                {p.avatar ? <img src={p.avatar} alt="" /> : p.name.slice(0, 1)}
              </span>
            ))}
            {post.participants.length > shown.length && (
              <span className="ava more">+{post.participants.length - shown.length}</span>
            )}
          </span>
          <span className="people-count">
            {post.capacity != null
              ? t(T.peopleCap, { n: post.participants.length, cap: post.capacity })
              : t(T.people, { n: post.participants.length })}
            <span className="caret" aria-hidden="true">
              {peopleOpen ? '▴' : '▾'}
            </span>
          </span>
        </button>
        {peopleOpen && (
          <div className="people-list">
            {post.participants.map((p) => (
              <span className="person-chip" key={p.id}>
                {p.name}
                {user && p.id === user.id ? ` (${t(T.me)})` : ''}
              </span>
            ))}
            {left != null && left > 0 && <span className="person-chip open-seat">{t(T.seats, { n: left })}</span>}
          </div>
        )}

        <div className="post-actions">
          <button
            className={`link-btn ${commentsOpen ? 'strong' : ''}`}
            onClick={() => setOpenComments((s) => toggleIn(s, post.id))}
            aria-expanded={commentsOpen}
          >
            {t(T.comments)}
            {post.comments.length > 0 ? ` ${post.comments.length}` : ''}
            <span className="caret" aria-hidden="true">
              {commentsOpen ? '▴' : '▾'}
            </span>
          </button>
          {!past && (
            <button className="link-btn" disabled={busy} onClick={() => share(post)}>
              {t(T.share)}
            </button>
          )}
          {(mine || isAdmin) && !past && (
            <button className="link-btn" disabled={busy} onClick={() => startEditPost(post)}>
              {t(T.edit)}
            </button>
          )}
          {canJoin && (
            <button
              className={`join-text ${joined ? 'joined' : ''}`}
              disabled={busy || (!joined && full)}
              onClick={() => join(post)}
            >
              {joined ? t(T.leave) : full ? t(T.full) : t(T.join)}
            </button>
          )}
        </div>

        {(mine || isAdmin) && (
          <div className="post-owner-actions">
            {!past && post.recurringRuleId && (
              <button className="link-btn" disabled={busy} onClick={() => stopRepeat(post)}>
                {t(T.stopRepeat)}
              </button>
            )}
            <button className="link-btn danger-text" disabled={busy} onClick={() => remove(post)}>
              {t(T.del)}
            </button>
          </div>
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
      </article>
    );
  }
}
