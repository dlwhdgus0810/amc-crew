'use client';

import Link from 'next/link';
import PlaceLink from '@/app/place-link';
import { useEffect, useState } from 'react';
import { catDisplayName, getCategory } from '@/lib/categories';
import { useLocale, useT } from '../../i18n';
import { dateLabel as fmtDate, timeLabel as fmtTime, weekdayLabel as fmtWeekday } from '@/lib/datefmt';

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  notFound: { ko: '모임을 찾을 수 없어요', en: 'Meetup not found' },
  notFoundDesc: {
    ko: '링크가 잘못됐거나 이미 취소된 모임이에요.',
    en: 'The link is wrong or the meetup was cancelled.',
  },
  home: { ko: '홈으로 →', en: 'Go home →' },
  allMeetups: { ko: '전체 모임 보기 →', en: 'See all meetups →' },
  requestFailed: { ko: '요청 실패', en: 'Request failed' },
  joined: { ko: '참가 완료! 모임에서 만나요.', en: 'You’re in — see you there!' },
  copied: {
    ko: '모임 링크를 복사했어요. 카톡에 붙여넣어 공유하세요!',
    en: 'Link copied — paste it in a chat to share.',
  },
  meetupSuffix: { ko: '{cat}{title} 모임', en: '{cat}{title} meetup' },
  gcalDetails: { ko: '모임 페이지: {url}', en: 'Meetup page: {url}' },
  creator: { ko: '크리에이터', en: 'Creator' },
  director: { ko: '감독', en: 'Director' },
  cast: { ko: '출연 {names}', en: 'Cast {names}' },
  repeatBadge: { ko: '매주 {day}', en: 'Every {day}' },
  people: { ko: '{n}명 참여', en: '{n} joined' },
  peopleCap: { ko: '{n}/{cap}명 참여', en: '{n}/{cap} joined' },
  pastSuffix: { ko: ' — 지난 모임', en: ' — past meetup' },
  fullSuffix: { ko: ' — 마감', en: ' — full' },
  me: { ko: ' (나)', en: ' (you)' },
  mine: { ko: '내가 만든 모임이에요.', en: 'You created this meetup.' },
  join: { ko: '참가하기 →', en: 'Join →' },
  leave: { ko: '참가 취소', en: 'Leave' },
  full: { ko: '마감', en: 'Full' },
  loginAndJoin: { ko: '카카오 로그인하고 참가하기', en: 'Log in with Kakao to join' },
  shareLink: { ko: '링크 공유', en: 'Share link' },
  gcal: { ko: 'Google 캘린더', en: 'Google Calendar' },
  ics: { ko: '캘린더 파일(.ics)', en: 'Calendar file (.ics)' },
  comments: { ko: '댓글', en: 'Comments' },
  del: { ko: '삭제', en: 'Delete' },
};
import type { PostView } from '@/lib/db/posts';
import { TMDB_IMG } from '@/lib/tmdb';
import CommentThread from '../../comment-thread';
import SettlementPanel from '../../settlement-panel';
import { siteUrl } from '@/lib/site';

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

export default function PostClient({ id }: { id: string }) {
  const [post, setPost] = useState<PostView | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myVenmo, setMyVenmo] = useState<string | null>(null);
  const [myZelle, setMyZelle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const t = useT();
  const locale = useLocale();
  const dateLabel = (d: string) => fmtDate(d, locale);
  const to12h = (time: string) => fmtTime(time, locale);

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
        setMyVenmo(auth.venmo ?? null);
        setMyZelle(auth.zelle ?? null);
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
      setMsg({ type: 'err', text: data.error ?? t(T.requestFailed) });
    } else if (!joined) {
      setMsg({ type: 'ok', text: t(T.joined) });
    }
    await loadPost();
    setBusy(false);
  }



  async function copyLink() {
    const url = `${siteUrl(window.location.origin)}/p/${id}`;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setMsg({ type: 'ok', text: t(T.copied) });
    } catch {
      /* 사용자가 공유 시트를 닫은 경우 등 */
    }
  }

  if (loading) return <p className="subtitle">{t(T.loading)}</p>;

  if (notFound || !post) {
    return (
      <>
        <h1>{t(T.notFound)}</h1>
        <p className="subtitle">{t(T.notFoundDesc)}</p>
        <Link href="/" className="profile-link">{t(T.home)}</Link>
      </>
    );
  }

  const cat = getCategory(post.category);
  const color = cat?.color ?? '#101010';
  const joined = user ? post.participants.some((p) => p.id === user.id) : false;
  const mine = user?.id === post.authorId;
  const full = post.capacity != null && post.participants.length >= post.capacity;
  // 브라우저 시간대가 아니라 서버(앱 시간대) 판정을 쓴다 — 다른 지역에서 열어도 같은 결과
  const past = post.isPast;
  const loginNext = `/api/auth/login?next=${encodeURIComponent(`/p/${id}`)}`;

  // Google 캘린더 추가 링크 (ctz로 모임 시간대 고정)
  // 캘린더 제목에는 이모지 없는 이름을 쓴다 (.ics 쪽이 이모지를 앞에 따로 붙인다)
  const catLabel = cat ? t(cat.name) : post.category;
  const catHeading = cat ? t(catDisplayName(cat.slug)) : post.category;
  const gcalTitle = t(T.meetupSuffix, { cat: catLabel, title: post.title ? ` 〈${post.title}〉` : '' });
  const gcalDates = `${post.date.replace(/-/g, '')}T${post.startTime.replace(':', '')}00/${post.date.replace(/-/g, '')}T${post.endTime.replace(':', '')}00`;
  const gcalUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(gcalTitle)}` +
    `&dates=${gcalDates}&ctz=America/Chicago` +
    `&location=${encodeURIComponent(post.location)}` +
    `&details=${encodeURIComponent(
      t(T.gcalDetails, { url: `${siteUrl(typeof window !== 'undefined' ? window.location.origin : '')}/p/${id}` })
    )}`;

  return (
    <>
      <div className="feed-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <h1 style={{ margin: 0 }}>{catHeading}</h1>
          <span className="feed-dot" style={{ background: color }} />
        </div>
        <div className="feed-actions">
          <Link href={`/c/${post.category}`} className="profile-link">
            {t(T.allMeetups)}
          </Link>
        </div>
      </div>

      <div className="card">
        {post.titleMeta ? (
          <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
            {post.titleMeta.posterPath && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`${TMDB_IMG}/w154${post.titleMeta.posterPath}`}
                alt=""
                style={{ width: 72, borderRadius: 8, flex: 'none' }}
              />
            )}
            <div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>
                〈{post.title}〉{post.titleMeta.year ? ` (${post.titleMeta.year})` : ''}
              </div>
              <div style={{ color: 'var(--text-dim)', fontSize: 13.5, marginTop: 4 }}>
                {[
                  post.titleMeta.rating ? `★ ${post.titleMeta.rating.toFixed(1)}` : null,
                  post.titleMeta.director
                    ? `${post.titleMeta.mediaType === 'tv' ? t(T.creator) : t(T.director)} ${post.titleMeta.director}`
                    : null,
                  post.titleMeta.cast?.length ? t(T.cast, { names: post.titleMeta.cast.join(', ') }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>
        ) : (
          post.title && <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>〈{post.title}〉</div>
        )}
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px' }}>
          {dateLabel(post.date)} {to12h(post.startTime)} ~ {to12h(post.endTime)}
          {post.recurringRuleId && (
            <span className="repeat-badge">{t(T.repeatBadge, { day: fmtWeekday(post.date, locale) })}</span>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 15.5 }}>
          <PlaceLink location={post.location} /> — {post.authorName}
        </div>
        {post.description && (
          <div style={{ marginTop: 8, color: 'var(--text-dim)' }}>“{post.description}”</div>
        )}
        <div style={{ marginTop: 14, fontWeight: 700, color }}>
          {post.capacity != null
            ? t(T.peopleCap, { n: post.participants.length, cap: post.capacity })
            : t(T.people, { n: post.participants.length })}
          {past ? t(T.pastSuffix) : full ? t(T.fullSuffix) : ''}
        </div>
        {post.participants.length > 0 && (
          <div style={{ marginTop: 6, color: 'var(--text-dim)' }}>
            {post.participants.map((p) => p.name + (user?.id === p.id ? t(T.me) : '')).join(', ')}
          </div>
        )}

        <div className="field-row" style={{ marginTop: 20 }}>
          {past ? null : user ? (
            mine ? (
              <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{t(T.mine)}</span>
            ) : (
              <button disabled={busy || (!joined && full)} onClick={join}>
                {joined ? t(T.leave) : full ? t(T.full) : t(T.join)}
              </button>
            )
          ) : (
            <a className="kakao-btn" href={loginNext}>
              <KakaoIcon />
              {t(T.loginAndJoin)}
            </a>
          )}
          <button className="secondary" onClick={copyLink}>{t(T.shareLink)}</button>
          {!past && (
            <>
              <a className="profile-link" href={gcalUrl} target="_blank" rel="noreferrer">
                {t(T.gcal)}
              </a>
              <a className="profile-link" href={`/api/posts/${id}/ics`}>
                {t(T.ics)}
              </a>
            </>
          )}
        </div>
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <SettlementPanel
        postId={post.id}
        participants={post.participants.map((p) => ({ id: p.id, name: p.name }))}
        {...(user ? { currentUserId: user.id } : {})}
        isAdmin={isAdmin}
        myVenmo={myVenmo}
        myZelle={myZelle}
        noteLabel={`${catLabel}${post.title ? ` 〈${post.title}〉` : ''} ${dateLabel(post.date)}`}
      />

      <h2>{t(T.comments)} {post.comments.length > 0 ? post.comments.length : ''}</h2>
      <CommentThread
        postId={post.id}
        comments={post.comments}
        {...(user ? { currentUserId: user.id } : {})}
        isAdmin={isAdmin}
        onChanged={loadPost}
        onError={(text) => setMsg({ type: 'err', text })}
      />
    </>
  );
}
