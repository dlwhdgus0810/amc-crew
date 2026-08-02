'use client';

import { useEffect, useState } from 'react';
import { useLocale, useT } from '../i18n';
import type { Msg } from '@/lib/i18n';
import { TEST_USERS } from '@/lib/test-users';
import { entryLabel } from '@/lib/datefmt';

interface CategoryRequest {
  id: string;
  userName: string;
  name: string;
  color: string;
  description: string;
  featureRequest: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
}

interface Ticket {
  id: string;
  number: number;
  userName: string;
  kind: 'feature' | 'improve' | 'bug' | 'other' | 'cheer';
  title: string;
  body: string | null;
  status: 'open' | 'planned' | 'done' | 'declined';
  adminNote: string | null;
}

const TICKET_KIND_LABEL: Record<Ticket['kind'], Msg> = {
  feature: { ko: '새 기능', en: 'New feature' },
  improve: { ko: '개선', en: 'Improvement' },
  bug: { ko: '오류', en: 'Broken' },
  other: { ko: '기타', en: 'Other' },
  cheer: { ko: '쪽지', en: 'Note' },
};

const TICKET_STATUS_LABEL: Record<Ticket['status'], Msg> = {
  open: { ko: '접수됨', en: 'Received' },
  planned: { ko: '반영 예정', en: 'Planned' },
  done: { ko: '반영됨', en: 'Shipped' },
  declined: { ko: '보류', en: 'Not planned' },
};

/** 상태를 바꾸는 버튼 순서 */
const TICKET_ACTIONS: Ticket['status'][] = ['open', 'planned', 'done', 'declined'];

const REQ_STATUS_LABEL: Record<CategoryRequest['status'], Msg> = {
  pending: { ko: '검토 중', en: 'In review' },
  approved: { ko: '승인됨', en: 'Approved' },
  rejected: { ko: '반려됨', en: 'Declined' },
};

const T = {
  reqTitle: { ko: '카테고리 제안', en: 'Category suggestions' },
  reqDesc: {
    ko: '사용자들이 보낸 새 카테고리 제안이에요. 승인하면 제안자에게 알림이 가고, 실제 추가는',
    en: 'Suggestions from members. Approving notifies the requester; the category goes live once you add it to',
  },
  reqDescTail: { ko: '에 항목을 넣어 배포해야 반영됩니다.', en: ' and deploy.' },
  reqEmpty: { ko: '아직 들어온 제안이 없어요.', en: 'No suggestions yet.' },
  feature: { ko: '원하는 기능', en: 'Feature request' },
  reply: { ko: '답변: {text}', en: 'Reply: {text}' },
  replyPh: { ko: '답변 (선택) — 제안자에게 함께 전달돼요', en: 'Reply (optional) — sent to the requester' },
  approve: { ko: '승인', en: 'Approve' },
  reject: { ko: '반려', en: 'Decline' },
  reviewFailed: { ko: '처리 실패', en: 'Couldn’t process' },
  approved: { ko: '승인했어요. 제안자에게 알림이 갔어요.', en: 'Approved — the requester has been notified.' },
  rejected: { ko: '반려했어요.', en: 'Declined.' },
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  onlineTitle: { ko: '지금 접속 중', en: 'Online now' },
  onlineDesc: {
    ko: '앱을 열어 두면 1분마다 신호가 와요. 최근 {n}분 안에 신호가 온 사람이 여기 뜨고, 앱을 닫으면 {n}분 안에 사라져요.',
    en: 'An open app checks in every minute. Anyone we heard from in the last {n} minutes shows up here, and drops off within {n} minutes of closing the app.',
  },
  onlineNone: { ko: '지금은 아무도 접속해 있지 않아요.', en: 'Nobody is online right now.' },
  onlineCount: { ko: '{n} / {total}명 접속 중', en: '{n} of {total} online' },
  onlineJustNow: { ko: '방금', en: 'just now' },
  onlineMins: { ko: '{n}분 전', en: '{n}m ago' },
  onlineRefresh: { ko: '15초마다 자동으로 갱신돼요.', en: 'Refreshes every 15 seconds.' },
  failed: { ko: '요청에 실패했어요.', en: 'Something went wrong.' },
  newsTitle: { ko: '새 소식 알리기', en: 'Announce what’s new' },
  newsDesc: {
    ko: '가장 최근 소식을 "새 소식 알림"을 켜 둔 회원에게 보냅니다. 배포만으로는 아무것도 나가지 않아요. 같은 소식을 이미 받은 사람은 건너뜁니다.',
    en: 'Sends the latest entry to members who turned update alerts on. Deploying sends nothing by itself, and anyone who already got this one is skipped.',
  },
  newsSend: { ko: '지금 보내기', en: 'Send now' },
  newsSending: { ko: '보내는 중…', en: 'Sending…' },
  newsConfirm: {
    ko: '가장 최근 소식을 알림 켠 회원들에게 보낼까요? 카카오톡으로도 갑니다.',
    en: 'Send the latest entry to members with alerts on? It also goes out on KakaoTalk.',
  },
  newsSent: { ko: '{n}명에게 보냈어요. ({skipped}명은 이미 받아서 건너뛰었어요)', en: 'Sent to {n}. ({skipped} already had it)' },
  banTitle: { ko: '이용 정지', en: 'Suspensions' },
  banDesc: {
    ko: '정한 시간 동안 앱을 못 쓰게 막아요. 시간이 지나면 저절로 풀리고, 그 사람이 만든 모임과 댓글은 그대로 남아요.',
    en: 'Blocks someone from using the app for a set time. It lifts on its own, and their meetups and comments stay.',
  },
  banReasonPh: { ko: '사유 (선택) — 본인에게 그대로 보여요', en: 'Reason (optional) — they see this' },
  banPick: { ko: '기간을 고르면 바로 정지돼요', en: 'Picking a length suspends them right away' },
  banLift: { ko: '정지 풀기', en: 'Lift' },
  banActive: { ko: '{left} 남음', en: '{left} left' },
  banConfirm: { ko: '{name}님을 {dur} 동안 정지할까요?', en: 'Suspend {name} for {dur}?' },
  banLiftConfirm: { ko: '{name}님의 정지를 풀까요?', en: 'Lift the suspension on {name}?' },
  banDone: { ko: '{name}님을 정지했어요.', en: '{name} is suspended.' },
  banLifted: { ko: '{name}님의 정지를 풀었어요.', en: '{name} can use the app again.' },
  banNobody: { ko: '정지할 수 있는 회원이 없어요.', en: 'No members to suspend.' },
  banH: { ko: '{n}시간', en: '{n}h' },
  banD: { ko: '{n}일', en: '{n}d' },
  banM: { ko: '{n}분', en: '{n} min' },
  statsTitle: { ko: '회원별 접속 기록', en: 'Time in the app' },
  statsDesc: {
    ko: '신호가 이어지는 동안을 한 번의 접속으로 묶어 잰 시간이에요. 최근 7일치만 봅니다.',
    en: 'Runs of consecutive check-ins counted as one visit. Last 7 days.',
  },
  statsUser: { ko: '회원', en: 'Member' },
  statsDay: { ko: '24시간', en: '24h' },
  statsWeek: { ko: '7일', en: '7d' },
  statsVisits: { ko: '접속', en: 'Visits' },
  statsLast: { ko: '마지막', en: 'Last seen' },
  statsPush: { ko: '푸시', en: 'Push' },
  statsPushOn: { ko: '앱 푸시 알림을 켠 기기 {n}대', en: '{n} device(s) with app push on' },
  statsPushOff: { ko: '앱 푸시 알림 꺼짐', en: 'App push notifications off' },
  statsLastJustNow: { ko: '방금', en: 'just now' },
  statsLastMins: { ko: '{n}분 전', en: '{n}m ago' },
  statsLastHours: { ko: '{n}시간 전', en: '{n}h ago' },
  statsLastDays: { ko: '{n}일 전', en: '{n}d ago' },
  statsVisitsUnit: { ko: '{n}회', en: '{n}' },
  statsNever: { ko: '기록 없음', en: 'never' },
  deletedTitle: { ko: '지운 알림', en: 'Deleted alerts' },
  deletedDesc: {
    ko: '사용자가 알림 탭에서 지운 것들이에요. 실제로는 지워지지 않고 여기 남습니다.',
    en: 'Alerts people removed from their alerts tab. Nothing is actually deleted — it lands here.',
  },
  deletedNone: { ko: '지워진 알림이 없어요.', en: 'Nothing has been deleted.' },
  deletedWho: { ko: '누가', en: 'Who' },
  deletedMsg: { ko: '알림', en: 'Alert' },
  deletedWhen: { ko: '지운 때', en: 'Deleted' },
  statsEmpty: { ko: '아직 쌓인 기록이 없어요.', en: 'Nothing recorded yet.' },
  viewAsTitle: { ko: '테스트 계정으로 보기', en: 'View as a test account' },
  viewAsDesc: {
    ko: '일반 회원 화면을 그대로 확인할 수 있어요. 실제 회원으로는 들어갈 수 없어요 — 비공개 모임이 그 사람에게만 보이기 때문이에요.',
    en: 'See the app as an ordinary member. Real members cannot be impersonated — their private meetups are meant for them alone.',
  },
  viewAsWarn: {
    ko: '테스트 계정으로 모임을 만들거나 댓글을 달면 구독자·참가자에게 진짜 알림이 갑니다.',
    en: 'Anything you create or comment on as a test account sends real alerts to subscribers and participants.',
  },
  viewAsFailed: { ko: '전환 실패', en: 'Couldn’t switch' },
  ticketTitle: { ko: '건의함', en: 'Suggestion box' },
  ticketDesc: {
    ko: '사용자들이 낸 건의예요. 상태를 바꾸면 낸 사람에게 알림이 갑니다.',
    en: 'Tickets from members. Changing the status notifies whoever filed it.',
  },
  ticketEmpty: { ko: '아직 들어온 건의가 없어요.', en: 'No tickets yet.' },
  ticketReplyPh: { ko: '답변 (선택) — 낸 사람에게 함께 전달돼요', en: 'Reply (optional) — sent with the update' },
  ticketUpdated: { ko: '상태를 바꿨어요. 낸 사람에게 알림이 갔어요.', en: 'Updated — the member has been notified.' },
  clearConfirm: {
    ko: '정말 모든 사람의 선택을 삭제할까요? 되돌릴 수 없어요.',
    en: 'Delete everyone’s showtime picks? This can’t be undone.',
  },
  clearFailed: { ko: '삭제 실패', en: 'Couldn’t delete' },
  cleared: { ko: '모든 선택을 삭제했어요.', en: 'All picks deleted.' },
  scheduleTitle: { ko: '관리자 — AMC 상영표', en: 'Admin — AMC showtimes' },
  scheduleDesc2: {
    ko: '상영표는 AMC에서 실시간으로 가져와 30분간 캐시해요. "AMC에서 새로고침"을 누르면 캐시를 비우고 다시 받습니다.',
    en: 'Showtimes come live from AMC and are cached for 30 minutes. “Refresh from AMC” clears the cache and refetches.',
  },
  theatres: { ko: '극장 찾기', en: 'Theatres' },
  theatresDesc: {
    ko: '지금 쓰는 극장 ID는 {id}이에요. 바꾸려면 AMC_THEATRE_ID 환경변수에 아래 ID를 넣으세요.',
    en: 'Current theatre ID is {id}. To change it, set AMC_THEATRE_ID to one of these.',
  },
  colTheatre: { ko: '극장', en: 'Theatre' },
  colCity: { ko: '도시', en: 'City' },
  refreshFailed: { ko: 'AMC 새로고침 실패', en: 'Couldn’t refresh from AMC' },
  refreshed: { ko: '오늘 상영표를 다시 받았어요 (영화 {m}편 · 회차 {n}개).', en: 'Reloaded today’s showtimes ({m} movies, {n} showtimes).' },
  adminKeyPh: { ko: '관리자 키 (ADMIN_KEY)', en: 'Admin key (ADMIN_KEY)' },
  amcRefresh: { ko: '🔄 AMC에서 새로고침', en: '🔄 Refresh from AMC' },
  dataTitle: { ko: '선택 데이터 관리', en: 'Pick data' },
  dataDesc: {
    ko: '카카오 관리자 계정으로 로그인되어 있어요. 모든 사람의 회차 선택을 삭제할 수 있어요.',
    en: 'You’re signed in as a Kakao admin. You can delete everyone’s showtime picks.',
  },
  clearAll: { ko: '🗑 모든 선택 삭제', en: '🗑 Delete all picks' },
  processing: { ko: '처리 중…', en: 'Working…' },
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [requests, setRequests] = useState<CategoryRequest[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [amcInfo, setAmcInfo] = useState<{ theatreId: string; theatres: { id: string; name: string; city?: string }[] } | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [isKakaoAdmin, setIsKakaoAdmin] = useState(false);
  const [deleted, setDeleted] = useState<
    { id: string; message: string; name: string; createdAt: string; deletedAt: string }[] | null
  >(null);
  const [presence, setPresence] = useState<{
    online: { id: string; name: string; avatar: string | null; secondsAgo: number }[];
    total: number;
    windowMinutes: number;
    stats: {
      id: string;
      name: string;
      avatar: string | null;
      daySeconds: number;
      weekSeconds: number;
      visits: number;
      lastSeenSecondsAgo: number | null;
      lastSeenAt: string | null;
      pushDevices: number;
    }[];
  } | null>(null);
  // 기본은 접어 둔다 — 관리자 화면에 들를 때마다 볼 표는 아니다
  const [statsOpen, setStatsOpen] = useState(false);
  // 지운 알림도 접어 둔다 — 무슨 일이 있을 때 찾아보는 것이지 늘 보는 표가 아니다
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  // 관리자 화면의 긴 목록들은 다 접어 둔다 — 볼 일이 있을 때 열어 보는 것들이다
  const [reqOpen, setReqOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [banBusy, setBanBusy] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [members, setMembers] = useState<
    { id: string; name: string; avatar: string | null; until?: string; secondsLeft?: number; reason?: string | null }[] | null
  >(null);
  const [durations, setDurations] = useState<number[]>([]);
  const [newsBusy, setNewsBusy] = useState(false);
  const t = useT();
  const locale = useLocale();

  /** 최신 소식을 알림 켠 회원에게 발송 — 되돌릴 수 없어서 한 번 묻는다 */
  async function sendNews() {
    if (!confirm(t(T.newsConfirm))) return;
    setNewsBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/news-alerts', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.failed));
      setMsg({ type: 'ok', text: t(T.newsSent, { n: data.sent, skipped: data.skipped }) });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setNewsBusy(false);
    }
  }

  /** 초 → "2시간 13분" / "13분" / "-" */
  /**
   * 마지막 접속 — 하루 안쪽은 "몇 분/시간 전"이 읽기 쉽고,
   * 그보다 오래되면 며칠 전인지 세는 것보다 날짜를 바로 보는 편이 빠르다.
   */
  function lastSeen(u: { lastSeenSecondsAgo: number | null; lastSeenAt: string | null }): string {
    if (u.lastSeenSecondsAgo === null || !u.lastSeenAt) return t(T.statsNever);
    const s = u.lastSeenSecondsAgo;
    if (s < 60) return t(T.statsLastJustNow);
    if (s < 3600) return t(T.statsLastMins, { n: Math.floor(s / 60) });
    if (s < 86400) return t(T.statsLastHours, { n: Math.floor(s / 3600) });
    if (s < 30 * 86400) return t(T.statsLastDays, { n: Math.floor(s / 86400) });
    /*
     * 한 달이 넘으면 날짜만. "2025. 10/5 (일) 오전 9:03" 같은 표기를 쓰면 이 칸 하나가
     * 표 전체를 옆으로 밀어낸다. 정확한 시각은 어차피 title에 붙어 있다.
     */
    return u.lastSeenAt.slice(0, 10);
  }

  async function loadMembers() {
    const res = await fetch('/api/admin/ban', { cache: 'no-store' });
    if (!res.ok) return;
    const d = await res.json();
    setMembers(d.members ?? []);
    setDurations(d.durations ?? []);
  }

  /** 기간 버튼의 라벨 — 분 단위 값을 사람이 읽는 말로 */
  function durLabel(minutes: number): string {
    if (minutes < 60) return t(T.banM, { n: minutes });
    return minutes < 60 * 24 ? t(T.banH, { n: minutes / 60 }) : t(T.banD, { n: minutes / (60 * 24) });
  }

  /** 남은 기간 — 서버가 준 초를 굵직하게 (관리자 화면은 초까지 셀 자리가 아니다) */
  function leftLabel(seconds: number): string {
    const m = Math.ceil(seconds / 60);
    if (m < 60) return t(T.banM, { n: m });
    const h = Math.floor(m / 60);
    return h < 24 ? t(T.banH, { n: h }) : t(T.banD, { n: Math.floor(h / 24) });
  }

  async function ban(id: string, name: string, minutes: number) {
    const ask = minutes === 0 ? t(T.banLiftConfirm, { name }) : t(T.banConfirm, { name, dur: durLabel(minutes) });
    if (!confirm(ask)) return;
    setBanBusy(id);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id, minutes, reason: banReason }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? t(T.failed));
      setMsg({ type: 'ok', text: minutes === 0 ? t(T.banLifted, { name }) : t(T.banDone, { name }) });
      setBanReason('');
      await loadMembers();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setBanBusy(null);
    }
  }

  function dur(seconds: number): string {
    if (seconds <= 0) return '–';
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => {
        setIsKakaoAdmin(Boolean(auth.isAdmin));
        if (auth.isAdmin) {
          loadRequests();
          loadTickets();
          fetch('/api/admin/deleted-notifications')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => d && setDeleted(d.notifications ?? []))
            .catch(() => {});
          loadMembers();
        }
      });
  }, []);

  // 접속 현황은 계속 변하니 주기적으로 다시 받는다 (관리자 화면을 열어 둔 동안만)
  useEffect(() => {
    if (!isKakaoAdmin) return;
    let alive = true;
    const load = () =>
      // 폴링이라 브라우저가 응답을 캐싱하면 목록이 멈춘 것처럼 보인다
      fetch('/api/presence', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => alive && data && setPresence(data))
        .catch(() => {});
    load();
    const timer = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isKakaoAdmin]);

  async function loadRequests() {
    const res = await fetch('/api/category-requests');
    if (res.ok) setRequests((await res.json()).requests ?? []);
  }

  /** 테스트 계정으로 전환 — 세션 쿠키가 바뀌므로 홈으로 새로 연다 */
  async function viewAs(id: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.viewAsFailed));
      window.location.href = '/';
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.viewAsFailed) });
      setBusy(false);
    }
  }

  async function loadTickets() {
    const res = await fetch('/api/tickets');
    if (res.ok) setTickets((await res.json()).tickets ?? []);
  }

  /** 건의 상태 변경 — 낸 사람에게 알림이 나간다 */
  async function reviewTicket(id: string, status: Ticket['status']) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote: notes[id] ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.reviewFailed));
      setMsg({ type: 'ok', text: t(T.ticketUpdated) });
      await loadTickets();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.reviewFailed) });
    } finally {
      setBusy(false);
    }
  }

  /** 제안 승인/반려 — 제안자에게 알림이 나간다 */
  async function review(id: string, status: 'approved' | 'rejected') {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/category-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote: notes[id] ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.reviewFailed));
      setMsg({ type: 'ok', text: status === 'approved' ? t(T.approved) : t(T.rejected) });
      await loadRequests();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.reviewFailed) });
    } finally {
      setBusy(false);
    }
  }

  async function clearAllSelections() {
    if (!window.confirm(t(T.clearConfirm))) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/selections', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.clearFailed));
      setMsg({ type: 'ok', text: t(T.cleared) });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.clearFailed) });
    } finally {
      setBusy(false);
    }
  }




  /** 캐시를 비우고 AMC에서 다시 받아온 뒤, 극장 목록도 함께 조회한다 */
  async function refreshFromAmc() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/refresh', { method: 'POST', headers: { 'x-admin-key': adminKey } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.refreshFailed));
      setMsg({ type: 'ok', text: t(T.refreshed, { n: data.showtimes, m: data.movies }) });
      const info = await fetch('/api/admin/refresh?name=town-center', { headers: { 'x-admin-key': adminKey } });
      if (info.ok) setAmcInfo(await info.json());
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.refreshFailed) });
    } finally {
      setBusy(false);
    }
  }


  return (
    <>
      {isKakaoAdmin && (
        <>
          <h1>
            <button className="collapse-h1" aria-expanded={reqOpen} onClick={() => setReqOpen((v) => !v)}>
              {t(T.reqTitle)}
              {requests.length > 0 ? ` ${requests.length}` : ''}
              <span className="collapse-caret" aria-hidden>
                {reqOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {reqOpen && (
            <>
          <p className="subtitle">
            {t(T.reqDesc)}
            <code> lib/categories.ts</code>
            {t(T.reqDescTail)}
          </p>
          {requests.length === 0 ? (
            <div className="card" style={{ color: 'var(--text-dim)' }}>{t(T.reqEmpty)}</div>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="card">
                <div className="field-row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}>
                    <span className="feed-dot" style={{ background: r.color }} />
                    {r.name}
                    <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
                      {r.description} · {r.color} · {r.userName}
                    </span>
                  </span>
                  <span className={`req-status ${r.status}`}>{t(REQ_STATUS_LABEL[r.status])}</span>
                </div>
                {r.featureRequest && (
                  <div style={{ marginTop: 10, fontSize: 14 }}>
                    <strong>{t(T.feature)}</strong>
                    <div style={{ color: 'var(--text-dim)', whiteSpace: 'pre-wrap' }}>{r.featureRequest}</div>
                  </div>
                )}
                {r.adminNote && (
                  <div style={{ marginTop: 10, fontSize: 14 }}>{t(T.reply, { text: r.adminNote })}</div>
                )}
                {r.status === 'pending' && (
                  <div className="field-row" style={{ marginTop: 14 }}>
                    <input
                      type="text"
                      placeholder={t(T.replyPh)}
                      value={notes[r.id] ?? ''}
                      maxLength={500}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      style={{ maxWidth: 420 }}
                    />
                    <button disabled={busy} onClick={() => review(r.id, 'approved')}>{t(T.approve)}</button>
                    <button className="danger" disabled={busy} onClick={() => review(r.id, 'rejected')}>
                      {t(T.reject)}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      {isKakaoAdmin && (
        <>
            </>
          )}

          <h1 style={{ marginTop: 80 }}>{t(T.viewAsTitle)}</h1>
          <p className="subtitle">{t(T.viewAsDesc)}</p>
          <div className="card">
            <div className="seg-group" style={{ flexWrap: 'wrap' }}>
              {TEST_USERS.map((u) => (
                <button key={u.id} className="seg" disabled={busy} onClick={() => viewAs(u.id)}>
                  {u.name}
                </button>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 12 }}>{t(T.viewAsWarn)}</p>
          </div>

          <h1 style={{ marginTop: 80 }}>
            <button className="collapse-h1" aria-expanded={ticketOpen} onClick={() => setTicketOpen((v) => !v)}>
              {t(T.ticketTitle)}
              {tickets.length > 0 ? ` ${tickets.length}` : ''}
              <span className="collapse-caret" aria-hidden>
                {ticketOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {ticketOpen && (
            <>
          <p className="subtitle">{t(T.ticketDesc)}</p>
          {tickets.length === 0 ? (
            <p className="subtitle">{t(T.ticketEmpty)}</p>
          ) : (
            tickets.map((tk) => (
              <div key={tk.id} className="card ticket-row">
                <div className="ticket-head">
                  <span className="ticket-no">#{tk.number}</span>
                  <span className="ticket-title">{tk.title}</span>
                  <span className={`ticket-status ${tk.status}`}>{t(TICKET_STATUS_LABEL[tk.status])}</span>
                </div>
                <p className="ticket-by">
                  {t(TICKET_KIND_LABEL[tk.kind])} · {tk.userName}
                </p>
                {tk.body && <p className="ticket-body">{tk.body}</p>}
                {tk.adminNote && <p className="ticket-note">{t(T.reply, { text: tk.adminNote })}</p>}
                <div className="field-row" style={{ marginTop: 14, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder={t(T.ticketReplyPh)}
                    value={notes[tk.id] ?? ''}
                    maxLength={500}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [tk.id]: e.target.value }))}
                    style={{ maxWidth: 420 }}
                  />
                  {TICKET_ACTIONS.filter((st) => st !== tk.status).map((st) => (
                    <button
                      key={st}
                      className={st === 'declined' ? 'danger' : 'secondary'}
                      disabled={busy}
                      onClick={() => reviewTicket(tk.id, st)}
                    >
                      {t(TICKET_STATUS_LABEL[st])}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </>
      )}

      <h1 style={{ marginTop: isKakaoAdmin ? 80 : 0 }}>{t(T.scheduleTitle)}</h1>
      <p className="subtitle">
        {t(T.scheduleDesc2)}
      </p>

      <div className="card">
        <div className="field-row">
          <input
            type="password"
            placeholder={t(T.adminKeyPh)}
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button className="secondary" disabled={busy || !adminKey} onClick={refreshFromAmc}>
            {t(T.amcRefresh)}
          </button>
        </div>
      </div>

      {amcInfo && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t(T.theatres)}</h2>
          <p className="subtitle" style={{ marginBottom: 14 }}>{t(T.theatresDesc, { id: amcInfo.theatreId })}</p>
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{t(T.colTheatre)}</th>
                <th>{t(T.colCity)}</th>
              </tr>
            </thead>
            <tbody>
              {amcInfo.theatres.map((th) => (
                <tr key={th.id}>
                  <td>{th.id}</td>
                  <td>{th.name}</td>
                  <td>{th.city ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isKakaoAdmin && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t(T.dataTitle)}</h2>
          <p className="subtitle" style={{ marginBottom: 14 }}>
            {t(T.dataDesc)}
          </p>
          <button className="danger" disabled={busy} onClick={clearAllSelections}>
            {t(T.clearAll)}
          </button>
        </div>
      )}

      {isKakaoAdmin && (
        <>
          <h1 style={{ marginTop: 80 }}>{t(T.newsTitle)}</h1>
          <p className="subtitle">{t(T.newsDesc)}</p>
          <div className="card">
            <button className="secondary" disabled={newsBusy} onClick={sendNews}>
              {newsBusy ? t(T.newsSending) : t(T.newsSend)}
            </button>
          </div>

            </>
          )}

          <h1 style={{ marginTop: 80 }}>
            <button className="collapse-h1" aria-expanded={banOpen} onClick={() => setBanOpen((v) => !v)}>
              {t(T.banTitle)}
              {(members ?? []).some((m) => m.until) ? ` ${(members ?? []).filter((m) => m.until).length}` : ''}
              <span className="collapse-caret" aria-hidden>
                {banOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {banOpen && (
            <>
              <p className="subtitle">{t(T.banDesc)}</p>
              <div className="card">
                {members === null ? (
                  <p className="hint">{t(T.loading)}</p>
                ) : members.length === 0 ? (
                  <p className="hint">{t(T.banNobody)}</p>
                ) : (
                  <>
                    {/* 사유는 한 번 적어 두고 아래에서 기간만 고른다 */}
                    <input
                      type="text"
                      placeholder={t(T.banReasonPh)}
                      value={banReason}
                      maxLength={200}
                      onChange={(e) => setBanReason(e.target.value)}
                    />
                    <p className="hint" style={{ marginTop: 6 }}>
                      {t(T.banPick)}
                    </p>
                    <ul className="online-list ban-list">
                      {members.map((m) => (
                        <li key={m.id}>
                          <span className="avatar-sm">
                            {m.avatar ? <img src={m.avatar} alt="" /> : m.name.slice(0, 1)}
                          </span>
                          <span className="online-name">{m.name}</span>
                          {m.until ? (
                            <span className="friend-actions">
                              <span className="ban-left">{t(T.banActive, { left: leftLabel(m.secondsLeft ?? 0) })}</span>
                              <button
                                className="link-btn strong"
                                disabled={banBusy === m.id}
                                onClick={() => ban(m.id, m.name, 0)}
                              >
                                {t(T.banLift)}
                              </button>
                            </span>
                          ) : (
                            <span className="ban-durs">
                              {durations.map((d) => (
                                <button
                                  key={d}
                                  className="person-chip pick"
                                  disabled={banBusy === m.id}
                                  onClick={() => ban(m.id, m.name, d)}
                                >
                                  {durLabel(d)}
                                </button>
                              ))}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </>
          )}

          <h1 style={{ marginTop: 80 }}>
            <button className="collapse-h1" aria-expanded={deletedOpen} onClick={() => setDeletedOpen((v) => !v)}>
              {t(T.deletedTitle)}
              {deleted !== null && deleted.length > 0 ? ` ${deleted.length}` : ''}
              <span className="collapse-caret" aria-hidden>
                {deletedOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {deletedOpen && (
            <>
          <p className="subtitle">{t(T.deletedDesc)}</p>
          <div className="card">
            {deleted === null ? (
              <p className="hint">{t(T.loading)}</p>
            ) : deleted.length === 0 ? (
              <p className="hint">{t(T.deletedNone)}</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{t(T.deletedWho)}</th>
                      <th>{t(T.deletedMsg)}</th>
                      <th>{t(T.deletedWhen)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deleted.map((n) => (
                      <tr key={n.id}>
                        <td>{n.name}</td>
                        <td>{n.message}</td>
                        <td>{new Date(n.deletedAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-US')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </>
          )}

          <h1 style={{ marginTop: 80 }}>{t(T.onlineTitle)}</h1>
          <p className="subtitle">{t(T.onlineDesc, { n: presence?.windowMinutes ?? 3 })}</p>
          <div className="card">
            {presence === null ? (
              <p className="hint">{t(T.loading)}</p>
            ) : presence.online.length === 0 ? (
              <p className="hint">{t(T.onlineNone)}</p>
            ) : (
              <>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>
                  {t(T.onlineCount, { n: presence.online.length, total: presence.total })}
                </div>
                <ul className="online-list">
                  {presence.online.map((u) => (
                    <li key={u.id}>
                      <span className="online-dot" aria-hidden />
                      <span className="avatar-sm">
                        {u.avatar ? <img src={u.avatar} alt="" /> : u.name.slice(0, 1)}
                      </span>
                      <span className="online-name">{u.name}</span>
                      <span className="online-ago">
                        {u.secondsAgo < 60 ? t(T.onlineJustNow) : t(T.onlineMins, { n: Math.floor(u.secondsAgo / 60) })}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="hint" style={{ marginTop: 12 }}>{t(T.onlineRefresh)}</p>
          </div>

          <h1 style={{ marginTop: 80 }}>
            <button className="collapse-h1" aria-expanded={statsOpen} onClick={() => setStatsOpen((v) => !v)}>
              {t(T.statsTitle)}
              <span className="collapse-caret" aria-hidden>
                {statsOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {statsOpen && (
            <>
          <p className="subtitle">{t(T.statsDesc)}</p>
          <div className="card">
            {!presence?.stats?.length ? (
              <p className="hint">{t(T.statsEmpty)}</p>
            ) : (
              <div className="stats-scroll">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>{t(T.statsUser)}</th>
                      <th>{t(T.statsLast)}</th>
                      <th>{t(T.statsPush)}</th>
                      <th>{t(T.statsDay)}</th>
                      <th>{t(T.statsWeek)}</th>
                      <th>{t(T.statsVisits)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presence.stats.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <span className="stats-name">
                            <span className="avatar-sm">
                              {u.avatar ? <img src={u.avatar} alt="" /> : u.name.slice(0, 1)}
                            </span>
                            {u.name}
                          </span>
                        </td>
                        {/* 정확한 시각은 언제든 필요하므로 title로 항상 달아 둔다 */}
                        <td title={u.lastSeenAt ? entryLabel(u.lastSeenAt, locale) : undefined}>{lastSeen(u)}</td>
                        {/* 기기 수까지 보여준다 — 폰만 켠 사람과 노트북까지 켠 사람은 다르다 */}
                        <td title={u.pushDevices > 0 ? t(T.statsPushOn, { n: u.pushDevices }) : t(T.statsPushOff)}>
                          {u.pushDevices > 0 ? `🔔 ${u.pushDevices}` : '–'}
                        </td>
                        <td>{dur(u.daySeconds)}</td>
                        <td>{u.weekSeconds > 0 ? dur(u.weekSeconds) : t(T.statsNever)}</td>
                        <td>{t(T.statsVisitsUnit, { n: u.visits })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </>
          )}
        </>
      )}

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}
    </>
  );
}
