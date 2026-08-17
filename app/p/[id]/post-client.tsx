'use client';

import Link from 'next/link';
import { AddFriendSheet, Person } from '../../friend-sheet';
import PlaceLink from '@/app/place-link';
import { useEffect, useState } from 'react';
import { catDisplayName, getCategory, isAnonymous } from '@/lib/categories';
import { useLocale, useT } from '../../i18n';
import { dateLabel as fmtDate, timeLabel as fmtTime, weekdayLabel as fmtWeekday, whenLabelShort, WHEN_TBD } from '@/lib/datefmt';
import { effectiveEnd } from '@/lib/dates';

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…', es: 'Cargando…' },
  notFound: { ko: '모임을 찾을 수 없어요', en: 'Meetup not found', es: 'Quedada no encontrada' },
  notFoundDesc: {
    ko: '링크가 잘못됐거나 이미 취소된 모임이에요.',
    en: 'The link is wrong or the meetup was cancelled.',
    es: 'El enlace no es válido o la quedada se canceló.',
  },
  home: { ko: '홈으로 →', en: 'Go home →', es: 'Ir al inicio →' },
  allMeetups: { ko: '전체 모임 보기 →', en: 'See all meetups →', es: 'Ver todas las quedadas →' },
  requestFailed: { ko: '요청 실패', en: 'Request failed', es: 'La solicitud falló' },
  joined: { ko: '참가 완료! 모임에서 만나요.', en: 'You’re in — see you there!', es: '¡Ya estás dentro, nos vemos allí!' },
  copied: {
    ko: '모임 링크를 복사했어요. 카톡에 붙여넣어 공유하세요!',
    en: 'Link copied — paste it in a chat to share.',
    es: 'Enlace copiado: pégalo en un chat para compartirlo.',
  },
  meetupSuffix: { ko: '{cat}{title} 모임', en: '{cat}{title} meetup', es: 'quedada de {cat}{title}' },
  gcalDetails: { ko: '모임 페이지: {url}', en: 'Meetup page: {url}', es: 'Página de la quedada: {url}' },
  creator: { ko: '크리에이터', en: 'Creator', es: 'Creador' },
  director: { ko: '감독', en: 'Director', es: 'Dirección' },
  cast: { ko: '출연 {names}', en: 'Cast {names}', es: 'Reparto {names}' },
  repeatBadge: { ko: '매주 {day}', en: 'Every {day}', es: 'Cada {day}' },
  gathering: { ko: '모이는 중', en: 'Gathering', es: 'Reuniendo gente' },
  people: { ko: '{n}명 참여', en: '{n} joined', es: '{n} apuntados' },
  peopleCap: { ko: '{n}/{cap}명 참여', en: '{n}/{cap} joined', es: '{n}/{cap} apuntados' },
  pastSuffix: { ko: ' — 지난 모임', en: ' — past meetup', es: ' — quedada pasada' },
  fullSuffix: { ko: ' — 마감', en: ' — full', es: ' — completo' },
  me: { ko: ' (나)', en: ' (you)', es: ' (tú)' },
  mine: { ko: '내가 만든 모임이에요.', en: 'You created this meetup.', es: 'Tú creaste esta quedada.' },
  join: { ko: '참가하기 →', en: 'Join →', es: 'Apuntarme →' },
  leave: { ko: '참가 취소', en: 'Leave', es: 'Salir' },
  joinTermsOk: { ko: '확인했어요, 참가할게요', en: 'Got it — count me in', es: 'Entendido, me apunto' },
  full: { ko: '마감', en: 'Full', es: 'Completo' },
  loginAndJoin: { ko: '카카오 로그인하고 참가하기', en: 'Log in with Kakao to join', es: 'Entra con Kakao para apuntarte' },
  shareLink: { ko: '링크 공유', en: 'Share link', es: 'Compartir enlace' },
  gcal: { ko: 'Google 캘린더', en: 'Google Calendar', es: 'Google Calendar' },
  ics: { ko: '캘린더 파일(.ics)', en: 'Calendar file (.ics)', es: 'Archivo de calendario (.ics)' },
  comments: { ko: '댓글', en: 'Comments', es: 'Comentarios' },
  del: { ko: '삭제', en: 'Delete', es: 'Eliminar' },
  roster: { ko: '명단 고치기', en: 'Edit roster', es: 'Editar la lista' },
  lodging: { ko: '숙소', en: 'Stay', es: 'Alojamiento' },
};
import type { PostView } from '@/lib/db/posts';
import { TMDB_IMG } from '@/lib/tmdb';
import CommentThread from '../../comment-thread';
import SettlementPanel from '../../settlement-panel';
import TranslateLine from '../../translate-line';
import RatingPanel from '../../rating-panel';
import PhotoPanel from '../../photo-panel';
import ReviewPanel, { type ReviewItem } from '../../review-panel';
import TermsPopup from '../../terms-popup';
import { siteUrl } from '@/lib/site';
import { useRefreshSession, useViewer } from '../../session';

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

/* 캘린더로 보내는 두 아이콘 — 탭바와 같은 규격(24 격자, 굵기 1.8, 둥근 끝) */
const calIcon = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** 구글 캘린더 — 달력에 + */
function GoogleCalIcon() {
  return (
    <svg {...calIcon} width="20" height="20">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M12 13v5M9.5 15.5h5" />
    </svg>
  );
}

/** .ics 파일 — 달력에서 내려받기 */
function IcsIcon() {
  return (
    <svg {...calIcon} width="20" height="20">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
      <path d="M12 13v5M9.7 16.3 12 18.5l2.3-2.2" />
    </svg>
  );
}

/** 서버가 페이지를 그리면서 미리 읽어 둔 것 (page.tsx) */
export interface PostInitial {
  post: PostView | null;
  /** 관리자만 — 회원 전체 (명단에 넣을 후보) */
  members: Person[];
  /** 호스트가 지난 모임 명단을 고칠 때 고르는 후보 — 내 친구들 */
  friends: Person[];
  /** 밖으로 나가는 링크(캘린더·공유)에 쓸 공개 주소 — 서버가 정한다 */
  origin: string;
  /** 누가 몇 점 줬는지 (무비나잇이고 끝난 모임일 때만 채워진다) */
  ratings: { userId: string; score: number }[];
  /** 모임 사진 (끝난 모임 + 로그인일 때만) */
  photos: { id: string; userId: string; url: string }[];
  /** 그 모임의 후기 (끝난 모임일 때만) — 읽는 것은 회원 누구나 */
  reviews: ReviewItem[];
}

export default function PostClient({ id, initial }: { id: string; initial: PostInitial }) {
  const [post, setPost] = useState<PostView | null>(initial.post);
  // 세션은 레이아웃이 서버에서 읽어 둔 것을 쓴다
  const viewer = useViewer();
  const refresh = useRefreshSession();
  const user = viewer.user;
  const isAdmin = viewer.isAdmin;
  const members = initial.members;
  const friends = initial.friends;
  const [rosterOpen, setRosterOpen] = useState(false);
  const myVenmo = viewer.venmo;
  const myZelle = viewer.zelle;
  const [busy, setBusy] = useState(false);
  /** 참가 전에 띄우는 약속 창 (그런 카테고리에서만) */
  const [termsOpen, setTermsOpen] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const t = useT();
  const locale = useLocale();
  const dateLabel = (d: string) => fmtDate(d, locale);
  const to12h = (time: string) => fmtTime(time, locale);

  /**
   * 모임을 다시 읽는다 — 서버 렌더를 다시 돌려 새 prop을 받는다.
   *
   * 서버가 이미 읽어 주므로 여기서 /api/posts/[id]를 또 부를 이유가 없다.
   * 새 값은 아래 이펙트가 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다).
   */
  function loadPost() {
    refresh();
  }

  useEffect(() => {
    setPost(initial.post);
  }, [initial]);

  /**
   * 참가 버튼 — 약속을 받는 카테고리(독서나눔)에서는 들어올 때 한 번 읽힌다.
   * 카테고리 목록 쪽과 같은 규칙이다 (app/c/[category]/category-client.tsx).
   */
  function onJoinButton() {
    if (!post || !user) return;
    const already = post.participants.some((p) => p.id === user.id);
    if (!already && (cat?.signup?.terms?.length ?? 0) > 0) {
      setTermsOpen(true);
      return;
    }
    void join();
  }

  async function join() {
    if (!post || !user) return;
    setTermsOpen(false);
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
    loadPost();
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

  if (!post) {
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
  const full = post.capacity != null && post.participantCount >= post.capacity;
  // 브라우저 시간대가 아니라 서버(앱 시간대) 판정을 쓴다 — 다른 지역에서 열어도 같은 결과
  const past = post.isPast;
  const loginNext = `/api/auth/login?next=${encodeURIComponent(`/p/${id}`)}`;

  // Google 캘린더 추가 링크 (ctz로 모임 시간대 고정)
  // 캘린더 제목에는 이모지 없는 이름을 쓴다 (.ics 쪽이 이모지를 앞에 따로 붙인다)
  const catLabel = cat ? t(cat.name) : post.category;
  const catHeading = cat ? t(catDisplayName(cat.slug)) : post.category;
  const gcalTitle = t(T.meetupSuffix, { cat: catLabel, title: post.title ? ` 〈${post.title}〉` : '' });
  /*
   * 날짜 미정(사람부터 모으는 모임)은 캘린더에 넣을 수 없다 — 링크 자체를 만들지 않고
   * 아래에서 캘린더 버튼을 통째로 감춘다. 오늘로 채워 넣으면 남의 달력이 거짓말을 한다.
   */
  const scheduled = Boolean(post.date && post.startTime);
  // 구글 캘린더도 끝 시각을 요구한다 — 안 적은 모임은 짐작한 길이로 채운다
  const gcalEnd = effectiveEnd(post.startTime ?? '00:00', post.endTime);
  const gcalDates = scheduled
    ? `${post.date!.replace(/-/g, '')}T${post.startTime!.replace(':', '')}00/${post.date!.replace(/-/g, '')}T${gcalEnd.replace(':', '')}00`
    : '';
  const gcalUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(gcalTitle)}` +
    `&dates=${gcalDates}&ctz=America/Chicago` +
    `&location=${encodeURIComponent(post.location)}` +
    `&details=${encodeURIComponent(
      t(T.gcalDetails, { url: `${initial.origin}/p/${id}` })
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
          {/*
            * 며칠 이어지는 모임(여행)은 시각이 없다 — 날짜 범위를 그린다.
            * 시각이 있는 모임과 갈라 두는 이유: 없는 시각을 「오전 12:00」으로 그리면
            * 아무도 안 정한 시각이 정해진 것처럼 보인다.
            */}
          {post.date && post.endDate && post.endDate > post.date ? (
            <>
              {dateLabel(post.date)} ~ {dateLabel(post.endDate)}
            </>
          ) : post.date && !post.startTime ? (
            // 시각을 안 받는 카테고리의 당일치기
            <>{dateLabel(post.date)}</>
          ) : post.date && post.startTime ? (
            <>
              {dateLabel(post.date)} {to12h(post.startTime)}
              {post.endTime ? ` ~ ${to12h(post.endTime)}` : ''}
              {/* 규칙이 살아 있을 때만 — 중단한 뒤에도 회차에는 규칙 id가 남는다 */}
              {post.repeatsOn && (
                <span className="repeat-badge">{t(T.repeatBadge, { day: fmtWeekday(post.date, locale) })}</span>
              )}
            </>
          ) : (
            /* 날짜 자리를 비우지 않는다 — 비어 있으면 안 불러온 것처럼 보인다 */
            <>
              {t(WHEN_TBD)}
              <span className="repeat-badge">{t(T.gathering)}</span>
            </>
          )}
        </div>
        <div style={{ marginTop: 8, fontSize: 15.5 }}>
          <PlaceLink location={post.location} />
          {post.authorName && <> — {post.authorName}</>}
        </div>
        {/*
          * 숙소 — 장소와 한 줄에 붙이지 않는다. 「어디로 모여요」와 「어디서 자요」는
          * 다른 질문이라, 붙여 놓으면 출발 아침에 둘 중 어디로 갈지 헷갈린다.
          */}
        {post.lodging && (
          <div style={{ marginTop: 4, fontSize: 15.5 }}>
            <span style={{ color: 'var(--text-dim)' }}>{t(T.lodging)} </span>
            <PlaceLink location={post.lodging} />
          </div>
        )}
        {post.description && (
          <div style={{ marginTop: 8, color: 'var(--text-dim)' }}>“{post.description}”</div>
        )}
        <TranslateLine text={[post.title, post.description].filter(Boolean).join('\n')} />
        <div className="post-people" style={{ marginTop: 14, fontWeight: 700, color }}>
          {post.capacity != null
            ? t(T.peopleCap, { n: post.participantCount, cap: post.capacity })
            : t(T.people, { n: post.participantCount })}
          {past ? t(T.pastSuffix) : full ? t(T.fullSuffix) : ''}
        </div>
        {post.participants.length > 0 && (
          <div style={{ marginTop: 6, color: 'var(--text-dim)' }}>
            {post.participants.map((p) => p.name + (user?.id === p.id ? t(T.me) : '')).join(', ')}
          </div>
        )}
        {/*
          * 캘린더나 공유 링크로 들어오면 이 화면이라, 명단을 고칠 자리가 여기에도 있어야 한다.
          * 지난 모임에서도 보인다 — 뒤늦게 바로잡는 일이 대부분 지난 모임이다.
          */}
        {!cat?.anonymous && (isAdmin || (past && (mine || post.coHost?.id === user?.id))) && (
          <button className="link-btn" style={{ marginTop: 8 }} onClick={() => setRosterOpen(true)}>
            {t(T.roster)}
          </button>
        )}

        <div className="field-row" style={{ marginTop: 20 }}>
          {past ? null : user ? (
            mine ? (
              <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{t(T.mine)}</span>
            ) : (
              <button disabled={busy || (!joined && full)} onClick={onJoinButton}>
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
          {/*
            * 캘린더에 넣는 두 길은 글자보다 그림이 빠르다 — 줄에서 자리도 덜 먹는다.
            * 무엇인지는 aria-label과 title에 남긴다(화면 읽어주는 기기·데스크톱 툴팁).
            * 둘을 한 묶음으로 두는 이유 — 좁은 폰에서 줄이 바뀔 때 하나만 떨어져 나가면
            * 남은 아이콘이 무슨 짝인지 알 수 없다.
            */}
          {/* 날짜가 없으면 캘린더에 넣을 것도 없다 — 버튼을 눌러 봐야 할 수 있는 일이 없다 */}
          {!past && scheduled && (
            <span style={{ display: 'inline-flex' }}>
              <a
                className="icon-link"
                href={gcalUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={t(T.gcal)}
                title={t(T.gcal)}
              >
                <GoogleCalIcon />
              </a>
              <a className="icon-link" href={`/api/posts/${id}/ics`} aria-label={t(T.ics)} title={t(T.ics)}>
                <IcsIcon />
              </a>
            </span>
          )}
        </div>
      </div>

      {rosterOpen && !cat?.anonymous && (
        <AddFriendSheet
          postId={post.id}
          candidates={(isAdmin ? members : friends).filter((m) => !post.participants.some((p) => p.id === m.id))}
          roster={post.participants.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar }))}
          {...(isAdmin ? { asAdmin: true } : {})}
          onClose={() => setRosterOpen(false)}
          onDone={loadPost}
        />
      )}

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {/* 평점은 끝난 무비나잇에만 붙는다 — post.rating이 있는지가 곧 그 판정이다(서버가 정한다) */}
      {post.rating && (
        <RatingPanel
          postId={post.id}
          summary={post.rating}
          scores={initial.ratings}
          participants={post.participants.map((p) => ({ id: p.id, name: p.name }))}
          {...(user ? { currentUserId: user.id } : {})}
        />
      )}

      {/*
        * 사진은 아무 때나 올린다 — 가기 전 안내문도, 다녀와서 찍은 것도 같은 자리에 쌓인다.
        *
        * 참가한 사람에게만 보인다. 판단은 명단으로 한다 — post.photos로 막으면 아직 한 장도
        * 없는 모임에서 패널이 통째로 사라져 첫 장을 올릴 길이 없어진다(그 값은 「볼 수 있느냐」가
        * 아니라 「있느냐」다). 서버도 같은 기준으로 사진을 내려준다.
        */}
      {user && (joined || isAdmin || post.photosPublic) && (
        <PhotoPanel
          postId={post.id}
          photos={initial.photos}
          participants={post.participants.map((p) => ({ id: p.id, name: p.name }))}
          isHost={post.authorId === user.id || post.coHost?.id === user.id}
          isAdmin={isAdmin}
          currentUserId={user.id}
          label={`${catLabel}${post.title ? ` 〈${post.title}〉` : ''}`}
          photosPublic={post.photosPublic}
          isPrivate={post.visibility === 'link'}
          isAnon={isAnonymous(post.category)}
          canOpen={post.authorId === user.id || post.coHost?.id === user.id || isAdmin}
          timeline={Boolean(cat?.timeline)}
          lodgingAt={
            post.lodgingLat != null && post.lodgingLon != null
              ? { lat: post.lodgingLat, lon: post.lodgingLon }
              : null
          }
        />
      )}

      {/*
       * noteLabel은 Venmo 메모의 머리말이다 — 「무비나잇 Boyhood 8/8(금)」.
       * 〈 〉는 뺐다. 앱 화면에서는 제목을 감싸 주는 표시지만, 메모 한 줄에서는 자리만
       * 먹고 어떤 글꼴에서는 네모로 깨진다. 날짜도 짧은 쪽을 쓴다 (뒤에 항목이 붙는다).
       */}
      {/* 익명 카테고리에는 정산이 없다 — 금액 옆에 명단이 통째로 나온다 (서버도 403) */}
      {!cat?.anonymous && (
      <SettlementPanel
        postId={post.id}
        participants={post.participants.map((p) => ({ id: p.id, name: p.name }))}
        {...(user ? { currentUserId: user.id } : {})}
        isAdmin={isAdmin}
        myVenmo={myVenmo}
        myZelle={myZelle}
        noteLabel={`${catLabel}${post.title ? ` ${post.title}` : ''} ${whenLabelShort(post.date, post.startTime, locale, post.endDate)}`}
      />
      )}

      {/*
       * 후기 — 끝난 모임에만. 읽는 것은 회원 누구나이고, 쓰는 것은 다녀온 사람만이다.
       * 정산·사진과 달리 참가자로 좁히지 않는 이유는 이 글이 「다음에 가볼까」를 돕는
       * 자리라서다. 서버도 같은 조건을 다시 본다 (app/api/posts/[id]/review/route.ts).
       */}
      {past && (
        <ReviewPanel postId={post.id} reviews={initial.reviews} canWrite={Boolean(user) && joined} />
      )}

      <h2>{t(T.comments)} {post.commentCount > 0 ? post.commentCount : ''}</h2>
      <CommentThread
        postId={post.id}
        comments={post.comments}
        lockedCount={post.commentCount - post.comments.length}
        alwaysAnonymous={cat?.anonymous === true}
        {...(user ? { currentUserId: user.id } : {})}
        isAdmin={isAdmin}
        onChanged={loadPost}
        onError={(text) => setMsg({ type: 'err', text })}
      />
      {termsOpen && cat?.signup && (
        <TermsPopup
          terms={cat.signup.terms}
          tag={t(T.join)}
          okLabel={t(T.joinTermsOk)}
          busy={busy}
          onConfirm={() => void join()}
          onClose={() => setTermsOpen(false)}
        />
      )}

    </>
  );
}
