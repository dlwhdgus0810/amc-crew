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
import Link from 'next/link';
import { DEFAULT_LOCATION_HINT, DEFAULT_LOCATION_LABEL, catDisplayName, getCategory } from '@/lib/categories';
import PlaceLink from '@/app/place-link';
import CatIcon from '@/app/cat-icon';
import { hostTier } from '@/lib/hosting';
import {useLocale, useT} from '../../i18n';
import {
  dateLabel as fmtDate,
  dateLabelLong as fmtDateLong,
  timeLabel as fmtTime,
  weekdayLabel as fmtWeekday,
  whenLabelShort,
  WHEN_TBD,
} from '@/lib/datefmt';
import {addDays, todayLocal} from '@/lib/dates';
import type {TitleMeta, TitleSearchResult} from '@/lib/tmdb';
import {TMDB_IMG} from '@/lib/tmdb';
import CommentThread, {CommentView} from '../../comment-thread';
import {AddFriendSheet, FriendRequestSheet, Person, Tie} from '../../friend-sheet';
import {siteUrl} from '@/lib/site';
import {formatCents} from '@/lib/money';
import { formatScore } from '@/lib/ratings';
import { upload } from '@vercel/blob/client';
import { shrinkToJpeg, UnreadableImageError } from '@/lib/photo-client';
import { MAX_PER_BATCH, photoPath } from '@/lib/photos';
import {useRefreshSession, useViewer} from '../../session';
import {usePosterZoom} from '../../poster-zoom';

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
  friendChip: { ko: '친구', en: 'Friend' },
  tabUpcoming: { ko: '예정 {n}', en: 'Upcoming {n}' },
  tabPast: { ko: '지난 모임 {n}', en: 'Past {n}' },
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
  ourRating: { ko: '우리 평점 {score}', en: 'Our rating {score}' },
  rateIt: { ko: '평점 매기기', en: 'Rate it' },
  settleOwe: { ko: '정산 {amount}', en: 'Settle {amount}' },
  settleSee: { ko: '정산 보기', en: 'Settle-up' },
  settleStart: { ko: '정산하기', en: 'Settle up' },
  privateBadge: { ko: '비공개', en: 'Private' },
  notifyHintPrivate: {
    ko: '알림 없이 만들어져요 — 링크를 직접 보내주세요',
    en: 'Created quietly — send the link yourself',
  },
  notifyHintInvite: {
    ko: '고른 친구 {n}명에게만 알림이 가요',
    en: 'Only the {n} friends you picked get an alert',
  },
  inviteLabel: { ko: '알릴 친구', en: 'Tell which friends' },
  inviteNone: { ko: '아직 친구가 없어요. 링크를 직접 보내주세요.', en: 'No friends yet — send the link yourself.' },
  inviteAll: { ko: '전체 선택', en: 'Select all' },
  inviteNoneAll: { ko: '전체 해제', en: 'Clear all' },
  emptyUpcoming: {
    ko: '아직 예정된 모임이 없어요. 첫 모임을 만들어보세요.',
    en: 'No upcoming meetups yet. Create the first one.',
  },
  emptyPast: { ko: '아직 지난 모임이 없어요.', en: 'No past meetups yet.' },
  secWhen: { ko: '언제', en: 'When' },
  secWhere: { ko: '어디서', en: 'Where' },
  secPhoto: { ko: '사진 (선택)', en: 'Photo (optional)' },
  photoPick: { ko: '사진 고르기', en: 'Choose a photo' },
  photoBusy: { ko: '올리는 중…', en: 'Uploading…' },
  photoClear: { ko: '떼기', en: 'Remove' },
  photoHint: {
    ko: '안내문이든 쿠폰이든 한 장. 모임 카드에 보여요. 나머지는 만든 뒤에 더 올릴 수 있어요.',
    en: 'A flyer, a coupon, anything — it shows on the meetup card. Add more once it’s created.',
  },
  photoHintEdit: {
    ko: '고르는 즉시 붙고, ✕를 누르면 즉시 빠져요. 저장을 누르지 않아도 돼요.',
    en: 'Added the moment you pick one, removed the moment you tap ✕ — no need to hit save.',
  },
  photoFailed: { ko: '올리지 못했어요.', en: 'Couldn’t upload that.' },
  photoHeic: {
    ko: '이 사진 형식(HEIC)은 못 읽어요. 아이폰 설정 › 카메라 › 포맷을 「높은 호환성」으로 바꿔주세요.',
    en: 'That photo format (HEIC) can’t be read. Switch iPhone Settings › Camera › Formats to “Most Compatible”.',
  },
  secWho: { ko: '함께', en: 'Who' },
  secTitle: { ko: '무엇을', en: 'What' },
  fieldDate: { ko: '날짜', en: 'Date' },
  fieldStart: { ko: '시작', en: 'Starts' },
  fieldEnd: { ko: '종료 (선택)', en: 'Ends (optional)' },
  capacityPh: { ko: '정원 (선택)', en: 'Capacity (optional)' },
  coHostLabel: { ko: '같이 여는 사람 (선택)', en: 'Co-host (optional)' },
  coHostHint: {
    ko: '한 명까지 고를 수 있어요. 호스트 점수를 반씩 나눠 가져요.',
    en: 'One person. You’ll split the host points evenly.',
  },
  coHostNone: { ko: '친구를 만들면 같이 열 수 있어요.', en: 'Add a friend to co-host with them.' },
  nickToggle: { ko: '닉네임 허용', en: 'Allow nicknames' },
  nickHint: {
    ko: '— 이 모임에서는 닉네임을 정해둔 사람이 닉네임으로 보여요. 기본은 실명이에요',
    en: '— people who set a nickname show up under it, just in this meetup. Real names by default',
  },
  memoPh: { ko: '메모 (선택) — 준비물, 실력대, 주차 안내 등', en: 'Note (optional) — what to bring, skill level, parking' },
  titleSearchPh: { ko: '{label} 제목 검색 (예: 듄: 파트2)', en: 'Search {label} (e.g. Dune: Part Two)' },
  titleFreePh: { ko: '{label} (선택)', en: '{label} (optional)' },
  // 위에 보기가 떠 있으면 "직접 적어도 된다"는 걸 칸이 스스로 말해줘야 한다
  titleOtherPh: { ko: '{label} — 직접 입력', en: '{label} — type your own' },
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
  // 지난 모임을 채워 넣은 것도 알림이 안 나간다 — 같은 이유로 문구를 달리한다
  createdPast: {
    ko: '지난 모임으로 기록했어요. 알림은 가지 않았어요.',
    en: 'Recorded as a past meetup — nobody was notified.',
  },
  // 비공개 모임은 구독자에게 알리지 않는다 — 갔다고 적으면 거짓말이 된다
  createdPrivate: {
    ko: '비공개 모임을 만들었어요! 링크를 아는 사람만 볼 수 있어요.',
    en: 'Private meetup created — only people with the link can see it.',
  },
  createdInvite: {
    ko: '비공개 모임을 만들고 친구 {n}명에게 알렸어요.',
    en: 'Private meetup created, and {n} friends were told.',
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
  deletePastConfirm: {
    ko: '이미 지난 모임이에요. 지우면 명단과 호스트 점수도 같이 사라지고 되돌릴 수 없어요. 지울까요?',
    en: 'This meetup already happened. Deleting it also removes its roster and host points, for good. Delete it?',
  },
  deleteFailed: { ko: '삭제 실패', en: 'Couldn’t delete' },
  /* 날짜 미정(사람부터 모으는 모임) */
  gatheringHint: { ko: '사람 모으는 중', en: 'gathering people' },
  gatheringCount: { ko: '{n}명 모였어요', en: '{n} in so far' },
  noDateToggle: { ko: '날짜는 나중에', en: 'Decide the date later' },
  noDateHint: {
    ko: '먼저 사람을 모으고 날짜는 나중에 정해요. 캘린더에는 안 뜨고, 날짜를 정하면 참가자에게 알림이 가요.',
    en: 'Gather people first and set the date later. It stays off the calendar, and everyone joined is notified once you pick a date.',
  },
};

interface SessionUser {
  id: string;
  name: string;
}

interface PostView {
  id: string;
  category: string;
  authorId: string;
  authorName: string | null;
  coHost: { id: string; name: string } | null;
  allowNicknames: boolean;
  title: string | null;
  titleMeta: TitleMeta | null;
  recurringRuleId: string | null;
  isPast: boolean;
  /** null이면 「날짜 미정」 — 사람부터 모으는 모임 */
  date: string | null;
  startTime: string | null;
  /** 안 적었으면 null — 카드에는 시작 시각만 보여준다 */
  endTime: string | null;
  location: string;
  description: string | null;
  capacity: number | null;
  visibility: 'public' | 'link';
  participants: { id: string; name: string; avatar: string | null; hostCount: number }[];
  participantCount: number;
  commentCount: number;
  /** 정산 요약 — 없으면 null (서버 PostView와 같은 모양) */
  settle: { exists: boolean; myCents: number | null; iAmPayee: boolean } | null;
  /** 우리 평점 요약 — 끝난 무비나잇에만 붙는다 */
  rating: { average: number | null; count: number; mine: number | null } | null;
  /** 이 모임의 사진 — 넘겨 볼 몇 장과 실제 전체 장수 */
  photos: { urls: string[]; count: number } | null;
  comments: CommentView[];
}

/**
 * 같은 날짜의 모임을 한 덩어리로 묶는다 (서버가 이미 날짜순으로 준다).
 * 날짜 미정(모집 중)은 date가 null인 덩어리 하나로 맨 앞에 온다 — 서버가 그렇게 정렬해 준다.
 */
function groupByDate(list: PostView[]) {
  const out: { date: string | null; posts: PostView[] }[] = [];
  for (const p of list) {
    const last = out[out.length - 1];
    if (last && last.date === p.date) last.posts.push(p);
    else out.push({ date: p.date, posts: [p] });
  }
  return out;
}

/** 서버가 페이지를 그리면서 미리 읽어 둔 것 (page.tsx) */
export interface CategoryInitial {
  posts: PostView[];
  pastPosts: PostView[];
  subscribed: boolean;
  friends: Person[];
  incoming: Person[];
  outgoing: Person[];
  members: Person[];
}

/** 친구 목록 세 갈래를 화면이 쓰는 모양(관계 표)으로 */
function tiesOf(initial: CategoryInitial): { friends: Person[]; ties: Record<string, Tie> } {
  const ties: Record<string, Tie> = {};
  for (const f of initial.friends) ties[f.id] = 'friends';
  for (const f of initial.incoming) ties[f.id] = 'incoming';
  for (const f of initial.outgoing) ties[f.id] = 'outgoing';
  return { friends: initial.friends, ties };
}

export default function CategoryClient({ slug, initial }: { slug: string; initial: CategoryInitial }) {
  // 세션은 레이아웃이 서버에서 읽어 둔 것을 쓴다
  const viewer = useViewer();
  const refresh = useRefreshSession();
  const zoom = usePosterZoom();
  const user = viewer.user;
  const isAdmin = viewer.isAdmin;
  const [posts, setPosts] = useState<PostView[]>(initial.posts);
  const [subscribed, setSubscribed] = useState(initial.subscribed);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const t = useT();
  const locale = useLocale();
  const category = getCategory(slug);
  const name = category ? t(catDisplayName(category.slug)) : slug;
  const color = category?.color ?? '#101010';
  const titleLabel = category?.titleLabel ? t(category.titleLabel) : undefined;
  const useTitleSearch = category?.titleSearch === 'tmdb'; // 자동완성은 영화/드라마만
  const titleOptions = category?.titleOptions ?? [];
  const locationPlaceholder = `${t(category?.locationLabel ?? DEFAULT_LOCATION_LABEL)} (${t(
    category?.locationHint ?? DEFAULT_LOCATION_HINT
  )})`;
  // 날짜·시간은 현재 언어 포맷으로
  const dateLabel = (d: string) => fmtDate(d, locale);
  /** 피드 날짜 헤더 — 「8월 2일 토요일」 */
  const dateLabelLong = (d: string) => fmtDateLong(d, locale);
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
  /**
   * 날짜 미정 — 사람부터 모으는 모임.
   *
   * 켜면 날짜·시간을 안 보내고(null), 매주 반복과는 함께 켤 수 없다 —
   * 반복은 요일이 있어야 다음 회차를 열 수 있다.
   */
  const [fNoDate, setFNoDate] = useState(false);
  const [fPrivate, setFPrivate] = useState(false); // 비공개 — 링크를 아는 사람만
  /** 비공개 모임을 알릴 친구 — 처음엔 전원이 켜져 있고, 뺄 사람만 뺀다 */
  const [fInvite, setFInvite] = useState<Set<string>>(new Set());
  /** 같이 여는 사람 (한 명까지) */
  const [fCoHost, setFCoHost] = useState<string | null>(null);
  /** 이 모임에서 닉네임을 허용할지 (기본 실명) */
  const [fNick, setFNick] = useState(false);
  /**
   * 모임 포스터. 만들기 전에 올려 두고 저장할 때 **경로**를 넘긴다.
   *
   * 값이 셋이다 — undefined는 「그대로 둔다」(수정할 때 안 건드린 경우), 문자열은 새로 올린
   * 경로, null은 「뗀다」. 이 셋을 뭉뜨그리면 딴 데를 고칠 때마다 포스터가 사라진다.
   *
   * 미리보기는 따로 둔다: 새로 올린 것은 방금 고른 파일로, 수정 화면에서는 서버가 서명해
   * 준 주소로 그린다. 저장 전에는 경로만으로 그림을 띄울 수 없다(비공개 스토어라서).
   */
  const [fPhoto, setFPhoto] = useState<string | null | undefined>(undefined);
  const [fPhotoPreview, setFPhotoPreview] = useState<string | null>(null);
  const [fPhotoBusy, setFPhotoBusy] = useState(false);
  /** 수정 중인 모임에 이미 붙어 있는 사진 — 넣고 빼는 즉시 서버에 반영된다 */
  const [editPhotos, setEditPhotos] = useState<{ id: string; url: string }[]>([]);

  /**
   * 사진 올리기. 바이트는 저장소로 곧장 가고 우리는 경로만 다룬다.
   *
   * 만들 때와 수정할 때가 다르다 — 만들 때는 아직 모임이 없어서 경로를 들고 있다가
   * 저장할 때 넘기고, 수정할 때는 모임이 있으므로 바로 매단다.
   */
  async function pickPhoto(files: FileList | null | undefined) {
    const list = files ? [...files] : [];
    if (list.length === 0) return;
    setFPhotoBusy(true);
    setMsg(null);
    try {
      // 만들 때는 한 장만 — 나머지는 만든 뒤에 올린다
      for (const file of editId ? list.slice(0, MAX_PER_BATCH) : list.slice(0, 1)) {
        const { blob, width, height } = await shrinkToJpeg(file);
        const put = await upload(photoPath(user!.id, crypto.randomUUID()), blob, {
          access: 'private',
          handleUploadUrl: '/api/blob/upload',
          contentType: 'image/jpeg',
        });
        if (!editId) {
          setFPhoto(put.pathname);
          setFPhotoPreview(URL.createObjectURL(blob));
          break;
        }
        const res = await fetch(`/api/posts/${editId}/photos`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pathname: put.pathname, width, height }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? t(T.photoFailed));
      }
      if (editId) await refreshEditPhotos(editId);
    } catch (e) {
      setMsg({
        type: 'err',
        text: e instanceof UnreadableImageError ? t(T.photoHeic) : e instanceof Error ? e.message : t(T.photoFailed),
      });
    }
    setFPhotoBusy(false);
  }

  /** 수정 중인 모임의 사진 목록을 다시 읽는다 (서명된 주소는 서버만 만들 수 있다) */
  async function refreshEditPhotos(postId: string) {
    const res = await fetch(`/api/posts/${postId}/photos`, { cache: 'no-store' });
    if (!res.ok) return;
    setEditPhotos((await res.json()).photos ?? []);
  }

  async function removeEditPhoto(photoId: string) {
    if (!editId) return;
    setFPhotoBusy(true);
    setMsg(null);
    const res = await fetch(`/api/posts/${editId}/photos/${photoId}`, { method: 'DELETE' });
    if (!res.ok) setMsg({ type: 'err', text: (await res.json().catch(() => null))?.error ?? t(T.photoFailed) });
    else await refreshEditPhotos(editId);
    setFPhotoBusy(false);
  }

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
    setFNoDate(false);
    setFPrivate(false);
    setFInvite(new Set());
    setFCoHost(null);
    setFNick(false);
    setFPhoto(undefined);
    setFPhotoPreview(null);
    setEditPhotos([]);
  }

  // 지난 모임
  const [pastPosts, setPastPosts] = useState<PostView[] | null>(initial.pastPosts);
  const [showPast, setShowPast] = useState(false);

  // 펼침 상태 — 댓글, 참여자 명단
  const [openComments, setOpenComments] = useState<Set<string>>(new Set());
  const [openPeople, setOpenPeople] = useState<Set<string>>(new Set());
  /** 친구 관계 — 참가자를 눌렀을 때 무엇을 보여줄지 정한다 */
  const [friends, setFriends] = useState<{ friends: Person[]; ties: Record<string, Tie> }>(() => tiesOf(initial));
  /** 눌린 참가자 (친구 창) */
  const [tapped, setTapped] = useState<Person | null>(null);
  /** 친구를 넣을 모임 (＋친구 창) */
  const [addTo, setAddTo] = useState<PostView | null>(null);
  /** 관리자만 — 친구가 아닌 사람도 넣을 수 있어야 해서 회원 전체를 받아둔다 */
  const [members, setMembers] = useState<Person[]>(initial.members);

  async function togglePast() {
    setShowPast(!showPast);
  }

  /**
   * 목록을 다시 받아온다.
   *
   * 이제 서버가 페이지를 그리면서 읽어 주므로, 여기서 따로 부르지 않고 서버 렌더를
   * 다시 돌린다. 새 값은 아래 이펙트가 상태로 옮긴다 — 열어 둔 패널이나 펼쳐 둔 댓글은
   * 그대로 남는다(다시 마운트하는 게 아니라 prop만 바뀐다).
   */
  function reloadAll() {
    refresh();
  }

  /*
   * 서버가 다시 그려 새 prop이 오면 상태로 옮긴다.
   * useState의 첫 값은 처음 한 번만 쓰이므로, 이게 없으면 refresh()가 화면에 안 보인다.
   */
  useEffect(() => {
    setPosts(initial.posts);
    setPastPosts(initial.pastPosts);
    setSubscribed(initial.subscribed);
    setMembers(initial.members);
    setFriends(tiesOf(initial));
  }, [initial]);

  /** 친구 목록과 요청 상태를 한 번에 — 참가자 칩이 무엇을 보여줄지 여기서 갈린다 */
  async function loadFriends() {
    const res = await fetch('/api/friends');
    if (!res.ok) return; // 비로그인이면 그냥 비워 둔다
    const d = await res.json();
    const ties: Record<string, Tie> = {};
    for (const f of d.friends ?? []) ties[f.id] = 'friends';
    for (const f of d.incoming ?? []) ties[f.id] = 'incoming';
    for (const f of d.outgoing ?? []) ties[f.id] = 'outgoing';
    setFriends({ friends: d.friends ?? [], ties });
  }

  function toggleIn(set: Set<string>, id: string) {
    const s = new Set(set);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    return s;
  }

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
    // 구독 여부도 서버가 읽어 주는 값이라, 다시 그려 두지 않으면 탭을 옮겼다 오면 옛 값이 온다
    else refresh();
  }

  /** 날짜 헤더의 ＋ — 그 날짜를 미리 채운 채로 만들기 패널을 연다 */
  function openCreate(date?: string) {
    setEditId(null);
    resetForm();
    if (date) setFDate(date);
    // 비공개로 바꾸면 바로 쓸 수 있도록 친구를 미리 전부 골라 둔다
    setFInvite(new Set(friends.friends.map((f) => f.id)));
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
          date: fNoDate ? null : fDate,
          startTime: fNoDate ? null : fStart,
          endTime: fNoDate ? null : fEnd || null,
          location: fLocation,
          description: fMemo,
          capacity: fCapacity || undefined,
          ...(fCoHost ? { coHostId: fCoHost } : {}),
          allowNicknames: fNick,
          ...(fPhoto ? { photoPath: fPhoto } : {}),
          repeatWeekly: fRepeat,
          visibility: fPrivate ? 'link' : 'public',
          ...(fPrivate && !fRepeat ? { inviteFriendIds: [...fInvite] } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.createFailed));
      setMsg({
        type: 'ok',
        text: data.repeatWeekly
          ? t(T.createdWeekly, { day: weekdayLabel(fDate) })
          : // 지난 모임으로 들어간 경우가 먼저다 — 알림이 안 나갔다는 게 제일 중요한 사실이다
            data.past
            ? t(T.createdPast)
            : !fPrivate
              ? t(T.createdOnce)
              : fInvite.size > 0
                ? t(T.createdInvite, { n: fInvite.size })
                : t(T.createdPrivate),
      });
      setShowForm(false);
      resetForm();
      // 지난 날짜로 만들면 예정 목록에는 안 뜬다 — 지난 목록까지 같이 다시 받는다
      await reloadAll();
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
    setFDate(post.date ?? '');
    setFStart(post.startTime ?? '');
    setFNoDate(!post.date);
    setFEnd(post.endTime ?? '');
    setFLocation(post.location);
    setFMemo(post.description ?? '');
    setFCapacity(post.capacity != null ? String(post.capacity) : '');
    setFCoHost(post.coHost?.id ?? null);
    setFNick(post.allowNicknames);
    // 사진은 여기서 안 다룬다 — 모임 상세의 「사진」에서 넣고 뺀다 (관리할 자리는 하나여야 한다)
    setFPhoto(undefined);
    setFPhotoPreview(null);
    setEditPhotos([]);
    void refreshEditPhotos(post.id);
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
          date: fNoDate ? null : fDate,
          startTime: fNoDate ? null : fStart,
          endTime: fNoDate ? null : fEnd || null,
          location: fLocation,
          description: fMemo,
          capacity: fCapacity || undefined,
          coHostId: fCoHost,
          allowNicknames: fNick,
          visibility: fPrivate ? 'link' : 'public',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.editFailed));
      setMsg({ type: 'ok', text: t(T.edited) });
      setEditId(null);
      resetForm();
      // 날짜를 옮기면 예정↔지난 사이를 건너간다 — 두 목록을 같이 다시 받는다
      await reloadAll();
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
            when: whenLabelShort(post.date, post.startTime, locale),
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
    // 지난 모임은 취소가 아니라 기록을 지우는 일이라, 무엇이 사라지는지 다르게 묻는다
    if (!confirm(t(post.isPast ? T.deletePastConfirm : T.deleteConfirm))) return;
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

  return (
    <>
      <div className="feed-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span className="feed-dot" style={{ background: color }} />
          <h1 style={{ margin: 0 }}>
            {name}
            <CatIcon slug={slug} />
          </h1>
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

      {category?.tool && (
        <Link className="cat-tool" href={category.tool.href}>
          <span className="cat-tool-label" style={{ color }}>
            {t(category.tool.label)} →
          </span>
          <span className="cat-tool-desc">{t(category.tool.desc)}</span>
        </Link>
      )}

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

      {/* 지난 목록도 서버가 함께 읽어 오므로 따로 기다리는 상태가 없다 */}
      {showPast &&
        ((pastPosts ?? []).length === 0 ? (
          <div className="feed-empty">{t(T.emptyPast)}</div>
        ) : (
          groupByDate(pastPosts ?? []).map((group) => renderGroup(group, true))
        ))}

      {panelOpen && renderCreatePanel()}

      {tapped && (
        <FriendRequestSheet
          person={tapped}
          tie={user && tapped.id === user.id ? 'me' : (friends.ties[tapped.id] ?? 'none')}
          signedIn={Boolean(user)}
          onClose={() => setTapped(null)}
          onDone={loadFriends}
        />
      )}

      {/* 명단에서 뺄 수 있는 건 관리자, 그리고 지난 모임의 호스트다 */}
      {addTo && (
        <AddFriendSheet
          postId={addTo.id}
          candidates={(isAdmin ? members : friends.friends).filter(
            (f) => !addTo.participants.some((p) => p.id === f.id)
          )}
          {...(isAdmin || (addTo.isPast && (addTo.authorId === user?.id || addTo.coHost?.id === user?.id))
            ? { roster: addTo.participants.map((p) => ({ id: p.id, name: p.name, avatar: p.avatar })) }
            : {})}
          {...(isAdmin ? { asAdmin: true } : {})}
          onClose={() => setAddTo(null)}
          onDone={reloadAll}
        />
      )}

      {/* 포스터를 크게 보는 창 — 화면 맨 위를 덮으므로 마지막에 둔다 */}
      {zoom.overlay}
    </>
  );

  function renderGroup(group: { date: string | null; posts: PostView[] }, past: boolean) {
    const hint = past || !group.date ? null : whenHint(group.date);
    return (
      <section className="day-block" key={`${past ? 'past-' : ''}${group.date ?? 'tbd'}`}>
        <div className="day-head">
          <h2 className="day-title">
            {group.date ? dateLabelLong(group.date) : t(WHEN_TBD)}
            {hint && <span className="day-hint">{hint}</span>}
            {!group.date && <span className="day-hint">{t(T.gatheringHint)}</span>}
          </h2>
          {user && !past && group.date && (
            <button className="link-btn" onClick={() => openCreate(group.date!)}>
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
    // 수정 중인 모임 — 같이 여는 사람은 만든 사람만 바꿀 수 있어서 누구 것인지 알아야 한다
    const editing = editId ? (posts.find((p) => p.id === editId) ?? pastPosts?.find((p) => p.id === editId) ?? null) : null;
    const onSave = isCreate ? createPost : saveEditPost;
    const onCancel = () => {
      setShowForm(false);
      setEditId(null);
      resetForm();
    };
    // 종료 시각은 안 적어도 만들 수 있다
    const canSave = Boolean(fDate && fStart && fLocation.trim());
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
              {/* 자주 나오는 답은 눌러서 채우고, 없는 건 아래 칸에 그냥 적는다 */}
              {titleOptions.length > 0 && (
                <div className="people-list" style={{ paddingTop: 0 }}>
                  {titleOptions.map((opt) => {
                    const label = t(opt);
                    return (
                      <button
                        key={label}
                        className={`person-chip pick ${fTitle === label ? 'on' : ''}`}
                        aria-pressed={fTitle === label}
                        onClick={() => setFTitle(fTitle === label ? '' : label)}
                      >
                        {fTitle === label ? '✓ ' : ''}
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="search-wrap">
                <input
                  type="text"
                  placeholder={
                    useTitleSearch
                      ? t(T.titleSearchPh, { label: titleLabel ?? '' })
                      : titleOptions.length > 0
                        ? t(T.titleOtherPh, { label: titleLabel ?? '' })
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
            {/*
              * 날짜를 나중에 정하는 모임 — 켜면 날짜·시간 칸을 아예 감춘다.
              * 비활성으로 남겨 두면 「왜 안 써지지」를 먼저 겪게 된다.
              */}
            <label className="repeat-check" style={{ marginBottom: fNoDate ? 0 : 10 }}>
              <input
                type="checkbox"
                checked={fNoDate}
                onChange={(e) => {
                  setFNoDate(e.target.checked);
                  // 반복은 요일이 있어야 다음 회차를 열 수 있다 — 날짜가 없으면 성립하지 않는다
                  if (e.target.checked) setFRepeat(false);
                }}
              />
              <span>{t(T.noDateToggle)}</span>
            </label>
            {fNoDate ? (
              <p className="hint" style={{ margin: '8px 0 0' }}>
                {t(T.noDateHint)}
              </p>
            ) : (
              <>
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
              </>
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

          {/*
            * 사진.
            *
            * 만들 때는 아직 모임이 없어서 매달 데가 없다 — 올려 두고 경로만 들고 있다가
            * 저장할 때 서버가 첫 사진으로 붙인다. (저장을 취소하면 주인 없는 파일이 하나
            * 남고, 그건 청소가 걷어간다.)
            *
            * 수정할 때는 모임이 이미 있으므로 고르는 즉시 붙고, 지우는 것도 즉시다 —
            * 저장 버튼을 기다리지 않는다. 사진은 「고쳐서 저장하는 값」이 아니라
            * 넣고 빼는 것이라, 저장을 눌러야 반영되면 오히려 헷갈린다.
            */}
          <div className="form-section">
            <div className="field-label">{t(T.secPhoto)}</div>

            {/* 수정 중이면 이미 붙어 있는 사진들 — 누르면 그 자리에서 뺀다 */}
            {!isCreate && editPhotos.length > 0 && (
              <div className="photo-grid" style={{ marginBottom: 8 }}>
                {editPhotos.map((ph) => (
                  <div key={ph.id} className="photo-cell">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt="" loading="lazy" />
                    <button
                      className="photo-del"
                      aria-label={t(T.photoClear)}
                      disabled={fPhotoBusy}
                      onClick={() => void removeEditPhoto(ph.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isCreate && fPhotoPreview ? (
              <div className="title-meta-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fPhotoPreview} alt="" style={{ width: 54, borderRadius: 8 }} />
                <button
                  className="link-btn danger-text"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => {
                    setFPhoto(null);
                    setFPhotoPreview(null);
                  }}
                >
                  {t(T.photoClear)}
                </button>
              </div>
            ) : (
              <label className="secondary photo-pick">
                {fPhotoBusy ? t(T.photoBusy) : t(T.photoPick)}
                <input
                  type="file"
                  accept="image/*"
                  {...(isCreate ? {} : { multiple: true })}
                  hidden
                  disabled={fPhotoBusy}
                  onChange={(e) => {
                    void pickPhoto(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
            )}
            <div className="hint" style={{ marginTop: 6 }}>
              {isCreate ? t(T.photoHint) : t(T.photoHintEdit)}
            </div>
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
            {/*
             * 같이 여는 사람. 한 명까지만 고를 수 있어 다시 누르면 풀린다 —
             * 점수를 나눠 갖는 자리라 "몇 명까지"가 규칙으로 분명해야 한다.
             * 수정에서는 만든 사람에게만 보인다 (공동 호스트가 자기를 갈아끼우지 못하게).
             */}
            {(isCreate || editing?.authorId === user?.id || isAdmin) && (
              <div className="invite-pick" style={{ marginTop: 12 }}>
                <div className="field-label">{t(T.coHostLabel)}</div>
                {(isAdmin ? members : friends.friends).length === 0 ? (
                  <p className="hint">{t(T.coHostNone)}</p>
                ) : (
                  <>
                    <div className="people-list">
                      {/* 관리자는 친구가 아닌 사람도 세울 수 있다 (서버도 같은 예외를 둔다) */}
                      {(isAdmin ? members : friends.friends).map((f) => (
                        <button
                          key={f.id}
                          className={`person-chip pick ${fCoHost === f.id ? 'on' : ''}`}
                          aria-pressed={fCoHost === f.id}
                          onClick={() => setFCoHost((cur) => (cur === f.id ? null : f.id))}
                        >
                          {fCoHost === f.id ? '✓ ' : ''}
                          {f.name}
                        </button>
                      ))}
                    </div>
                    <p className="hint">{t(T.coHostHint)}</p>
                  </>
                )}
              </div>
            )}

            <label className="repeat-check" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={fNick} onChange={(e) => setFNick(e.target.checked)} />
              <span>
                {t(T.nickToggle)}
                <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> {t(T.nickHint)}</span>
              </span>
            </label>

            <label className="repeat-check" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={fPrivate} onChange={(e) => setFPrivate(e.target.checked)} />
              <span>
                {t(T.privateToggle)}
                <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}> {t(T.privateHint)}</span>
              </span>
            </label>

            {/*
             * 비공개 모임은 구독자에게 알리지 않으니, 아무에게도 안 알리면 아무도 모른다.
             * 그래서 친구를 전부 고른 상태로 띄우고, 뺄 사람만 빼게 한다.
             * 매주 반복은 첫 회차만 초대가 나가 헷갈리므로 그때는 아예 숨긴다.
             */}
            {isCreate && fPrivate && !fRepeat && (
              <div className="invite-pick">
                <div className="field-label">{t(T.inviteLabel)}</div>
                {friends.friends.length === 0 ? (
                  <p className="hint">{t(T.inviteNone)}</p>
                ) : (
                  <>
                    <div className="people-list">
                      {friends.friends.map((f) => (
                        <button
                          key={f.id}
                          className={`person-chip pick ${fInvite.has(f.id) ? 'on' : ''}`}
                          onClick={() => setFInvite((s) => toggleIn(s, f.id))}
                          aria-pressed={fInvite.has(f.id)}
                        >
                          {fInvite.has(f.id) ? '✓ ' : ''}
                          {f.name}
                        </button>
                      ))}
                    </div>
                    <button
                      className="link-btn"
                      onClick={() =>
                        setFInvite(
                          fInvite.size === friends.friends.length ? new Set() : new Set(friends.friends.map((f) => f.id))
                        )
                      }
                    >
                      {fInvite.size === friends.friends.length ? t(T.inviteNoneAll) : t(T.inviteAll)}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="create-foot">
          <button className="big-cta" disabled={busy || !canSave} onClick={onSave}>
            {busy ? t(T.saving) : isCreate ? t(T.create) : t(T.save)}
          </button>
          {isCreate && (
            <div className="create-hint">
              {fPrivate
                ? fInvite.size > 0 && !fRepeat
                  ? t(T.notifyHintInvite, { n: fInvite.size })
                  : t(T.notifyHintPrivate)
                : t(T.notifyHint)}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderPost(post: PostView, past: boolean) {
    const joined = user ? post.participants.some((p) => p.id === user.id) : false;
    const mine = user?.id === post.authorId;
    // 같이 연 사람도 호스트다 — 수정은 할 수 있고, 삭제는 만든 사람·관리자만이다
    const isCoHost = Boolean(user && post.coHost?.id === user.id);
    const full = post.capacity != null && post.participantCount >= post.capacity;
    const commentsOpen = openComments.has(post.id);
    const peopleOpen = openPeople.has(post.id);
    const canJoin = !past && (!mine || post.recurringRuleId);

    /*
     * 카드에 실을 그림 한 장과, 눌렀을 때 넘겨 볼 목록.
     *
     * 사진이 있으면 사진이 앞선다 — 무비나잇이라도 우리가 올린 것이 그 모임을 더 잘 가리킨다.
     * TMDB 포스터는 넘기면 맨 끝에 그대로 있다.
     * 목록은 앞의 몇 장만 들고 있어서(lib/db/photos.ts) 나머지는 상세에서 본다.
     */
    const label = post.title ? `〈${post.title}〉` : category ? t(category.name) : "";
    const extras: { src: string; name: string }[] = [
      ...(post.titleMeta?.posterPath
        ? [{ src: `${TMDB_IMG}/w500${post.titleMeta.posterPath}`, name: post.titleMeta.title || label }]
        : []),
    ];
    const art =
      post.photos
        ? {
            thumb: post.photos.urls[0]!,
            items: [...post.photos.urls.map((src) => ({ src, name: label })), ...extras],
            // 배지는 실제 전체 장수다 — 카드가 들고 온 것보다 많을 수 있다
            count: post.photos.count,
          }
        : extras.length > 0
          ? { thumb: extras[0]!.src, items: extras, count: extras.length }
          : null;
    // 이름 줄을 얼굴로 바꾼 만큼 자리가 넉넉해져 10명까지 보여준다 (겹쳐 놓아서 폭은 얼마 안 든다)
    const shown = post.participants.slice(0, 10);
    const left = post.capacity != null ? post.capacity - post.participantCount : null;
    // 참여자 이름 요약 — 나는 "나"로 바꿔 한 줄에 더 들어가게 한다
    const namesLine = post.participants
      .map((p) => (user && p.id === user.id ? t(T.me) : p.name))
      .join(', ');

    return (
      <article key={post.id} className={`post-card ${past ? 'past' : ''}`}>
        {/*
          * 포스터가 있으면 머리 부분만 가로로 나눈다 — 왼쪽에 글, 오른쪽에 포스터.
          * 아래의 참여자·댓글은 전폭을 그대로 쓴다. 카드 전체를 둘로 쪼개면 댓글이
          * 포스터 너비만큼 좁아진 채로 길게 이어진다.
          */}
        {/*
          * 카드에 실리는 그림은 한 장뿐이다. 후보가 셋이라 순서를 정해 둔다 —
          * 모임이 끝나기 전에는 「뭘 하러 가나」(플라이어·영화 포스터), 끝난 뒤에는
          * 「뭘 했나」(단체사진)가 궁금하다. 그래서 끝난 모임에서는 사진이 앞선다.
          * 자리는 그대로라 카드 높이도 폭도 안 변한다.
          */}
        <div className={art ? 'post-head has-poster' : 'post-head'}>
          <div className="post-head-text">
            <div className="post-when">
              {post.startTime ? (
                <>
                  {to12h(post.startTime)}
                  {post.endTime ? ` – ${to12h(post.endTime)}` : ''}
                </>
              ) : (
                /* 시각 자리에 인원을 적는다 — 이 모임에서 지금 궁금한 건 「몇 명 모였나」다 */
                t(T.gatheringCount, { n: post.participantCount })
              )}
              {post.visibility === 'link' && <span className="repeat-badge private">{t(T.privateBadge)}</span>}
              {post.recurringRuleId && post.date && (
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
              <PlaceLink location={post.location} />
              {post.authorName && (
                <>
                  {' '}
                  · {post.authorName}
                  {post.coHost && <>, {post.coHost.name}</>}
                </>
              )}
            </div>
            {post.description && <div className="post-desc">“{post.description}”</div>}
          </div>
          {art && (
            /* 눌러서 크게 볼 수 있다 — 카드에 실리는 건 62px짜리라 얼굴을 알아보기 어렵다 */
            <span className="post-art">
              {zoom.triggerAt(
                art.items,
                0,
                // eslint-disable-next-line @next/next/no-img-element
                <img className="post-poster" src={art.thumb} alt="" loading="lazy" />
              )}
              {/* 더 있다는 표시 — 사진 위에 겹쳐서 폭을 안 먹는다 */}
              {art.count > 1 && <span className="post-shot-count">{art.count}</span>}
            </span>
          )}
        </div>

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
                {hostTier(p.hostCount) && (
                  <span className="host-sticker" title={t(hostTier(p.hostCount)!.label)}>
                    {hostTier(p.hostCount)!.sticker}
                  </span>
                )}
              </span>
            ))}
            {shown.length > 0 && post.participantCount > shown.length && (
              <span className="ava more">+{post.participantCount - shown.length}</span>
            )}
          </span>
          <span className="people-count">
            {post.capacity != null
              ? t(T.peopleCap, { n: post.participantCount, cap: post.capacity })
              : t(T.people, { n: post.participantCount })}
            <span className="caret" aria-hidden="true">
              {peopleOpen ? '▴' : '▾'}
            </span>
          </span>
        </button>
        {peopleOpen && (
          <div className="people-list">
            {post.participants.map((p) => {
              const isMe = Boolean(user && p.id === user.id);
              // 로그인한 사람에게만 눌리는 칩 — 비로그인은 애초에 명단을 못 본다
              if (!user || isMe) {
                return (
                  <span className="person-chip" key={p.id}>
                    {p.name}
                    {isMe ? ` (${t(T.me)})` : ''}
                  </span>
                );
              }
              const tie = friends.ties[p.id];
              return (
                <button
                  className={`person-chip friend ${tie ?? ''}`}
                  key={p.id}
                  onClick={() => setTapped({ id: p.id, name: p.name, avatar: p.avatar })}
                >
                  {tie === 'friends' ? '🤝 ' : tie === 'incoming' ? '● ' : ''}
                  {p.name}
                </button>
              );
            })}
            {/* 대신 넣기 — 명단에 없는 친구를 부르는 입구라 참가자 칩과는 따로 둔다.
                관리자는 언제든, 호스트는 지난 모임에서도 (그날 온 사람을 뒤늦게 적는다) */}
            {user && (isAdmin || (past && (mine || isCoHost)) || (!past && !full)) && (
              <button className="person-chip add" onClick={() => setAddTo(post)}>
                ＋ {t(T.friendChip)}
              </button>
            )}
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
            {post.commentCount > 0 ? ` ${post.commentCount}` : ''}
            <span className="caret" aria-hidden="true">
              {commentsOpen ? '▴' : '▾'}
            </span>
          </button>
          {!past && (
            <button className="link-btn" disabled={busy} onClick={() => share(post)}>
              {t(T.share)}
            </button>
          )}
          {/*
            * 지난 모임에서도 고칠 수 있다 — 같이 연 사람을 뒤늦게 넣는 일이 있어서다.
            * (날짜만 못 옮긴다. 서버가 막는다)
            */}
          {(mine || isCoHost || isAdmin) && (
            <button className="link-btn" disabled={busy} onClick={() => startEditPost(post)}>
              {t(T.edit)}
            </button>
          )}
          {/* 끝난 무비나잇 — 우리 평점 한 줄. 아직 아무도 안 매겼으면 참가자에게만 권한다 */}
          {post.rating &&
            (post.rating.average != null ? (
              <Link className="link-btn post-rating" href={`/p/${post.id}#rating`}>
                {t(T.ourRating, { score: formatScore(post.rating.average) })}
                <b> ({post.rating.count})</b>
              </Link>
            ) : (
              joined && (
                <Link className="link-btn" href={`/p/${post.id}#rating`}>
                  {t(T.rateIt)}
                </Link>
              )
            ))}
          {/* 참가한 사람에게만 — 정산은 같이 낸 사람들 사이의 일이다 */}
          {joined && (
            <Link className={`link-btn ${post.settle?.myCents ? 'strong' : ''}`} href={`/p/${post.id}#settle`}>
              {post.settle?.myCents
                ? t(T.settleOwe, { amount: formatCents(post.settle.myCents) })
                : post.settle
                  ? t(T.settleSee)
                  : t(T.settleStart)}
            </Link>
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

        {/* 지난 모임에서 남는 건 관리자의 삭제뿐이다 — 그것도 없으면 빈 칸이라 통째로 뺀다 */}
        {(isAdmin || (mine && !past)) && (
          <div className="post-owner-actions">
            {!past && post.recurringRuleId && (
              <button className="link-btn" disabled={busy} onClick={() => stopRepeat(post)}>
                {t(T.stopRepeat)}
              </button>
            )}
            {/* 지난 모임은 관리자만 지운다 — 기록이라서다 (서버에서도 같은 규칙) */}
            <button className="link-btn danger-text" disabled={busy} onClick={() => remove(post)}>
              {t(T.del)}
            </button>
          </div>
        )}

        {commentsOpen && (
          <CommentThread
            postId={post.id}
            comments={post.comments}
            lockedCount={post.commentCount - post.comments.length}
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
