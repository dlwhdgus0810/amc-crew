'use client';

import { useEffect, useState } from 'react';
import { useLocale, useT } from './i18n';
import { formatCents, myShareParts, parseAmountCents, payNote, splitWithExtras, venmoLink } from '@/lib/money';
import { timeAgo } from '@/lib/datefmt';

const T = {
  title: { ko: '정산', en: 'Settle up' },
  none: {
    ko: '먹은 값이나 내기 결과를 나눠 계산해요. 각자에게 얼마 보낼지 알림이 갑니다.',
    en: 'Split the bill or a bet. Everyone gets an alert with their share.',
  },
  start: { ko: '정산 시작하기', en: 'Start a settle-up' },
  edit: { ko: '고치기', en: 'Edit' },
  cancel: { ko: '취소', en: 'Cancel' },
  remove: { ko: '정산 지우기', en: 'Delete the settle-up' },
  removeConfirm: { ko: '정산을 지울까요?', en: 'Delete this settle-up?' },
  save: { ko: '저장하고 알림 보내기', en: 'Save and notify' },
  saving: { ko: '보내는 중…', en: 'Sending…' },
  saved: { ko: '{n}명에게 알림을 보냈어요.', en: 'Notified {n} people.' },
  savedNobody: { ko: '저장했어요. 보낼 사람이 없어요.', en: 'Saved. Nobody to notify.' },
  failed: { ko: '저장하지 못했어요.', en: 'Couldn’t save.' },

  itemName: { ko: '항목', en: 'Item' },
  itemNamePh: { ko: '예: 레인비', en: 'e.g. Lane fee' },
  amount: { ko: '총 금액', en: 'Total amount' },
  amountHint: {
    ko: '나눈 금액이 아니라 **총 금액**을 넣어주세요. 인원수대로 나눠서 계산해요.',
    en: 'Enter the **total**, not each person’s share — it gets divided by the number of people.',
  },
  extra: { ko: '이 모임에 없는 사람', en: 'People not in this meetup' },
  extraHint: {
    ko: '앱에 없는 사람도 같이 냈다면 인원수만 더해주세요. 머릿수에 들어가 1인당 금액이 줄어요.',
    en: 'Add how many people outside the app chipped in — they count as heads, so each share gets smaller.',
  },
  perHead: { ko: '{heads}명이 나눠 · 1인당 {each}', en: 'Split {heads} ways · {each} each' },
  // 외부 인원이 있으면 "3명 + 외부 1명"이 통째로 주어라, perHead의 '명이'를 다시 붙이면
  // "1명명이 나눠"가 된다. 문장을 따로 둔다.
  perHeadExtra: {
    ko: '{n}명 + 외부 {x}명이 나눠 · 1인당 {each}',
    en: 'Split among {n} here + {x} outside · {each} each',
  },
  payNeeded: { ko: '받을 계좌를 먼저 넣어주세요', en: 'Add a payment method first' },
  payNeededDesc: {
    ko: 'Venmo나 Zelle을 넣어두면 알림에 보내기 링크가 같이 나가요. 프로필에도 저장됩니다.',
    en: 'With Venmo or Zelle on file, the alert carries a link to pay you. It’s saved to your profile too.',
  },
  venmoPh: { ko: 'Venmo 아이디 (@ 없이)', en: 'Venmo username (no @)' },
  zellePh: { ko: 'Zelle 전화번호 또는 이메일', en: 'Zelle phone or email' },
  savePayAndSend: { ko: '저장하고 알림 보내기', en: 'Save and notify' },
  skipPay: { ko: '나중에 넣고 그냥 보내기', en: 'Skip and notify anyway' },
  livePerHead: { ko: '{heads}명이 나눠 · 1인당 {each}', en: 'Split {heads} ways · {each} each' },
  liveNeedAmount: { ko: '총 금액을 넣으면 1인당 얼마인지 보여드려요.', en: 'Enter the total to see each share.' },
  confirmTitle: { ko: '이렇게 보낼게요', en: 'Here’s what goes out' },
  confirmTotal: { ko: '총 {amount}', en: '{amount} total' },
  confirmOutside: {
    ko: '이 중 참가자 몫은 {mine}이고, 나머지 {out}은 모임에 없는 사람 몫이라 직접 받으셔야 해요.',
    en: 'Members cover {mine}; the remaining {out} is the outsiders’ share, which you collect yourself.',
  },
  confirmNotify: { ko: '{n}명에게 알림이 갑니다', en: '{n} people get an alert' },
  confirmNobody: { ko: '보낼 사람이 없어요. 저장만 됩니다.', en: 'Nobody to notify — this only saves.' },
  confirmMine: { ko: '{name} (나) — 받는 사람', en: '{name} (you) — collecting' },
  confirmSend: { ko: '확인하고 보내기', en: 'Confirm and send' },
  confirmBack: { ko: '다시 고치기', en: 'Back to editing' },
  badAmount: { ko: '금액을 올바르게 넣어주세요 (예: 12.50).', en: 'Enter a valid amount (e.g. 12.50).' },
  badMembers: { ko: '나눠 낼 사람을 골라주세요.', en: 'Pick who splits it.' },
  addItem: { ko: '+ 항목 추가', en: '+ Add an item' },
  guestsTitle: { ko: '모임에 없는 친구', en: 'Friends not in the meetup' },
  guestsAdd: { ko: '+ 친구 넣기', en: '+ Add a friend' },
  guestsNone: { ko: '넣을 수 있는 친구가 없어요.', en: 'No friends left to add.' },
  guestsHint: {
    ko: '같이 냈는데 모임에 이름이 없는 친구를 넣어요. 참가자로 들어가지는 않고, 정산에만 포함돼 알림을 받아요.',
    en: 'For friends who chipped in but aren’t in the meetup. They don’t join it — they just get counted here, and notified.',
  },
  dropItem: { ko: '이 항목 빼기', en: 'Remove this item' },
  whoPays: { ko: '누가 나눠 내나요', en: 'Who splits it' },
  everyone: { ko: '참가자 전원', en: 'Everyone' },
  somePeople: { ko: '고른 사람만', en: 'Only who I pick' },
  pickHint: { ko: '내기에서 진 사람들처럼, 일부만 낼 때 골라주세요.', en: 'For a bet — pick who actually pays.' },

  payTo: { ko: '{name}님에게 보내주세요', en: 'Send to {name}' },
  yourShare: { ko: '내가 보낼 금액', en: 'Your share' },
  payeeIsYou: { ko: '내가 받는 정산이에요.', en: 'You’re collecting this one.' },
  myPayInfo: { ko: '내 받을 계좌', en: 'Where you get paid' },
  forwardTitle: { ko: '모임 밖 인원 {n}명 · 1인당 {each}', en: '{n} outside the meetup · {each} each' },
  forwardHint: {
    ko: '앱에 없는 분들에게는 알림이 못 가요. 위 Venmo 옆 "링크 복사"로 직접 보내주세요.',
    en: 'People outside the app get no alert — use “Copy link” next to Venmo above and send it yourself.',
  },
  copyLink: { ko: '링크 복사', en: 'Copy link' },
  nothingToPay: { ko: '보낼 금액이 없어요.', en: 'You owe nothing here.' },
  total: { ko: '합계', en: 'Total' },
  // 아이디에 링크가 걸려 있다는 걸 알려주는 한마디 — 금액이 채워진다는 게 요점이다
  venmoTapHint: { ko: '누르면 금액까지 채워져요', en: 'Tap — amount filled in' },
  remindOpen: { ko: '다시 알리기', en: 'Send a reminder' },
  remindWho: { ko: '누구에게 다시 알릴까요?', en: 'Who should get a reminder?' },
  remindSend: { ko: '{n}명에게 알리기', en: 'Remind {n}' },
  remindSending: { ko: '보내는 중…', en: 'Sending…' },
  remindDone: { ko: '{n}명에게 다시 알렸어요.', en: 'Reminded {n} people.' },
  remindFailed: { ko: '알림을 보내지 못했어요.', en: 'Couldn’t send that.' },
  remindNever: { ko: '아직 안 보냄', en: 'not sent yet' },
  remindAgo: { ko: '{when} 보냄', en: 'sent {when}' },
  remindCancel: { ko: '그만두기', en: 'Cancel' },
  remindNote: {
    ko: '처음과 같은 문구가 갑니다. 잠금화면 알림은 쌓이지 않고 이전 것을 대신해요.',
    en: 'The same message goes out. On the lock screen it replaces the earlier one instead of stacking.',
  },
  venmoMine: {
    ko: '프로필 → 받을 계좌에 Venmo나 Zelle을 넣어두면 다른 사람이 바로 보낼 수 있어요.',
    en: 'Add Venmo or Zelle under Profile → How you get paid so people can send it.',
  },
  zelleLabel: { ko: 'Zelle', en: 'Zelle' },
  copy: { ko: '복사', en: 'Copy' },
  copied: { ko: '복사했어요', en: 'Copied' },
  noPayInfo: {
    ko: '{name}님이 아직 받을 계좌를 등록하지 않았어요. 직접 물어봐주세요.',
    en: '{name} hasn’t added a payment method yet — ask them directly.',
  },
};

interface Share {
  userId: string;
  name: string;
  avatar: string | null;
  cents: number;
}
interface Item {
  id: string;
  label: string;
  amountCents: number;
  scope: 'all' | 'some';
  memberIds: string[];
  extraPeople: number;
  heads: number;
}
export interface Settlement {
  payee: { id: string; name: string; venmo: string | null; zelle: string | null };
  items: Item[];
  shares: Share[];
  totalCents: number;
  /** 모임에 없지만 정산에 넣은 사람들 */
  extraMembers: { id: string; name: string }[];
  /** 앱 밖 사람에게 전달할 짧은 링크의 코드 (/v/<code>) */
  shortCode: string | null;
  createdAt: string;
}

/** 편집 중인 항목 — 금액은 사용자가 치는 그대로 문자열로 들고 있다가 저장할 때 서버가 검증한다 */
interface Draft {
  label: string;
  amount: string;
  scope: 'all' | 'some';
  memberIds: string[];
  /** 이 앱에 없는 사람 수 — 사용자가 치는 그대로 두고 저장할 때 서버가 본다 */
  extra: string;
}

const EMPTY: Draft = { label: '', amount: '', scope: 'all', memberIds: [], extra: '' };

/** 한 항목을 몇 명이 나누는지 (참가자 + 외부 인원) */
function headsOf(draft: Draft, participantIds: string[]): number {
  const members = draft.scope === 'all' ? participantIds : draft.memberIds;
  return members.length + Number(draft.extra || 0);
}

/**
 * 보내기 전에 보여줄 계산 결과. 서버(lib/db/settlements.ts)와 같은 규칙으로 나눈다 —
 * 화면에서 본 숫자와 실제로 나가는 숫자가 다르면 안 된다.
 */
function preview(drafts: Draft[], participantIds: string[]) {
  const perUser = new Map<string, number>();
  let total = 0;
  for (const d of drafts) {
    const cents = parseAmountCents(d.amount);
    if (cents === null) return null;
    const members = d.scope === 'all' ? participantIds : d.memberIds;
    if (members.length === 0) return null;
    for (const [id, c] of splitWithExtras(cents, members, Number(d.extra || 0))) {
      perUser.set(id, (perUser.get(id) ?? 0) + c);
    }
    total += cents;
  }
  return { perUser, total };
}

export default function SettlementPanel({
  postId,
  participants,
  currentUserId,
  isAdmin,
  myVenmo,
  myZelle,
  noteLabel,
}: {
  postId: string;
  participants: { id: string; name: string }[];
  currentUserId?: string;
  /** 관리자는 참가하지 않은 모임의 정산도 볼 수 있다 */
  isAdmin?: boolean;
  /** 보는 사람의 받을 계좌 — 정산을 만들 때 비어 있으면 먼저 채우게 한다 */
  myVenmo?: string | null;
  myZelle?: string | null;
  /** Venmo 메모에 넣을 문구 (모임 이름) */
  noteLabel: string;
}) {
  const t = useT();
  const locale = useLocale();
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([{ ...EMPTY }]);
  /*
   * 모임에는 없지만 이 정산에 넣은 친구들. 참가자와 합쳐 "낼 사람" 명단이 되고,
   * 그 명단이 곧 전원 계산의 전원이다.
   */
  const [extras, setExtras] = useState<{ id: string; name: string }[]>([]);
  const [friends, setFriends] = useState<{ id: string; name: string }[]>([]);
  const [pickFriends, setPickFriends] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // 복사한 값 자체를 담는다 — 복사 버튼이 여러 개라 boolean으로는 어느 것인지 구분이 안 된다
  const [copied, setCopied] = useState<string | null>(null);
  // 받을 계좌가 비어 있을 때 저장 직전에 한 번 물어보는 화면
  const [askPay, setAskPay] = useState(false);
  // 저장 직전 확인 화면 (계산 결과를 보여주고 한 번 물어본다)
  const [confirming, setConfirming] = useState(false);
  const [venmoInput, setVenmoInput] = useState('');
  const [zelleInput, setZelleInput] = useState('');
  /* 다시 알리기 — 마지막으로 보낸 시각(사람별)과 지금 고른 사람들 */
  const [notifiedAt, setNotifiedAt] = useState<Record<string, string>>({});
  const [remindOpen, setRemindOpen] = useState(false);
  const [remindPick, setRemindPick] = useState<Set<string>>(new Set());

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* 클립보드를 막아둔 브라우저 — 값은 화면에 그대로 보이므로 손으로 옮기면 된다 */
    }
  }

  async function load() {
    const res = await fetch(`/api/posts/${postId}/settlement`);
    if (!res.ok) return;
    const data = await res.json();
    setSettlement(data.settlement ?? null);
    // 받을 사람에게만 내려온다 (없으면 빈 객체)
    setNotifiedAt(data.notifiedAt ?? {});
  }

  /** 고른 사람들에게 같은 알림을 다시 보낸다 */
  async function sendRemind() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/posts/${postId}/settlement/remind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userIds: [...remindPick] }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setMsg({ type: 'err', text: data?.error ?? t(T.remindFailed) });
      return;
    }
    setMsg({ type: 'ok', text: t(T.remindDone, { n: data?.sent ?? remindPick.size }) });
    setRemindOpen(false);
    setRemindPick(new Set());
    // 마지막으로 보낸 시각이 사람마다 바뀌었다
    void load();
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  /*
   * 카드에서 /p/<id>#settle 로 들어오면 이 자리로 내려준다.
   *
   * 브라우저에 맡길 수 없다 — 이 영역은 정산을 받아온 뒤에야 그려져서, 해시가 처리되는
   * 시점에는 DOM에 없다. 그리기가 끝난(loading=false) 다음에 직접 옮기고, 라우터가
   * 이동 직후 맨 위로 되돌리는 것에 덮이지 않도록 한 박자 미룬다.
   */
  useEffect(() => {
    if (loading || window.location.hash !== '#settle') return;
    // smooth로 하면 애니메이션 도중 다른 스크롤에 끊겨 제자리로 돌아온다 — 즉시 옮긴다
    const timer = setTimeout(
      () => document.getElementById('settle')?.scrollIntoView({ block: 'start' }),
      300
    );
    return () => clearTimeout(timer);
  }, [loading]);

  function startEditing() {
    setExtras(settlement?.extraMembers ?? []);
    // 친구 목록은 편집을 시작할 때만 받는다 (정산을 보기만 하는 사람에게는 필요 없다)
    if (friends.length === 0) {
      fetch('/api/friends')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setFriends((d.friends ?? []).map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }))))
        .catch(() => {});
    }
    setDrafts(
      settlement && settlement.items.length > 0
        ? settlement.items.map((i) => ({
            label: i.label,
            amount: (i.amountCents / 100).toFixed(2),
            scope: i.scope,
            memberIds: i.memberIds,
            extra: i.extraPeople > 0 ? String(i.extraPeople) : '',
          }))
        : [{ ...EMPTY }]
    );
    setMsg(null);
    setEditing(true);
  }

  function patch(index: number, next: Partial<Draft>) {
    setDrafts((list) => list.map((d, i) => (i === index ? { ...d, ...next } : d)));
  }

  function toggleMember(index: number, userId: string) {
    setDrafts((list) =>
      list.map((d, i) =>
        i === index
          ? {
              ...d,
              memberIds: d.memberIds.includes(userId)
                ? d.memberIds.filter((m) => m !== userId)
                : [...d.memberIds, userId],
            }
          : d
      )
    );
  }

  /**
   * 바로 보내지 않고 계산 결과를 먼저 보여준다.
   * 금액과 인원이 맞는지는 숫자를 눈으로 봐야 알 수 있고, 알림은 되돌릴 수 없다.
   */
  function requestSave() {
    setMsg(null);
    for (const d of drafts) {
      if (parseAmountCents(d.amount) === null) {
        setMsg({ type: 'err', text: t(T.badAmount) });
        return;
      }
      if (d.scope === 'some' && d.memberIds.length === 0) {
        setMsg({ type: 'err', text: t(T.badMembers) });
        return;
      }
    }
    // 계좌가 없으면 확인 화면에서 같이 받는다 (창을 두 번 띄우지 않는다)
    if (!myVenmo && !myZelle) {
      setVenmoInput('');
      setZelleInput('');
      setAskPay(true);
    }
    setConfirming(true);
  }

  /** 확인 화면에서 "보내기" — 계좌를 넣었으면 그것부터 저장한다 */
  async function confirmAndSend() {
    if (askPay && (venmoInput.trim() || zelleInput.trim())) {
      await savePayThenSend();
      return;
    }
    setAskPay(false);
    await save();
  }

  /** 계좌를 먼저 저장한 뒤 정산을 보낸다 */
  async function savePayThenSend() {
    const venmo = venmoInput.trim();
    const zelle = zelleInput.trim();
    if (!venmo && !zelle) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(venmo ? { venmo } : {}), ...(zelle ? { zelle } : {}) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg({ type: 'err', text: data.error ?? t(T.failed) });
      setBusy(false);
      return;
    }
    setBusy(false);
    setAskPay(false);
    await save();
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/posts/${postId}/settlement`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: drafts.map((d) => ({ ...d, extraPeople: d.extra.trim() ? Number(d.extra) : 0 })),
          extraMemberIds: extras.map((e) => e.id),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t(T.failed));
      setSettlement(data.settlement ?? null);
      setEditing(false);
      setAskPay(false);
      setConfirming(false);
      setMsg({
        type: 'ok',
        text: data.notified > 0 ? t(T.saved, { n: data.notified }) : t(T.savedNobody),
      });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(t(T.removeConfirm))) return;
    setBusy(true);
    const res = await fetch(`/api/posts/${postId}/settlement`, { method: 'DELETE' });
    if (res.ok) {
      setSettlement(null);
      setEditing(false);
      setMsg(null);
    }
    setBusy(false);
  }

  /*
   * 앱 밖 인원이 몇 명이고 1인당 얼마인지 — 받는 사람 화면의 전달용 안내에 쓴다.
   * 서버(lib/db/settlements.ts의 outsiderPerHead)와 같은 규칙으로 센다.
   */
  const outsiders = (settlement?.items ?? []).reduce(
    (acc, i) =>
      i.extraPeople > 0 && i.heads > 0
        ? { heads: Math.max(acc.heads, i.extraPeople), each: acc.each + Math.floor(i.amountCents / i.heads) }
        : acc,
    { heads: 0, each: 0 }
  );
  /* 앱 밖 인원이 있을 때만 전달할 링크가 의미가 있다 (없으면 $0짜리 결제창이 된다) */
  const forwardUrl =
    settlement?.shortCode && outsiders.each > 0 && typeof window !== 'undefined'
      ? `${window.location.origin}/v/${settlement.shortCode}`
      : '';

  /* 낼 사람 명단 — "전원이 나눠요"의 전원이 이 명단이다 */
  const payers = [...participants, ...extras.filter((e) => !participants.some((p) => p.id === e.id))];
  const inMeetup = participants.some((p) => p.id === currentUserId);
  // 참가하지 않았으면 정산이 있는지조차 보이지 않는다 (금액·받을 계좌가 담긴 화면이다)
  if (!inMeetup && !isAdmin) return null;
  if (loading) return null;

  const mine = settlement?.shares.find((s) => s.userId === currentUserId);
  const isPayee = settlement?.payee.id === currentUserId;

  /**
   * Venmo 메모 — 모임 이름 뒤에 내 몫의 내역을 붙인다 (규칙은 lib/money.ts에 있다).
   *
   * 낼 사람 명단은 `payers`가 아니라 서버가 준 extraMembers로 짓는다. payers의 extras는
   * **편집을 시작할 때만** 채워지는 상태라(startEditing), 보기만 하는 사람에게는 늘 비어 있다.
   * 그대로 쓰면 머릿수가 모자라 항목마다 몫이 부풀고, 그 차이가 마지막 항목에 몰려
   * 음수까지 나온다. 서버의 payerIds(참가자 + 정산에만 넣은 사람)와 같은 명단이어야 한다.
   */
  function myNote(): string {
    if (!settlement || !currentUserId || !mine) return noteLabel;
    const ids = [
      ...participants.map((p) => p.id),
      ...settlement.extraMembers.map((e) => e.id).filter((id) => !participants.some((p) => p.id === id)),
    ];
    const parts = myShareParts(settlement.items, ids, currentUserId, mine.cents);
    // 셈이 어긋나 이상한 값이 나오면 메모에는 아무것도 싣지 않는다 (모임 이름만)
    return payNote(noteLabel, parts.some((p) => p.cents <= 0) ? [] : parts);
  }
  const canEdit = Boolean(currentUserId) && (!settlement || isPayee);
  /* 다시 알릴 수 있는 사람 = 받을 사람(또는 관리자), 대상 = 낼 금액이 있는 사람들 */
  const canRemind = Boolean(settlement) && (isPayee || isAdmin);
  const remindTargets = (settlement?.shares ?? []).filter((sh) => sh.userId !== settlement?.payee.id);

  return (
    <>
      {/* 카드의 "정산" 버튼이 /p/<id>#settle 로 보내므로 앵커가 필요하다 */}
      <h2 id="settle" style={{ scrollMarginTop: 72 }}>{t(T.title)}</h2>
      <div className="card">
        {!settlement && !editing && (
          <>
            <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>{t(T.none)}</p>
            {inMeetup && (
              <button className="secondary" onClick={startEditing}>
                {t(T.start)}
              </button>
            )}
          </>
        )}

        {settlement && !editing && (
          <>
            {/* 내가 낼 금액을 맨 위에 — 대부분은 이것만 보러 들어온다 */}
            {isPayee ? (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontWeight: 600, margin: '0 0 10px' }}>{t(T.payeeIsYou)}</p>

                {/* 본인 계좌를 여기서도 보여준다 — 밖에 있는 사람에게 옮겨 적을 일이 있다 */}
                {(settlement.payee.venmo || settlement.payee.zelle) && (
                  <>
                    <div className="settle-eyebrow">{t(T.myPayInfo)}</div>
                    {settlement.payee.venmo && (
                      <div className="pay-zelle">
                        <span className="pay-zelle-label">Venmo</span>
                        {/*
                         * 전달할 링크가 있으면 아이디 자체를 링크로 건다 — 긴 주소를 한 줄
                         * 따로 늘어놓지 않아도 눌러서 확인하고 복사 버튼으로 넘길 수 있다.
                         */}
                        {forwardUrl ? (
                          <a className="pay-zelle-value" href={forwardUrl} target="_blank" rel="noreferrer">
                            @{settlement.payee.venmo}
                          </a>
                        ) : (
                          <span className="pay-zelle-value">@{settlement.payee.venmo}</span>
                        )}
                        <button
                          className="link-btn"
                          onClick={() => copyText(forwardUrl || settlement.payee.venmo!)}
                        >
                          {copied === (forwardUrl || settlement.payee.venmo)
                            ? t(T.copied)
                            : forwardUrl
                              ? t(T.copyLink)
                              : t(T.copy)}
                        </button>
                      </div>
                    )}
                    {settlement.payee.zelle && (
                      <div className="pay-zelle">
                        <span className="pay-zelle-label">{t(T.zelleLabel)}</span>
                        <span className="pay-zelle-value">{settlement.payee.zelle}</span>
                        <button className="link-btn" onClick={() => copyText(settlement.payee.zelle!)}>
                          {copied === settlement.payee.zelle ? t(T.copied) : t(T.copy)}
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* 앱 밖 인원이 있으면 얼마씩인지와, 알림이 못 간다는 사실만 알려준다 */}
                {outsiders.heads > 0 && outsiders.each > 0 && (
                  <div className="settle-forward">
                    <strong>{t(T.forwardTitle, { n: String(outsiders.heads), each: formatCents(outsiders.each) })}</strong>
                    <p>{t(T.forwardHint)}</p>
                  </div>
                )}
              </div>
            ) : mine ? (
              <div style={{ marginBottom: 16 }}>
                <div className="settle-eyebrow">{t(T.yourShare)}</div>
                <div className="settle-mine">{formatCents(mine.cents)}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: 13.5, marginTop: 2 }}>
                  {t(T.payTo, { name: settlement.payee.name })}
                </div>
                {/*
                  * Venmo도 Zelle과 같은 줄 모양이되, 아이디 자체가 링크다 —
                  * 누르면 금액과 메모가 채워진 채로 Venmo가 열린다.
                  *
                  * 복사 버튼은 두지 않는다. 옮겨 적을 필요가 없는데 버튼이 있으면
                  * 그게 이 줄에서 할 일처럼 보여서, 정작 한 번에 가는 길을 지나치게 된다.
                  * 대신 누르면 어떻게 되는지 한마디로 적어 둔다.
                  */}
                {settlement.payee.venmo && (
                  <div className="pay-zelle">
                    <span className="pay-zelle-label">Venmo</span>
                    <a
                      className="pay-zelle-value"
                      href={venmoLink(settlement.payee.venmo, mine.cents, myNote())}
                      target="_blank"
                      rel="noreferrer"
                    >
                      @{settlement.payee.venmo}
                    </a>
                    <span style={{ color: 'var(--text-dim)', fontSize: 12.5 }}>{t(T.venmoTapHint)}</span>
                  </div>
                )}
                {/* Zelle은 열어줄 링크가 없어서 값을 보여주고 복사시킨다 */}
                {settlement.payee.zelle && (
                  <div className="pay-zelle">
                    <span className="pay-zelle-label">{t(T.zelleLabel)}</span>
                    <span className="pay-zelle-value">{settlement.payee.zelle}</span>
                    <button className="link-btn" onClick={() => copyText(settlement.payee.zelle!)}>
                      {copied === settlement.payee.zelle ? t(T.copied) : t(T.copy)}
                    </button>
                  </div>
                )}
                {!settlement.payee.venmo && !settlement.payee.zelle && (
                  <p style={{ color: 'var(--text-dim)', fontSize: 12.5, margin: '10px 0 0' }}>
                    {t(T.noPayInfo, { name: settlement.payee.name })}
                  </p>
                )}
              </div>
            ) : (
              currentUserId && <p style={{ color: 'var(--text-dim)', margin: '0 0 14px' }}>{t(T.nothingToPay)}</p>
            )}

            <ul className="settle-items">
              {settlement.items.map((item) => (
                <li key={item.id}>
                  <span className="settle-item-label">
                    {item.label}
                    {item.scope === 'some' && (
                      <span className="settle-item-who">
                        {item.memberIds
                          .map((id) => payers.find((p) => p.id === id)?.name ?? '?')
                          .join(', ')}
                      </span>
                    )}
                    {/* 총 금액을 몇 명이 나누는지 — 외부 인원이 있으면 어디서 왔는지도 밝힌다 */}
                    <span className="settle-item-who">
                      {item.extraPeople > 0
                        ? t(T.perHeadExtra, {
                            n: item.heads - item.extraPeople,
                            x: item.extraPeople,
                            each: formatCents(Math.floor(item.amountCents / Math.max(1, item.heads))),
                          })
                        : t(T.perHead, {
                            heads: String(item.heads),
                            each: formatCents(Math.floor(item.amountCents / Math.max(1, item.heads))),
                          })}
                    </span>
                  </span>
                  <span className="settle-item-amount">{formatCents(item.amountCents)}</span>
                </li>
              ))}
              <li className="settle-total">
                <span>{t(T.total)}</span>
                <span>{formatCents(settlement.totalCents)}</span>
              </li>
            </ul>

            <ul className="settle-shares">
              {settlement.shares.map((s) => (
                <li key={s.userId}>
                  <span>{s.name}</span>
                  <span>{formatCents(s.cents)}</span>
                </li>
              ))}
            </ul>

            {isPayee && !settlement.payee.venmo && !settlement.payee.zelle && (
              <p style={{ color: 'var(--text-dim)', fontSize: 12.5, margin: '12px 2px 0' }}>{t(T.venmoMine)}</p>
            )}

            {/*
              * 다시 알리기 — 한 번 간 알림은 못 보고 지나치기 쉽다.
              * 받을 사람에게만 보이고, 낼 금액이 있는 사람만 고를 수 있다.
              */}
            {canRemind && remindTargets.length > 0 && !remindOpen && (
              <button className="link-btn" style={{ marginTop: 10 }} onClick={() => {
                setRemindPick(new Set(remindTargets.map((r) => r.userId)));
                setRemindOpen(true);
              }}>
                {t(T.remindOpen)}
              </button>
            )}

            {canRemind && remindOpen && (
              <div className="remind-box">
                <div className="field-label">{t(T.remindWho)}</div>
                <ul className="remind-list">
                  {remindTargets.map((r) => {
                    const on = remindPick.has(r.userId);
                    const at = notifiedAt[r.userId];
                    return (
                      <li key={r.userId}>
                        <label>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() =>
                              setRemindPick((prev) => {
                                const next = new Set(prev);
                                if (on) next.delete(r.userId);
                                else next.add(r.userId);
                                return next;
                              })
                            }
                          />
                          <span className="remind-name">{r.name}</span>
                          <span className="remind-amount">{formatCents(r.cents)}</span>
                          {/* 방금 보냈다는 게 보이면 대개 다시 안 누른다 — 규칙 대신 이 한 줄로 막는다 */}
                          <span className="remind-when">
                            {at ? t(T.remindAgo, { when: timeAgo(at, locale) }) : t(T.remindNever)}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <p className="hint" style={{ margin: '2px 2px 10px' }}>{t(T.remindNote)}</p>
                <div className="field-row">
                  <button className="secondary" disabled={busy || remindPick.size === 0} onClick={sendRemind}>
                    {busy ? t(T.remindSending) : t(T.remindSend, { n: remindPick.size })}
                  </button>
                  <button className="link-btn" disabled={busy} onClick={() => setRemindOpen(false)}>
                    {t(T.remindCancel)}
                  </button>
                </div>
              </div>
            )}

            {canEdit && (
              <div className="field-row" style={{ marginTop: 16 }}>
                <button className="secondary" disabled={busy} onClick={startEditing}>
                  {t(T.edit)}
                </button>
                <button className="danger" disabled={busy} onClick={remove}>
                  {t(T.remove)}
                </button>
              </div>
            )}
          </>
        )}

        {editing && (
          <>
            {drafts.map((d, i) => (
              <div key={i} className="settle-draft">
                <div className="field-row">
                  <input
                    type="text"
                    placeholder={t(T.itemNamePh)}
                    value={d.label}
                    maxLength={40}
                    onChange={(e) => patch(i, { label: e.target.value })}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={d.amount}
                    onChange={(e) => patch(i, { amount: e.target.value })}
                    style={{ maxWidth: 120 }}
                  />
                </div>

                <p className="settle-hint">{t(T.amountHint).replace(/\*\*/g, '')}</p>

                <div className="segbar" style={{ marginTop: 8 }}>
                  <button className={d.scope === 'all' ? 'on' : ''} onClick={() => patch(i, { scope: 'all' })}>
                    {t(T.everyone)}
                  </button>
                  <button className={d.scope === 'some' ? 'on' : ''} onClick={() => patch(i, { scope: 'some' })}>
                    {t(T.somePeople)}
                  </button>
                </div>

                {d.scope === 'some' && (
                  <>
                    <p className="settle-hint">{t(T.pickHint)}</p>
                    <div className="settle-people">
                      {payers.map((p) => (
                        <button
                          key={p.id}
                          className={`settle-chip ${d.memberIds.includes(p.id) ? 'on' : ''}`}
                          aria-pressed={d.memberIds.includes(p.id)}
                          onClick={() => toggleMember(i, p.id)}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <div className="field-row" style={{ marginTop: 10, alignItems: 'center' }}>
                  <span className="settle-extra-label">{t(T.extra)}</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0"
                    value={d.extra}
                    onChange={(e) => patch(i, { extra: e.target.value.replace(/[^0-9]/g, '') })}
                    style={{ maxWidth: 80 }}
                  />
                </div>
                <p className="settle-hint">{t(T.extraHint)}</p>

                {/* 총 금액과 인원이 채워지는 대로 1인당 얼마인지 바로 보여준다 */}
                <div className="settle-live">
                  {(() => {
                    const cents = parseAmountCents(d.amount);
                    const heads = headsOf(d, payers.map((p) => p.id));
                    if (cents === null || heads === 0) return t(T.liveNeedAmount);
                    return t(T.livePerHead, {
                      heads: String(heads),
                      each: formatCents(Math.floor(cents / heads)),
                    });
                  })()}
                </div>

                {drafts.length > 1 && (
                  <button
                    className="link-btn danger-text"
                    style={{ marginTop: 8 }}
                    onClick={() => setDrafts((list) => list.filter((_, k) => k !== i))}
                  >
                    {t(T.dropItem)}
                  </button>
                )}
              </div>
            ))}

            <div className="field-row" style={{ marginTop: 12 }}>
              {drafts.length < 10 && (
                <button className="secondary" onClick={() => setDrafts((list) => [...list, { ...EMPTY }])}>
                  {t(T.addItem)}
                </button>
              )}
            </div>

            {/*
              * 모임에는 없는데 같이 낸 친구 넣기.
              * 여기 넣으면 낼 사람 명단에 들어가서 "전원이 나눠요"에도 포함되고, 알림도 받는다.
              */}
            <div className="settle-guests">
              <div className="field-label">{t(T.guestsTitle)}</div>
              {extras.length > 0 && (
                <div className="settle-people">
                  {extras.map((e) => (
                    <button
                      key={e.id}
                      className="settle-chip on"
                      aria-pressed
                      onClick={() => setExtras((list) => list.filter((x) => x.id !== e.id))}
                    >
                      {e.name} ✕
                    </button>
                  ))}
                </div>
              )}
              {pickFriends ? (
                (() => {
                  const pickable = friends.filter(
                    (f) => !participants.some((p) => p.id === f.id) && !extras.some((e) => e.id === f.id)
                  );
                  return pickable.length === 0 ? (
                    <p className="hint">{t(T.guestsNone)}</p>
                  ) : (
                    <div className="settle-people">
                      {pickable.map((f) => (
                        <button
                          key={f.id}
                          className="settle-chip"
                          onClick={() => setExtras((list) => [...list, f])}
                        >
                          ＋ {f.name}
                        </button>
                      ))}
                    </div>
                  );
                })()
              ) : (
                <button className="link-btn" onClick={() => setPickFriends(true)}>
                  {t(T.guestsAdd)}
                </button>
              )}
              <p className="hint" style={{ marginTop: 6 }}>
                {t(T.guestsHint)}
              </p>
            </div>

            {confirming && (
              <div className="settle-confirm">
                <strong>{t(T.confirmTitle)}</strong>
                {(() => {
                  const p = preview(drafts, payers.map((x) => x.id));
                  if (!p) return null;
                  const rows = [...p.perUser].filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1]);
                  const others = rows.filter(([id]) => id !== currentUserId);
                  return (
                    <>
                      <ul className="settle-shares">
                        {rows.map(([id, cents]) => {
                          const name = payers.find((x) => x.id === id)?.name ?? '?';
                          return (
                            <li key={id}>
                              <span>{id === currentUserId ? t(T.confirmMine, { name }) : name}</span>
                              <span>{formatCents(cents)}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="settle-confirm-total">{t(T.confirmTotal, { amount: formatCents(p.total) })}</p>
                      {/* 외부 인원이 있으면 줄 합계와 총액이 다르다 — 그 차이를 밝혀둔다 */}
                      {(() => {
                        const mine = rows.reduce((n, [, c]) => n + c, 0);
                        if (mine >= p.total) return null;
                        return (
                          <p className="settle-confirm-note">
                            {t(T.confirmOutside, {
                              mine: formatCents(mine),
                              out: formatCents(p.total - mine),
                            })}
                          </p>
                        );
                      })()}
                      <p className="settle-confirm-note">
                        {others.length > 0 ? t(T.confirmNotify, { n: others.length }) : t(T.confirmNobody)}
                      </p>
                    </>
                  );
                })()}

                <div className="field-row" style={{ marginTop: 14 }}>
                  <button disabled={busy} onClick={confirmAndSend}>
                    {busy ? t(T.saving) : t(T.confirmSend)}
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setConfirming(false);
                      setAskPay(false);
                    }}
                  >
                    {t(T.confirmBack)}
                  </button>
                </div>
              </div>
            )}

            {askPay && confirming && (
              <div className="settle-pay-ask">
                <strong>{t(T.payNeeded)}</strong>
                <p>{t(T.payNeededDesc)}</p>
                <input
                  type="text"
                  placeholder={t(T.venmoPh)}
                  value={venmoInput}
                  maxLength={30}
                  onChange={(e) => setVenmoInput(e.target.value)}
                />
                <input
                  type="text"
                  placeholder={t(T.zellePh)}
                  value={zelleInput}
                  maxLength={60}
                  onChange={(e) => setZelleInput(e.target.value)}
                />
                {/* 넣지 않아도 위의 "확인하고 보내기"로 그냥 보낼 수 있다 (현금으로 받는 경우) */}
              </div>
            )}

            {/* 확인 화면이 떠 있는 동안에는 감춘다 — 보내기 버튼이 둘로 보이면 헷갈린다 */}
            {!confirming && (
              <div className="field-row" style={{ marginTop: 16 }}>
                <button disabled={busy} onClick={requestSave}>
                  {busy ? t(T.saving) : t(T.save)}
                </button>
                <button className="secondary" disabled={busy} onClick={() => setEditing(false)}>
                  {t(T.cancel)}
                </button>
              </div>
            )}
          </>
        )}

        {msg && <div className={`msg ${msg.type}`} style={{ marginTop: 14 }}>{msg.text}</div>}
      </div>
    </>
  );
}
