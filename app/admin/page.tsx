'use client';

import { useEffect, useState } from 'react';
import { useLocale, useT } from '../i18n';
import { HTML_LANG, type Msg } from '@/lib/i18n';
import { TEST_USERS } from '@/lib/test-users';
import { CATEGORIES } from '@/lib/categories';
import { entryLabel } from '@/lib/datefmt';
import { useViewer } from '../session';
import { shrinkToJpeg, THUMB_EDGE, uploadThumbOnly } from '@/lib/photo-client';

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
  onlineHidden: { ko: '숨김', en: 'Hidden' },
  minePresence: { ko: '내 접속 표시', en: 'Show me as online' },
  minePresenceOn: { ko: '보임', en: 'Visible' },
  minePresenceOff: { ko: '숨김', en: 'Hidden' },
  minePresenceNote: {
    ko: '숨기면 친구들 화면에서 접속 중으로 보이지 않아요. 위 목록과 접속 기록에는 그대로 남고, 친구별로 감춘 설정도 그대로예요.',
    en: 'Hidden means friends never see you online. The list above and your time in the app stay as they are, and your per-friend settings are untouched.',
  },
  failed: { ko: '요청에 실패했어요.', en: 'Something went wrong.' },
  newsTitle: { ko: '새 소식 알리기', en: 'Announce what’s new' },
  newsDesc: {
    ko: '가장 최근 소식을 "새 소식 알림"을 켜 둔 회원에게 보냅니다. 배포만으로는 아무것도 나가지 않아요. 같은 소식을 이미 받은 사람은 건너뜁니다.',
    en: 'Sends the latest entry to members who turned update alerts on. Deploying sends nothing by itself, and anyone who already got this one is skipped.',
  },
  newsSend: { ko: '지금 보내기', en: 'Send now' },
  newsSending: { ko: '보내는 중…', en: 'Sending…' },
  newsConfirm: {
    ko: '가장 최근 소식을 알림 켠 회원들에게 보낼까요? 앱 푸시로도 갑니다.',
    en: 'Send the latest entry to members with alerts on? It also goes out as a push.',
  },
  newsSent: { ko: '{n}명에게 보냈어요. ({skipped}명은 이미 받아서 건너뛰었어요)', en: 'Sent to {n}. ({skipped} already had it)' },
  noticeTitle: { ko: '공지', en: 'Notices' },
  noticeDesc: {
    ko: '앱을 열면 화면 가운데에 한 번 뜨는 알림창이에요. 올려 둔 것 중 가장 최근 하나만 보이고, 각자 닫으면 그 공지는 다시 안 떠요. 푸시로는 나가지 않아요.',
    en: 'A one-time popup when someone opens the app. Only the newest live notice shows, and it stops appearing once a person closes it. No push is sent.',
  },
  noticeKo: { ko: '한국어', en: 'Korean' },
  noticeEn: { ko: 'English', en: 'English' },
  noticeEs: { ko: 'Español', en: 'Español' },
  noticeEnHint: {
    ko: '한국어 말고는 비워 둬도 돼요. 비우면 그 언어로 보는 사람에게도 적어 둔 말이 그대로 보여요.',
    en: 'Only Korean is required — leave the rest blank and whatever you wrote shows instead.',
  },
  thumbTitle: { ko: '사진 썸네일 채우기', en: 'Fill in photo thumbnails' },
  thumbHint: {
    ko: '격자에 뿌릴 작은 사진(400px)이 없는 옛 사진을 채워요. 브라우저가 원래 사진을 받아 줄여서 올리는 방식이라, 이 탭을 닫지 말고 끝날 때까지 두세요.',
    en: 'Fills in the small grid image (400px) for older photos. Your browser downloads each one, shrinks it, and uploads it — keep this tab open until it finishes.',
  },
  thumbRun: { ko: '채우기 시작', en: 'Start' },
  thumbBusy: { ko: '{done}/{total} 채우는 중…', en: 'Filling {done}/{total}…' },
  thumbDone: { ko: '{n}장 채웠어요.', en: 'Filled {n} photos.' },
  thumbNone: { ko: '채울 사진이 없어요 — 전부 되어 있어요.', en: 'Nothing to fill — they all have one.' },
  thumbFailed: { ko: '채우다 멈췄어요: {why}', en: 'Stopped: {why}' },
  exifTitle: { ko: '여행 사진 찍은 시각·자리 채우기', en: 'Fill in trip photo times and places' },
  exifHint: {
    ko: '여행 모임에 이미 올라간 사진의 원본에서 찍은 시각과 좌표를 읽어 채워요. 타임라인이 그걸로 그려져요. 원본이 없는 옛 사진과 스크린샷은 읽을 것이 없어 건너뛰어요.',
    en: 'Reads the time and coordinates out of the originals already uploaded to trip meetups — that’s what the timeline is drawn from. Photos with no original, and screenshots, have nothing to read.',
  },
  exifRun: { ko: '채우기 시작', en: 'Start' },
  exifBusy: { ko: '읽는 중…', en: 'Reading…' },
  exifDone: { ko: '{n}장 채웠어요. {left}장은 읽을 것이 없었어요.', en: 'Filled {n}. {left} had nothing to read.' },
  exifNone: { ko: '채울 사진이 없어요.', en: 'Nothing to fill.' },
  exifFailed: { ko: '채우다 멈췄어요: {why}', en: 'Stopped: {why}' },
  noticeLinkLabel: { ko: '보러 갈 곳 (선택)', en: 'Where it takes them (optional)' },
  noticeLinkHint: {
    ko: '적어 두면 공지에 「보러 가기」 버튼이 붙어요. 앱 안의 경로만 돼요 — /photos, /reviews, /p/모임아이디처럼요.',
    en: 'Fill this in and the notice gets a “Take me there” button. Paths inside the app only — /photos, /reviews, /p/<id>.',
  },
  noticeTitlePh: { ko: '제목 — 예: 참가하시면 참가 버튼을 눌러주세요', en: 'Title — e.g. Tap Join if you’re coming' },
  noticeTitlePhEn: { ko: 'Title (English)', en: 'Title (English)' },
  noticeBodyPh: { ko: '내용 (선택) — 줄을 나눠 써도 그대로 보여요', en: 'Body (optional) — line breaks are kept' },
  noticeBodyPhEn: { ko: 'Body (English, optional)', en: 'Body (English, optional)' },
  noticeTitlePhEs: { ko: 'Título (español)', en: 'Título (español)' },
  noticeBodyPhEs: { ko: 'Texto (español, opcional)', en: 'Texto (español, opcional)' },
  noticeWho: { ko: '누구에게', en: 'Who sees it' },
  noticeAll: { ko: '전체', en: 'Everyone' },
  noticeSome: { ko: '고른 사람만', en: 'Only picked' },
  noticeSomeHint: {
    ko: '올리기 전에 나한테만 띄워 보는 용도예요. 고른 사람 외에는 이 공지가 있는 줄도 몰라요.',
    en: 'For trying it on yourself before it goes out. Nobody else even knows it exists.',
  },
  noticePickNone: { ko: '한 명 이상 골라주세요.', en: 'Pick at least one person.' },
  noticeToAll: { ko: '전체', en: 'Everyone' },
  noticeToSome: { ko: '{n}명에게만', en: '{n} picked' },
  noticeRead: { ko: '{seen}/{total}명 확인', en: '{seen}/{total} confirmed' },
  noticeReadWho: { ko: '확인: {names}', en: 'Confirmed: {names}' },
  noticeReadNot: { ko: '아직: {names}', en: 'Not yet: {names}' },
  noticeReadNone: { ko: '아직 아무도 안 눌렀어요.', en: 'Nobody has confirmed yet.' },
  hideTitle: { ko: '카테고리 감추기', en: 'Hide categories' },
  hideDesc: {
    ko: '고른 카테고리를 홈과 둘러보기 목록에서 내려요. 지우는 게 아니라 목록에서만 빠지는 거라, 그 안의 모임·명단은 그대로 있고 주소로 들어가면 열려요.',
    en: 'Takes the picked categories off the home and browse lists. Nothing is deleted — their meetups and lists stay, and the pages still open by link.',
  },
  hideNone: { ko: '내려 둔 카테고리가 없어요.', en: 'None hidden.' },
  hideSaved: { ko: '저장했어요.', en: 'Saved.' },
  noticeReadNote: {
    ko: '「알겠어요」를 누른 사람이에요. 눌렀다는 것이지 읽었다는 뜻은 아니고, 회원들에게는 안 보여요. 내용을 고치면 다시 0부터 세요.',
    en: 'Who tapped “Got it” — tapped, not necessarily read. Members don’t see this. Editing the notice resets the count.',
  },
  noticePublish: { ko: '올리기', en: 'Publish' },
  noticePosted: { ko: '올렸어요. 다들 앱을 열면 보게 돼요.', en: 'Live — everyone sees it next time they open the app.' },
  noticePostedSome: {
    ko: '올렸어요. 고른 사람에게만 보여요 — 확인한 뒤 「전체에게」로 바꾸면 다들 보게 돼요.',
    en: 'Live for the people you picked. Switch it to everyone once it looks right.',
  },
  noticeToEveryone: { ko: '전체에게 보내기', en: 'Send to everyone' },
  noticeToEveryoneConfirm: {
    ko: '이 공지를 전체에게 보낼까요? 다들 앱을 열면 보게 돼요.',
    en: 'Send this notice to everyone? They’ll see it next time they open the app.',
  },
  noticeEmpty: { ko: '아직 올린 공지가 없어요.', en: 'No notices yet.' },
  noticeLive: { ko: '지금 보이는 공지', en: 'Showing now' },
  noticeHidden: { ko: '내림', en: 'Taken down' },
  noticeOlder: { ko: '가려짐', en: 'Superseded' },
  noticeDown: { ko: '내리기', en: 'Take down' },
  noticeUp: { ko: '다시 올리기', en: 'Put back' },
  noticeDelete: { ko: '지우기', en: 'Delete' },
  noticeDeleteConfirm: { ko: '이 공지를 지울까요? 되돌릴 수 없어요.', en: 'Delete this notice? This can’t be undone.' },
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
  statsActive: { ko: '활동시간', en: 'Active hours' },
  statsWeek: { ko: '7일', en: '7d' },
  statsLast: { ko: '마지막', en: 'Last seen' },
  statsPush: { ko: '앱 푸시', en: 'App push' },
  statsPushOn: { ko: '켜짐', en: 'On' },
  statsPushOff: { ko: '꺼짐', en: 'Off' },
  statsPushNote: {
    ko: '앱 푸시는 홈 화면에 추가한 앱으로 오는 알림이에요 (앱 안 알림함과 별개). 켜 둔 기기가 하나라도 있으면 켜짐이에요.',
    en: 'App push is the notification that reaches the home-screen app — separate from the in-app alerts tab. On means at least one device has it.',
  },
  statsActiveNote: {
    ko: '활동시간은 캔자스 시간 오전 7시부터 다음날 새벽 1시까지 머문 시간이에요. 새벽 1시를 넘기면 그날 것으로 묶여요.',
    en: 'Active hours counts time between 7am and 1am the next day, Kansas time — a late night still belongs to that day.',
  },
  statsSortBy: { ko: '정렬', en: 'Sort' },
  statsSortActive: { ko: '활동시간순', en: 'Active hours' },
  statsSortLast: { ko: '최근 접속순', en: 'Last seen' },
  statsLastJustNow: { ko: '방금', en: 'just now' },
  statsLastMins: { ko: '{n}분 전', en: '{n}m ago' },
  statsLastHours: { ko: '{n}시간 전', en: '{n}h ago' },
  statsLastDays: { ko: '{n}일 전', en: '{n}d ago' },
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
  refreshed: { ko: '오늘 상영표를 다시 받았어요 (영화 {m}편 · 회차 {n}개).', en: 'Reloaded today’s showtimes ({m} movies, {n} showtimes).' },
  dataTitle: { ko: '선택 데이터 관리', en: 'Pick data' },
  dataDesc: {
    ko: '카카오 관리자 계정으로 로그인되어 있어요. 모든 사람의 회차 선택을 삭제할 수 있어요.',
    en: 'You’re signed in as a Kakao admin. You can delete everyone’s showtime picks.',
  },
  clearAll: { ko: '🗑 모든 선택 삭제', en: '🗑 Delete all picks' },
  processing: { ko: '처리 중…', en: 'Working…' },
};

export default function AdminPage() {
  const [requests, setRequests] = useState<CategoryRequest[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const viewer = useViewer();
  const isKakaoAdmin = viewer.isAdmin;
  /** 썸네일 백필 진행 상황 — null이면 안 돌고 있다 */
  const [thumbBusy, setThumbBusy] = useState<{ done: number; total: number } | null>(null);
  const [exifBusy, setExifBusy] = useState(false);
  const [deleted, setDeleted] = useState<
    { id: string; message: string; name: string; createdAt: string; deletedAt: string }[] | null
  >(null);
  const [presence, setPresence] = useState<{
    online: { id: string; name: string; avatar: string | null; secondsAgo: number; hidden: boolean }[];
    total: number;
    windowMinutes: number;
    /** 내가 친구들에게 접속 중으로 보이는지 */
    myPresence: boolean;
    stats: {
      id: string;
      name: string;
      avatar: string | null;
      activeSeconds: number;
      weekSeconds: number;
      /** 표에서는 안 쓴다 — 기록만 남겨 둔 값이다 */
      visits: number;
      lastSeenSecondsAgo: number | null;
      lastSeenAt: string | null;
      pushDevices: number;
    }[];
  } | null>(null);
  // 기본은 접어 둔다 — 관리자 화면에 들를 때마다 볼 표는 아니다
  const [statsOpen, setStatsOpen] = useState(false);
  /*
   * 표를 보는 이유가 둘이다 — "요즘 누가 제일 많이 들어오나"와 "이 사람 언제 마지막으로 왔나".
   * 하나로는 다른 하나를 못 본다. 서버에 다시 물어보지 않고 여기서 줄만 다시 세운다.
   */
  const [statsSort, setStatsSort] = useState<'active' | 'last'>('active');
  // 지운 알림도 접어 둔다 — 무슨 일이 있을 때 찾아보는 것이지 늘 보는 표가 아니다
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  // 관리자 화면의 긴 목록들은 다 접어 둔다 — 볼 일이 있을 때 열어 보는 것들이다
  const [reqOpen, setReqOpen] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  /*
   * 나머지 묶음도 전부 접는다 — 관리자 화면이 한 화면에 다 안 들어와서, 아래쪽 것을
   * 쓰려면 매번 한참을 내려야 했다. 기본은 닫힘이다: 열어 두면 접는 의미가 없다.
   */
  const [viewAsOpen, setViewAsOpen] = useState(false);
  const [newsOpen, setNewsOpen] = useState(false);
  const [hideOpen, setHideOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [onlineOpen, setOnlineOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [thumbOpen, setThumbOpen] = useState(false);
  const [exifOpen, setExifOpen] = useState(false);
  const [banBusy, setBanBusy] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [members, setMembers] = useState<
    { id: string; name: string; avatar: string | null; until?: string; secondsLeft?: number; reason?: string | null }[] | null
  >(null);
  const [durations, setDurations] = useState<number[]>([]);
  const [newsBusy, setNewsBusy] = useState(false);
  const [presenceBusy, setPresenceBusy] = useState(false);
  const [notices, setNotices] = useState<
    {
      id: string;
      titleKo: string;
      titleEn: string | null;
      titleEs: string | null;
      bodyKo: string | null;
      bodyEn: string | null;
      bodyEs: string | null;
      linkPath: string | null;
      targets: string[];
      reads: { userId: string; seenAt: string }[];
      active: boolean;
      createdAt: string;
    }[]
  >([]);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeTitleEn, setNoticeTitleEn] = useState('');
  const [noticeBody, setNoticeBody] = useState('');
  const [noticeBodyEn, setNoticeBodyEn] = useState('');
  const [noticeTitleEs, setNoticeTitleEs] = useState('');
  const [noticeBodyEs, setNoticeBodyEs] = useState('');
  /** 「보러 가기」가 데려갈 앱 안의 경로 — 비워 두면 버튼 없이 「알겠어요」만 */
  const [noticeLink, setNoticeLink] = useState('');
  const [noticeBusy, setNoticeBusy] = useState(false);
  /** 목록에서 내려 둔 카테고리 (관리자만 고친다) */
  const [hidden, setHidden] = useState<string[]>([]);
  const [hideBusy, setHideBusy] = useState(false);
  /** 받는 사람 — 빈 배열이 곧 전체다. 「고른 사람만」을 골랐는지는 이 스위치가 따로 기억한다 */
  const [noticePicked, setNoticePicked] = useState(false);
  const [noticeTargets, setNoticeTargets] = useState<string[]>([]);
  /** 받는 사람 고르기용 전체 명단 — 정지 목록(관리자가 빠져 있다)과 달리 나도 들어 있어야 한다 */
  const [everyone, setEveryone] = useState<{ id: string; name: string; avatar: string | null }[]>([]);
  const t = useT();
  const locale = useLocale();

  async function loadNotices() {
    const res = await fetch('/api/notices?all=1', { cache: 'no-store' });
    if (res.ok) setNotices((await res.json()).notices ?? []);
  }

  async function loadHidden() {
    const res = await fetch('/api/admin/hidden-categories', { cache: 'no-store' });
    if (res.ok) setHidden((await res.json()).hidden ?? []);
  }

  /** 켜고 끈 결과를 통째로 보낸다 — 하나씩 더하고 빼면 두 번 누를 때 어긋난다 */
  async function saveHidden(next: string[]) {
    setHidden(next);
    setHideBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/hidden-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: next }),
      });
      if (!res.ok) throw new Error(t(T.failed));
      setMsg({ type: 'ok', text: t(T.hideSaved) });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
      await loadHidden();
    } finally {
      setHideBusy(false);
    }
  }

  async function loadEveryone() {
    const res = await fetch('/api/admin/members', { cache: 'no-store' });
    if (res.ok) setEveryone((await res.json()).members ?? []);
  }

  /** 공지에서 이름을 보여줄 때 — 지운 회원이면 id라도 보여준다 */
  function nameOf(id: string): string {
    return everyone.find((m) => m.id === id)?.name ?? id;
  }

  /**
   * 공지 올리기.
   *
   * 앞의 것을 따로 내리지 않아도 된다 — 뜨는 것은 올려 둔 것 중 가장 최근 하나뿐이다.
   */
  async function publishNotice() {
    // 「고른 사람만」인데 아무도 안 골랐으면 전체로 나가버린다 — 그 전에 막는다
    if (noticePicked && noticeTargets.length === 0) {
      setMsg({ type: 'err', text: t(T.noticePickNone) });
      return;
    }
    setNoticeBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleKo: noticeTitle.trim(),
          titleEn: noticeTitleEn.trim(),
          titleEs: noticeTitleEs.trim(),
          bodyKo: noticeBody.trim(),
          bodyEn: noticeBodyEn.trim(),
          bodyEs: noticeBodyEs.trim(),
          linkPath: noticeLink.trim(),
          targets: noticePicked ? noticeTargets : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.failed));
      setNoticeTitle('');
      setNoticeTitleEn('');
      setNoticeTitleEs('');
      setNoticeBody('');
      setNoticeBodyEn('');
      setNoticeBodyEs('');
      setNoticeLink('');
      setMsg({ type: 'ok', text: noticePicked ? t(T.noticePostedSome) : t(T.noticePosted) });
      await loadNotices();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setNoticeBusy(false);
    }
  }

  async function toggleNotice(id: string, active: boolean) {
    setNoticeBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/notices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error(t(T.failed));
      await loadNotices();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setNoticeBusy(false);
    }
  }

  /**
   * 골라 보낸 공지를 전체로 넓힌다 — 「나한테만 띄워 보고 괜찮으면 다들에게」가
   * 이 기능을 쓰는 가장 흔한 순서라, 지우고 다시 쓰게 두지 않는다.
   */
  async function widenNotice(n: (typeof notices)[number]) {
    if (!confirm(t(T.noticeToEveryoneConfirm))) return;
    setNoticeBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/notices/${n.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleKo: n.titleKo,
          titleEn: n.titleEn ?? '',
          titleEs: n.titleEs ?? '',
          bodyKo: n.bodyKo ?? '',
          bodyEn: n.bodyEn ?? '',
          bodyEs: n.bodyEs ?? '',
          linkPath: n.linkPath ?? '',
          targets: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.failed));
      setMsg({ type: 'ok', text: t(T.noticePosted) });
      await loadNotices();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setNoticeBusy(false);
    }
  }

  async function removeNotice(id: string) {
    if (!confirm(t(T.noticeDeleteConfirm))) return;
    setNoticeBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/notices/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(t(T.failed));
      await loadNotices();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setNoticeBusy(false);
    }
  }

  /**
   * 내 접속 표시를 켜고 끈다.
   *
   * 답을 기다렸다가 화면을 고친다 — 15초마다 도는 폴링이 곧 진짜 값을 덮어쓰므로,
   * 미리 눌러 둔 모양으로 바꿔 놓았다가 실패하면 그게 되돌아오는 것처럼 보인다.
   */
  async function setMyPresence(on: boolean) {
    setPresenceBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/presence', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on }),
      });
      if (!res.ok) throw new Error(t(T.failed));
      setPresence((p) => (p ? { ...p, myPresence: on } : p));
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setPresenceBusy(false);
    }
  }

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

  /*
   * 고른 기준으로 줄 세우기.
   * 한 번도 안 들어온 사람(lastSeenSecondsAgo === null)은 최근순에서 맨 뒤로 보낸다 —
   * null을 0으로 치면 방금 들어온 사람보다 위에 뜬다.
   */
  const sortedStats = [...(presence?.stats ?? [])].sort((a, b) =>
    statsSort === 'last'
      ? (a.lastSeenSecondsAgo ?? Infinity) - (b.lastSeenSecondsAgo ?? Infinity)
      : b.activeSeconds - a.activeSeconds || b.weekSeconds - a.weekSeconds
  );

  function dur(seconds: number): string {
    if (seconds <= 0) return '–';
    const m = Math.round(seconds / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  /*
   * 관리자인지는 레이아웃이 서버에서 읽어 둔 값으로 이미 안다 —
   * 예전에는 /api/auth/me를 받고 그 답을 보고서야 네 가지를 받기 시작했다.
   */
  useEffect(() => {
    if (!isKakaoAdmin) return;
    loadRequests();
    loadTickets();
    fetch('/api/admin/deleted-notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDeleted(d.notifications ?? []))
      .catch(() => {});
    loadMembers();
    loadNotices();
    loadEveryone();
    loadHidden();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isKakaoAdmin]);

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




  /**
   * 썸네일 백필 — 줄이는 일은 **여기(브라우저)서** 한다.
   *
   * 서버에서 줄이려면 이미지 라이브러리를 새로 들여야 하는데, 한 번 돌릴 일 때문에
   * 의존성을 늘리지 않는다. 올릴 때 쓰는 코드(shrinkToJpeg)를 그대로 쓴다.
   *
   * 열 장씩 받아서 다 올리고 다시 물어보기를 되풀이한다. 한 번에 전부 받으면 사진이
   * 수십 장일 때 메모리에 그만큼 쌓인다.
   */
  async function backfillThumbs() {
    const me = viewer.user?.id;
    if (!me) return;
    setThumbBusy({ done: 0, total: 0 });
    setMsg(null);
    let done = 0;
    try {
      for (;;) {
        const res = await fetch('/api/admin/thumb-backfill', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t(T.failed));
        const photos = data.photos as { id: string; url: string }[];
        if (photos.length === 0) break;

        // 남은 수는 물어볼 때마다 줄어든다 — 전체는 「지금까지 한 것 + 남은 것」이다
        const total = done + data.left;
        setThumbBusy({ done, total });

        for (const photo of photos) {
          const blob = await (await fetch(photo.url)).blob();
          const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
          const thumb = await shrinkToJpeg(file, THUMB_EDGE, 0.7);
          const pathname = await uploadThumbOnly(thumb.blob, me);
          const save = await fetch('/api/admin/thumb-backfill', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: photo.id, thumbPathname: pathname }),
          });
          if (!save.ok) throw new Error((await save.json().catch(() => null))?.error ?? t(T.failed));
          done++;
          setThumbBusy({ done, total });
        }
      }
      setMsg({ type: 'ok', text: done > 0 ? t(T.thumbDone, { n: done }) : t(T.thumbNone) });
    } catch (e) {
      setMsg({ type: 'err', text: t(T.thumbFailed, { why: e instanceof Error ? e.message : String(e) }) });
    } finally {
      setThumbBusy(null);
    }
  }

  /**
   * 여행 사진 EXIF 백필 — 여기는 부르기만 한다.
   *
   * 썸네일 쪽과 달리 브라우저가 할 일이 없다. 바이트를 읽는 일이라 서버가 원본 앞부분만
   * 받아 파싱하고 행에 적는다 (app/api/admin/photo-exif). 한 번에 마흔 장씩 보므로,
   * 더 남아 있으면 다 될 때까지 다시 부른다.
   */
  async function backfillExif() {
    setExifBusy(true);
    setMsg(null);
    let filled = 0;
    let left = 0;
    try {
      for (;;) {
        const res = await fetch('/api/admin/photo-exif', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? t(T.failed));
        filled += data.filled as number;
        left = data.left as number;
        // 본 것이 없거나 남은 것이 이번에 본 것뿐이면 더 볼 것이 없다 (읽을 게 없던 사진들)
        if (data.scanned === 0 || data.filled === 0) break;
      }
      setMsg({
        type: 'ok',
        text: filled > 0 || left > 0 ? t(T.exifDone, { n: filled, left }) : t(T.exifNone),
      });
    } catch (e) {
      setMsg({ type: 'err', text: t(T.exifFailed, { why: e instanceof Error ? e.message : String(e) }) });
    } finally {
      setExifBusy(false);
    }
  }

  /** 캐시를 비우고 AMC에서 다시 받아온 뒤, 극장 목록도 함께 조회한다 */

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

          <h1 className="admin-sec">
            <button className="collapse-h1" aria-expanded={viewAsOpen} onClick={() => setViewAsOpen((v) => !v)}>
              {t(T.viewAsTitle)}
              <span className="collapse-caret" aria-hidden>
                {viewAsOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {viewAsOpen && (
            <>
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
            </>
          )}

          <h1 className="admin-sec">
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

      {/*
        * 이 둘만 카드 안의 h2였다. 접는 모양을 다른 묶음과 맞춘다 — 열두 개 중 둘만
        * 안 접히면 「접을 수 있는 것」과 「없는 것」을 매번 기억해야 한다.
        */}
      {isKakaoAdmin && (
        <>
          <h1 className="admin-sec">
            <button className="collapse-h1" aria-expanded={dataOpen} onClick={() => setDataOpen((v) => !v)}>
              {t(T.dataTitle)}
              <span className="collapse-caret" aria-hidden>
                {dataOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {dataOpen && (
            <>
              <p className="subtitle">{t(T.dataDesc)}</p>
              <div className="card">
                <button className="danger" disabled={busy} onClick={clearAllSelections}>
                  {t(T.clearAll)}
                </button>
              </div>
            </>
          )}

          {/*
            * 썸네일 백필 — 한 번 돌리고 나면 쓸 일이 없다. 그래도 남겨 둔다:
            * 올릴 때 썸네일만 실패한 사진이 생길 수 있고(회선이 끊기면 그렇다) 그때 다시 돌린다.
            */}
          <h1 className="admin-sec">
            <button className="collapse-h1" aria-expanded={thumbOpen} onClick={() => setThumbOpen((v) => !v)}>
              {t(T.thumbTitle)}
              <span className="collapse-caret" aria-hidden>
                {thumbOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {thumbOpen && (
            <>
              <p className="subtitle">{t(T.thumbHint)}</p>
              <div className="card">
                <button className="secondary" disabled={Boolean(thumbBusy)} onClick={backfillThumbs}>
                  {thumbBusy ? t(T.thumbBusy, { done: thumbBusy.done, total: thumbBusy.total }) : t(T.thumbRun)}
                </button>
              </div>
            </>
          )}

          {/*
            * 여행 사진 EXIF 백필 — 썸네일 쪽과 나란히 둔다. 둘 다 「이미 올라간 사진에
            * 빠진 것을 채운다」는 같은 일이고, 한 번 돌리고 나면 쓸 일이 없다는 것도 같다.
            */}
          <h1 className="admin-sec">
            <button className="collapse-h1" aria-expanded={exifOpen} onClick={() => setExifOpen((v) => !v)}>
              {t(T.exifTitle)}
              <span className="collapse-caret" aria-hidden>
                {exifOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {exifOpen && (
            <>
              <p className="subtitle">{t(T.exifHint)}</p>
              <div className="card">
                <button className="secondary" disabled={exifBusy} onClick={backfillExif}>
                  {exifBusy ? t(T.exifBusy) : t(T.exifRun)}
                </button>
              </div>
            </>
          )}
        </>
      )}

      {isKakaoAdmin && (
        <>
          <h1 className="admin-sec">
            <button className="collapse-h1" aria-expanded={newsOpen} onClick={() => setNewsOpen((v) => !v)}>
              {t(T.newsTitle)}
              <span className="collapse-caret" aria-hidden>
                {newsOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {newsOpen && (
            <>
          <p className="subtitle">{t(T.newsDesc)}</p>
          <div className="card">
            <button className="secondary" disabled={newsBusy} onClick={sendNews}>
              {newsBusy ? t(T.newsSending) : t(T.newsSend)}
            </button>
          </div>
            </>
          )}

          <h1 className="admin-sec">
            <button className="collapse-h1" aria-expanded={hideOpen} onClick={() => setHideOpen((v) => !v)}>
              {t(T.hideTitle)}
              <span className="collapse-caret" aria-hidden>
                {hideOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {hideOpen && (
            <>
          <p className="subtitle">{t(T.hideDesc)}</p>
          <div className="card">
            <div className="seg-group" style={{ flexWrap: 'wrap' }}>
              {CATEGORIES.filter((c) => c.kind === 'posts').map((c) => (
                <button
                  key={c.slug}
                  className={`seg ${hidden.includes(c.slug) ? 'on' : ''}`}
                  disabled={hideBusy}
                  onClick={() =>
                    saveHidden(
                      hidden.includes(c.slug) ? hidden.filter((s) => s !== c.slug) : [...hidden, c.slug]
                    )
                  }
                >
                  {t(c.name)}
                </button>
              ))}
            </div>
            {hidden.length === 0 && (
              <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>{t(T.hideNone)}</p>
            )}
          </div>
            </>
          )}

          <h1 className="admin-sec">
            <button className="collapse-h1" aria-expanded={noticeOpen} onClick={() => setNoticeOpen((v) => !v)}>
              {t(T.noticeTitle)}
              <span className="collapse-caret" aria-hidden>
                {noticeOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {noticeOpen && (
            <>
          <p className="subtitle">{t(T.noticeDesc)}</p>
          <div className="card">
            <div className="field-label">{t(T.noticeKo)}</div>
            <input
              type="text"
              placeholder={t(T.noticeTitlePh)}
              value={noticeTitle}
              maxLength={60}
              onChange={(e) => setNoticeTitle(e.target.value)}
            />
            <textarea
              placeholder={t(T.noticeBodyPh)}
              value={noticeBody}
              maxLength={1000}
              rows={3}
              style={{ marginTop: 10 }}
              onChange={(e) => setNoticeBody(e.target.value)}
            />

            <div className="field-label" style={{ marginTop: 16 }}>
              {t(T.noticeEn)}
            </div>
            <input
              type="text"
              placeholder={t(T.noticeTitlePhEn)}
              value={noticeTitleEn}
              maxLength={60}
              onChange={(e) => setNoticeTitleEn(e.target.value)}
            />
            <textarea
              placeholder={t(T.noticeBodyPhEn)}
              value={noticeBodyEn}
              maxLength={1000}
              rows={3}
              style={{ marginTop: 10 }}
              onChange={(e) => setNoticeBodyEn(e.target.value)}
            />
            <div className="field-label" style={{ marginTop: 16 }}>
              {t(T.noticeEs)}
            </div>
            <input
              type="text"
              placeholder={t(T.noticeTitlePhEs)}
              value={noticeTitleEs}
              maxLength={60}
              onChange={(e) => setNoticeTitleEs(e.target.value)}
            />
            <textarea
              placeholder={t(T.noticeBodyPhEs)}
              value={noticeBodyEs}
              maxLength={1000}
              rows={3}
              style={{ marginTop: 10 }}
              onChange={(e) => setNoticeBodyEs(e.target.value)}
            />
            <p className="hint" style={{ marginTop: 8 }}>
              {t(T.noticeEnHint)}
            </p>

            <div className="field-label" style={{ marginTop: 16 }}>
              {t(T.noticeLinkLabel)}
            </div>
            <input
              type="text"
              placeholder="/photos"
              value={noticeLink}
              maxLength={200}
              onChange={(e) => setNoticeLink(e.target.value)}
            />
            <p className="hint" style={{ marginTop: 8 }}>
              {t(T.noticeLinkHint)}
            </p>

            <div className="field-label" style={{ marginTop: 16 }}>
              {t(T.noticeWho)}
            </div>
            <div className="seg-group">
              {[false, true].map((v) => (
                <button
                  key={String(v)}
                  className={`seg ${noticePicked === v ? 'on' : ''}`}
                  disabled={noticeBusy}
                  onClick={() => setNoticePicked(v)}
                >
                  {v ? t(T.noticeSome) : t(T.noticeAll)}
                </button>
              ))}
            </div>
            {noticePicked && (
              <>
                <div className="seg-group" style={{ flexWrap: 'wrap', marginTop: 10 }}>
                  {everyone.map((m) => (
                    <button
                      key={m.id}
                      className={`seg ${noticeTargets.includes(m.id) ? 'on' : ''}`}
                      disabled={noticeBusy}
                      onClick={() =>
                        setNoticeTargets((prev) =>
                          prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                        )
                      }
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
                <p className="hint" style={{ marginTop: 8 }}>
                  {t(T.noticeSomeHint)}
                </p>
              </>
            )}

            <button
              className="secondary"
              style={{ marginTop: 14 }}
              disabled={noticeBusy || !noticeTitle.trim()}
              onClick={publishNotice}
            >
              {t(T.noticePublish)}
            </button>
          </div>

          {notices.length > 0 && (
            <p className="subtitle" style={{ marginTop: 18 }}>
              {t(T.noticeReadNote)}
            </p>
          )}
          {notices.length === 0 ? (
            <p className="subtitle">{t(T.noticeEmpty)}</p>
          ) : (
            notices.map((n, i) => {
              /*
               * 켜져 있는 것이 여럿이어도 뜨는 건 가장 최근 하나다. 나머지 켜진 것들을
               * 그냥 「올림」으로 두면 왜 안 보이는지 알 수 없어서, 뜨는 것 하나만 갈라 놓는다.
               */
              const live = n.active && notices.findIndex((x) => x.active) === i;
              return (
                <div key={n.id} className="card notice-row">
                  <div className="notice-row-head">
                    <span className={`notice-state ${live ? 'live' : ''}`}>
                      {live ? t(T.noticeLive) : n.active ? t(T.noticeOlder) : t(T.noticeHidden)}
                    </span>
                    <span className="notice-state">
                      {n.targets.length === 0 ? t(T.noticeToAll) : t(T.noticeToSome, { n: n.targets.length })}
                    </span>
                    <span className="notice-row-when">{n.createdAt.slice(0, 10)}</span>
                  </div>
                  <p className="notice-row-title">{n.titleKo}</p>
                  {n.bodyKo && <p className="notice-row-body">{n.bodyKo}</p>}
                  {n.titleEn && <p className="notice-row-title en">{n.titleEn}</p>}
                  {n.bodyEn && <p className="notice-row-body">{n.bodyEn}</p>}
                  {n.titleEs && <p className="notice-row-title en">{n.titleEs}</p>}
                  {n.bodyEs && <p className="notice-row-body">{n.bodyEs}</p>}
                  {/* 누구에게 갔는지는 이름으로 — 「3명에게만」만 보면 누구였는지 알 수 없다 */}
                  {n.targets.length > 0 && (
                    <p className="notice-row-who">{n.targets.map(nameOf).join(', ')}</p>
                  )}
                  {(() => {
                    /*
                     * 받을 사람이 곧 분모다 — 골라 보낸 공지를 전체 인원으로 나누면
                     * 「3/12명 확인」처럼 영영 안 차는 숫자가 된다.
                     */
                    const audience = n.targets.length > 0 ? n.targets : everyone.map((m) => m.id);
                    const seen = n.reads.map((r) => r.userId).filter((id) => audience.includes(id));
                    const notYet = audience.filter((id) => !seen.includes(id));
                    return (
                      <div className="notice-reads">
                        <span className="notice-state">
                          {t(T.noticeRead, { seen: seen.length, total: audience.length })}
                        </span>
                        {seen.length === 0 ? (
                          <p className="notice-row-who">{t(T.noticeReadNone)}</p>
                        ) : (
                          <p className="notice-row-who">{t(T.noticeReadWho, { names: seen.map(nameOf).join(', ') })}</p>
                        )}
                        {notYet.length > 0 && seen.length > 0 && (
                          <p className="notice-row-who">{t(T.noticeReadNot, { names: notYet.map(nameOf).join(', ') })}</p>
                        )}
                      </div>
                    );
                  })()}
                  <div className="field-row" style={{ marginTop: 12, flexWrap: 'wrap' }}>
                    {n.targets.length > 0 && (
                      <button className="secondary" disabled={noticeBusy} onClick={() => widenNotice(n)}>
                        {t(T.noticeToEveryone)}
                      </button>
                    )}
                    <button className="secondary" disabled={noticeBusy} onClick={() => toggleNotice(n.id, !n.active)}>
                      {n.active ? t(T.noticeDown) : t(T.noticeUp)}
                    </button>
                    <button className="danger" disabled={noticeBusy} onClick={() => removeNotice(n.id)}>
                      {t(T.noticeDelete)}
                    </button>
                  </div>
                </div>
              );
            })
          )}

            </>
          )}
            </>
          )}

          <h1 className="admin-sec">
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

          <h1 className="admin-sec">
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
                        <td>{new Date(n.deletedAt).toLocaleString(HTML_LANG[locale])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </>
          )}

          <h1 className="admin-sec">
            <button className="collapse-h1" aria-expanded={onlineOpen} onClick={() => setOnlineOpen((v) => !v)}>
              {t(T.onlineTitle)}
              <span className="collapse-caret" aria-hidden>
                {onlineOpen ? '⌃' : '⌄'}
              </span>
            </button>
          </h1>
          {onlineOpen && (
            <>
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
                      {u.hidden && <span className="online-tag">{t(T.onlineHidden)}</span>}
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

          {/* 방향이 반대다 — 위는 남이 보이는 것, 여기는 내가 남에게 보이는 것 */}
          <div className="card" style={{ marginTop: 12 }}>
            <div className="field-label">{t(T.minePresence)}</div>
            <div className="seg-group">
              {[true, false].map((v) => (
                <button
                  key={String(v)}
                  className={`seg ${(presence?.myPresence ?? true) === v ? 'on' : ''}`}
                  disabled={presence === null || presenceBusy}
                  onClick={() => setMyPresence(v)}
                >
                  {v ? t(T.minePresenceOn) : t(T.minePresenceOff)}
                </button>
              ))}
            </div>
            <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
              {t(T.minePresenceNote)}
            </p>
          </div>
            </>
          )}

          <h1 className="admin-sec">
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
            <p className="hint" style={{ marginBottom: 8 }}>
              {t(T.statsActiveNote)}
            </p>
            <p className="hint" style={{ marginBottom: 12 }}>
              {t(T.statsPushNote)}
            </p>
            {!presence?.stats?.length ? (
              <p className="hint">{t(T.statsEmpty)}</p>
            ) : (
              <>
              <div className="segbar" style={{ marginBottom: 12 }}>
                <button className={statsSort === 'active' ? 'on' : ''} onClick={() => setStatsSort('active')}>
                  {t(T.statsSortActive)}
                </button>
                <button className={statsSort === 'last' ? 'on' : ''} onClick={() => setStatsSort('last')}>
                  {t(T.statsSortLast)}
                </button>
              </div>
              <div className="stats-scroll">
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>{t(T.statsUser)}</th>
                      <th>{t(T.statsLast)}</th>
                      <th>{t(T.statsPush)}</th>
                      <th>{t(T.statsActive)}</th>
                      <th>{t(T.statsWeek)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStats.map((u) => (
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
                        {/*
                          * 켜짐/꺼짐을 글자로 적는다. 아이콘 + title로 두면 폰에서는 아무것도 알 수 없다 —
                          * 터치 화면에는 마우스를 올릴 수가 없어서 title이 뜨지 않는다.
                          */}
                        <td className={u.pushDevices > 0 ? 'push-on' : 'push-off'}>
                          {u.pushDevices > 0 ? t(T.statsPushOn) : t(T.statsPushOff)}
                        </td>
                        <td>{dur(u.activeSeconds)}</td>
                        <td>{u.weekSeconds > 0 ? dur(u.weekSeconds) : t(T.statsNever)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
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
