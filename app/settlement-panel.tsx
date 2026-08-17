'use client';

import { useEffect, useState } from 'react';
import { useLocale, useT } from './i18n';
import { formatCents, formatZelle, myShareParts, parseAmountCents, payNote, splitWithExtras, venmoLink } from '@/lib/money';
import { timeAgo } from '@/lib/datefmt';

const T = {
  title: { ko: '정산', en: 'Settle up', es: 'Dividir la cuenta' },
  none: {
    ko: '먹은 값이나 내기 결과를 나눠 계산해요. 각자에게 얼마 보낼지 알림이 갑니다.',
    en: 'Split the bill or a bet. Everyone gets an alert with their share.',
    es: 'Divide la cuenta o una apuesta. Cada uno recibe un aviso con lo suyo.',
  },
  start: { ko: '정산 시작하기', en: 'Start a settle-up', es: 'Empezar el reparto' },
  /* 이미 정산이 있을 때 하나 더 — 결제한 사람도, 나눠 낼 사람도 정산마다 다를 수 있다 */
  addMore: { ko: '정산 추가하기', en: 'Add another settle-up', es: 'Añadir otro reparto' },
  edit: { ko: '고치기', en: 'Edit', es: 'Editar' },
  cancel: { ko: '취소', en: 'Cancel', es: 'Cancelar' },
  remove: { ko: '정산 지우기', en: 'Delete the settle-up', es: 'Borrar el reparto' },
  removeConfirm: { ko: '정산을 지울까요?', en: 'Delete this settle-up?', es: '¿Borrar este reparto?' },
  save: { ko: '저장하고 알림 보내기', en: 'Save and notify', es: 'Guardar y avisar' },
  saving: { ko: '보내는 중…', en: 'Sending…', es: 'Enviando…' },
  saved: { ko: '{n}명에게 알림을 보냈어요.', en: 'Notified {n} people.', es: 'Se avisó a {n} personas.' },
  savedNobody: { ko: '저장했어요. 보낼 사람이 없어요.', en: 'Saved. Nobody to notify.', es: 'Guardado. No hay a quién avisar.' },
  failed: { ko: '저장하지 못했어요.', en: 'Couldn’t save.', es: 'No se pudo guardar.' },

  itemName: { ko: '항목', en: 'Item', es: 'Concepto' },
  itemNamePh: { ko: '예: 레인비', en: 'e.g. Lane fee', es: 'p. ej. pista de bolos' },
  amount: { ko: '총 금액', en: 'Total amount', es: 'Importe total' },
  amountHint: {
    ko: '나눈 금액이 아니라 **총 금액**을 넣어주세요. 인원수대로 나눠서 계산해요.',
    en: 'Enter the **total**, not each person’s share — it gets divided by the number of people.',
    es: 'Pon el **total**, no lo de cada uno: se divide entre las personas.',
  },
  extra: { ko: '이 모임에 없는 사람', en: 'People not in this meetup', es: 'Personas que no están en la quedada' },
  extraHint: {
    ko: '앱에 없는 사람도 같이 냈다면 인원수만 더해주세요. 머릿수에 들어가 1인당 금액이 줄어요.',
    en: 'Add how many people outside the app chipped in — they count as heads, so each share gets smaller.',
    es: 'Indica cuántas personas de fuera de la app pusieron dinero: cuentan como cabezas, así que cada parte baja.',
  },
  perHead: { ko: '{heads}명이 나눠 · 1인당 {each}', en: 'Split {heads} ways · {each} each', es: 'Entre {heads} · {each} cada uno' },
  // 외부 인원이 있으면 "3명 + 외부 1명"이 통째로 주어라, perHead의 '명이'를 다시 붙이면
  // "1명명이 나눠"가 된다. 문장을 따로 둔다.
  perHeadExtra: {
    ko: '{n}명 + 외부 {x}명이 나눠 · 1인당 {each}',
    en: 'Split among {n} here + {x} outside · {each} each',
    es: 'Entre {n} aquí + {x} de fuera · {each} cada uno',
  },
  payNeeded: { ko: '받을 계좌를 먼저 넣어주세요', en: 'Add a payment method first', es: 'Añade antes una forma de cobro' },
  payNeededDesc: {
    ko: 'Venmo나 Zelle을 넣어두면 알림에 보내기 링크가 같이 나가요. 프로필에도 저장됩니다.',
    en: 'With Venmo or Zelle on file, the alert carries a link to pay you. It’s saved to your profile too.',
    es: 'Con Venmo o Zelle guardados, el aviso lleva un enlace para pagarte. También queda en tu perfil.',
  },
  venmoPh: { ko: 'Venmo 아이디 (@ 없이)', en: 'Venmo username (no @)', es: 'Usuario de Venmo (sin @)' },
  zellePh: { ko: 'Zelle 전화번호 또는 이메일', en: 'Zelle phone or email', es: 'Teléfono o correo de Zelle' },
  /**
   * 실제로 있었던 일이다 — Zelle만 쓰는 분이 Venmo 칸에 「Zelle」이라고 적었고,
   * 그 값으로 만든 링크가 @Zelle이라는 남의 Venmo 계정으로 갔다.
   */
  payBlankHint: {
    ko: '안 쓰는 쪽은 빈칸으로 두세요. Venmo 칸에 「Zelle」처럼 적으면 그 아이디를 쓰는 다른 사람에게 링크가 걸립니다.',
    en: 'Leave the one you don’t use empty. Typing “Zelle” in the Venmo box links to a stranger who owns that username.',
    es: 'Deja vacío el que no uses. Si escribes «Zelle» en Venmo, el enlace irá a un desconocido con ese usuario.',
  },
  savePayAndSend: { ko: '저장하고 알림 보내기', en: 'Save and notify', es: 'Guardar y avisar' },
  skipPay: { ko: '나중에 넣고 그냥 보내기', en: 'Skip and notify anyway', es: 'Saltar y avisar igualmente' },
  livePerHead: { ko: '{heads}명이 나눠 · 1인당 {each}', en: 'Split {heads} ways · {each} each', es: 'Entre {heads} · {each} cada uno' },
  liveNeedAmount: { ko: '총 금액을 넣으면 1인당 얼마인지 보여드려요.', en: 'Enter the total to see each share.', es: 'Pon el total para ver cuánto toca a cada uno.' },
  confirmTitle: { ko: '이렇게 보낼게요', en: 'Here’s what goes out', es: 'Esto es lo que se envía' },
  confirmTotal: { ko: '총 {amount}', en: '{amount} total', es: '{amount} en total' },
  confirmOutside: {
    ko: '이 중 참가자 몫은 {mine}이고, 나머지 {out}은 모임에 없는 사람 몫이라 직접 받으셔야 해요.',
    en: 'Members cover {mine}; the remaining {out} is the outsiders’ share, which you collect yourself.',
    es: 'Los del grupo cubren {mine}; los {out} restantes son de la gente de fuera, y eso lo cobras tú.',
  },
  confirmNotify: { ko: '{n}명에게 알림이 갑니다', en: '{n} people get an alert', es: '{n} personas reciben aviso' },
  confirmNobody: { ko: '보낼 사람이 없어요. 저장만 됩니다.', en: 'Nobody to notify — this only saves.', es: 'No hay a quién avisar: esto solo guarda.' },
  confirmMine: { ko: '{name} (나) — 받는 사람', en: '{name} (you) — collecting', es: '{name} (tú) — cobras tú' },
  confirmSend: { ko: '확인하고 보내기', en: 'Confirm and send', es: 'Confirmar y enviar' },
  confirmBack: { ko: '다시 고치기', en: 'Back to editing', es: 'Volver a editar' },
  badAmount: { ko: '금액을 올바르게 넣어주세요 (예: 12.50).', en: 'Enter a valid amount (e.g. 12.50).', es: 'Introduce un importe válido (p. ej. 12.50).' },
  badMembers: { ko: '나눠 낼 사람을 골라주세요.', en: 'Pick who splits it.', es: 'Elige quién lo divide.' },
  addItem: { ko: '+ 항목 추가', en: '+ Add an item', es: '+ Añadir concepto' },
  guestsTitle: { ko: '모임에 없는 친구', en: 'Friends not in the meetup', es: 'Amigos que no están en la quedada' },
  guestsAdd: { ko: '+ 친구 넣기', en: '+ Add a friend', es: '+ Añadir amigo' },
  guestsNone: { ko: '넣을 수 있는 친구가 없어요.', en: 'No friends left to add.', es: 'No queda ningún amigo por añadir.' },
  guestsHint: {
    ko: '같이 냈는데 모임에 이름이 없는 친구를 넣어요. 참가자로 들어가지는 않고, 정산에만 포함돼 알림을 받아요.',
    en: 'For friends who chipped in but aren’t in the meetup. They don’t join it — they just get counted here, and notified.',
    es: 'Para amigos que pusieron dinero pero no están en la quedada. No entran en ella: solo cuentan aquí y reciben aviso.',
  },
  dropItem: { ko: '이 항목 빼기', en: 'Remove this item', es: 'Quitar este concepto' },
  whoPays: { ko: '누가 나눠 내나요', en: 'Who splits it', es: 'Quién lo divide' },
  everyone: { ko: '참가자 전원', en: 'Everyone', es: 'Todos' },
  somePeople: { ko: '고른 사람만', en: 'Only who I pick', es: 'Solo quien yo elija' },
  pickHint: { ko: '내기에서 진 사람들처럼, 일부만 낼 때 골라주세요.', en: 'For a bet — pick who actually pays.', es: 'Para una apuesta: elige quién paga de verdad.' },

  payTo: { ko: '{name}님에게 보내주세요', en: 'Send to {name}', es: 'Enviar a {name}' },
  yourShare: { ko: '내가 보낼 금액', en: 'Your share', es: 'Lo tuyo' },
  payeeIsYou: { ko: '내가 받는 정산이에요.', en: 'You’re collecting this one.', es: 'Este lo cobras tú.' },
  myPayInfo: { ko: '내 받을 계좌', en: 'Where you get paid', es: 'Dónde te pagan' },
  forwardTitle: { ko: '모임 밖 인원 {n}명 · 1인당 {each}', en: '{n} outside the meetup · {each} each', es: '{n} de fuera · {each} cada uno' },
  forwardHint: {
    ko: '앱에 없는 분들에게는 알림이 못 가요. 위 Venmo 옆 "링크 복사"로 직접 보내주세요.',
    en: 'People outside the app get no alert — use “Copy link” next to Venmo above and send it yourself.',
    es: 'La gente de fuera no recibe aviso: usa «Copiar enlace» junto a Venmo y envíaselo tú.',
  },
  copyLink: { ko: '링크 복사', en: 'Copy link', es: 'Copiar enlace' },
  nothingToPay: { ko: '보낼 금액이 없어요.', en: 'You owe nothing here.', es: 'Aquí no debes nada.' },
  total: { ko: '합계', en: 'Total', es: 'Total' },

  /* ── 여러 개일 때: 접힌 줄과 맨 위 요약 ── */
  /** 접힌 줄의 「누가 받는 정산인지」 자리 — 내가 받는 것이면 이름 대신 이 말 */
  rowMe: { ko: '내가 받을 정산', en: 'You’re collecting', es: 'Tú cobras' },
  rowShare: { ko: '내 몫 {amount}', en: 'Your share {amount}', es: 'Tu parte {amount}' },
  rowNothing: { ko: '낼 것 없음', en: 'Nothing to pay', es: 'Nada que pagar' },
  rowGet: { ko: '받을 돈 {amount}', en: 'You get {amount}', es: 'Recibes {amount}' },
  rowOpen: { ko: '자세히 보기', en: 'See the details', es: 'Ver el detalle' },
  rowClose: { ko: '접기', en: 'Collapse', es: 'Plegar' },
  sumSend: { ko: '보낼 돈', en: 'You send', es: 'Tú envías' },
  sumGet: { ko: '받을 돈', en: 'You get back', es: 'Te devuelven' },
  sumSettled: { ko: '주고받을 게 없어요.', en: 'Nothing to settle for you.', es: 'No tienes nada que saldar.' },
  // 아이디에 링크가 걸려 있다는 걸 알려주는 한마디 — 금액이 채워진다는 게 요점이다
  venmoTapHint: { ko: '누르면 금액까지 채워져요', en: 'Tap — amount filled in', es: 'Toca: el importe ya va puesto' },
  remindOpen: { ko: '다시 알리기', en: 'Send a reminder', es: 'Volver a avisar' },
  remindWho: { ko: '누구에게 다시 알릴까요?', en: 'Who should get a reminder?', es: '¿A quién se lo recordamos?' },
  remindSend: { ko: '{n}명에게 알리기', en: 'Remind {n}', es: 'Avisar a {n}' },
  remindSending: { ko: '보내는 중…', en: 'Sending…', es: 'Enviando…' },
  remindDone: { ko: '{n}명에게 다시 알렸어요.', en: 'Reminded {n} people.', es: 'Se recordó a {n} personas.' },
  remindFailed: { ko: '알림을 보내지 못했어요.', en: 'Couldn’t send that.', es: 'No se pudo enviar.' },
  remindNever: { ko: '아직 안 보냄', en: 'not sent yet', es: 'aún sin enviar' },
  remindAgo: { ko: '{when} 보냄', en: 'sent {when}', es: 'enviado {when}' },
  remindCancel: { ko: '그만두기', en: 'Cancel', es: 'Cancelar' },
  remindNote: {
    ko: '처음과 같은 문구가 갑니다. 잠금화면 알림은 쌓이지 않고 이전 것을 대신해요.',
    en: 'The same message goes out. On the lock screen it replaces the earlier one instead of stacking.',
    es: 'Se envía el mismo mensaje. En la pantalla de bloqueo sustituye al anterior en vez de acumularse.',
  },
  venmoMine: {
    ko: '프로필 → 받을 계좌에 Venmo나 Zelle을 넣어두면 다른 사람이 바로 보낼 수 있어요.',
    en: 'Add Venmo or Zelle under Profile → How you get paid so people can send it.',
    es: 'Añade Venmo o Zelle en Perfil → Dónde te pagan para que puedan enviártelo.',
  },
  zelleLabel: { ko: 'Zelle', en: 'Zelle', es: 'Zelle' },
  copy: { ko: '복사', en: 'Copy', es: 'Copiar' },
  copied: { ko: '복사했어요', en: 'Copied', es: 'Copiado' },
  noPayInfo: {
    ko: '{name}님이 아직 받을 계좌를 등록하지 않았어요. 직접 물어봐주세요.',
    en: '{name} hasn’t added a payment method yet — ask them directly.',
    es: '{name} aún no ha puesto forma de cobro: pregúntale directamente.',
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
  /** 이 정산 하나를 가리키는 값 — 고치기·지우기·다시 알리기가 다 이걸로 간다 */
  id: string;
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

/**
 * 정산 **하나**. 목록을 그리는 것은 아래 SettlementPanel이다.
 *
 * settlement가 null이면 「새로 만드는 중」이고, 그때는 편집기로 열린 채 시작한다.
 * 읽어오기와 목록 관리는 부모가 하고, 여기는 한 장을 그리고 고치는 일만 한다 —
 * 그렇게 나눠야 정산이 세 개일 때도 각자의 편집 상태가 서로 섞이지 않는다.
 */
function OneSettlement({
  postId,
  participants,
  currentUserId,
  isAdmin,
  myVenmo,
  myZelle,
  noteLabel,
  settlement,
  notifiedAt,
  startOpen,
  startCollapsed,
  onChanged,
  onCancelNew,
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
  /** 그릴 정산. null이면 새로 만드는 자리다 */
  settlement: Settlement | null;
  /** 이 정산으로 누구에게 언제 마지막으로 알렸는지 (받을 사람에게만 내려온다) */
  notifiedAt: Record<string, string>;
  /** 새로 만드는 자리는 편집기가 열린 채로 시작한다 */
  startOpen?: boolean;
  /**
   * 접힌 채로 시작할지 — 정산이 둘 이상일 때 부모가 켠다.
   *
   * 하나뿐일 때는 안 접는다. 하나짜리를 접는 것은 누를 거리를 하나 늘리는 일일 뿐이다.
   */
  startCollapsed?: boolean;
  /** 저장·삭제 뒤 부모가 목록을 다시 읽는다 */
  onChanged: () => void;
  /** 새로 만들다 그만둘 때 — 부모가 이 자리를 치운다 */
  onCancelNew?: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const [editing, setEditing] = useState(Boolean(startOpen));
  /*
   * 펼쳐져 있나.
   *
   * 길이의 대부분은 「누가 얼마」 명단이다 — 참가자가 열다섯이면 정산 하나에 열다섯 줄이고,
   * 정산이 여섯이면 그것만 아흔 줄이다. 그래서 접는 것은 개수가 아니라 그 명단을 접는 일이다.
   * 접힌 줄이 **답을 들고 있어야** 뜻이 있다 — 아래 요약 줄 참고.
   */
  const [open, setOpen] = useState(!startCollapsed);
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
  /* 다시 알리기 — 지금 고른 사람들 (마지막으로 보낸 시각은 위 prop이다) */
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

  /** 고른 사람들에게 같은 알림을 다시 보낸다 */
  async function sendRemind() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/posts/${postId}/settlement/remind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementId: settlement?.id, userIds: [...remindPick] }),
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
    // 마지막으로 보낸 시각이 사람마다 바뀌었다 — 부모가 다시 읽는다
    onChanged();
  }

  /*
   * 카드에서 /p/<id>#settle 로 들어오면 이 자리로 내려준다.
   *
   * 브라우저에 맡길 수 없다 — 이 영역은 정산을 받아온 뒤에야 그려져서, 해시가 처리되는
   * 시점에는 DOM에 없다. 그리기가 끝난(loading=false) 다음에 직접 옮기고, 라우터가
   * 이동 직후 맨 위로 되돌리는 것에 덮이지 않도록 한 박자 미룬다.
   */
  useEffect(() => {
    if (window.location.hash !== '#settle') return;
    // smooth로 하면 애니메이션 도중 다른 스크롤에 끊겨 제자리로 돌아온다 — 즉시 옮긴다
    const timer = setTimeout(
      () => document.getElementById('settle')?.scrollIntoView({ block: 'start' }),
      300
    );
    return () => clearTimeout(timer);
  }, []);

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
          // 고치는 것이면 어느 정산인지 알려준다. 없으면 서버가 새로 만든다
          ...(settlement ? { settlementId: settlement.id } : {}),
          items: drafts.map((d) => ({ ...d, extraPeople: d.extra.trim() ? Number(d.extra) : 0 })),
          extraMemberIds: extras.map((e) => e.id),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t(T.failed));
      setEditing(false);
      setAskPay(false);
      setConfirming(false);
      onChanged();
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
    const res = await fetch(`/api/posts/${postId}/settlement`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlementId: settlement?.id }),
    });
    if (res.ok) {
      setEditing(false);
      setMsg(null);
      onChanged();
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

  /** 받을 사람이 받을 돈 — 자기 몫은 빼고 남들이 낼 것만 */
  const owedToMe = (settlement?.shares ?? [])
    .filter((sh) => sh.userId !== settlement?.payee.id)
    .reduce((n, sh) => n + sh.cents, 0);

  return (
    <>
      <div className="card">
        {/*
          * 접힌 줄. **여기에 답이 다 있어야 한다** — 「정산 1, 2, 3」으로 접으면 셋 다
          * 눌러 봐야 하므로 접은 뜻이 없다. 누가 받는지, 총액, 내가 얼마인지까지 적는다.
          */}
        {settlement && !editing && startCollapsed && (
          <button className="settle-row" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <span className="settle-row-who">{isPayee ? t(T.rowMe) : settlement.payee.name}</span>
            <span className="settle-row-total">{formatCents(settlement.totalCents)}</span>
            <span className={`settle-row-mine${isPayee || mine ? '' : ' muted'}`}>
              {isPayee
                ? t(T.rowGet, { amount: formatCents(owedToMe) })
                : mine
                  ? t(T.rowShare, { amount: formatCents(mine.cents) })
                  : t(T.rowNothing)}
            </span>
            <span className="collapse-caret" aria-hidden>
              {open ? '⌃' : '⌄'}
            </span>
          </button>
        )}

        {settlement && !editing && open && (
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
                        <span className="pay-zelle-value">{formatZelle(settlement.payee.zelle)}</span>
                        <button className="link-btn" onClick={() => copyText(formatZelle(settlement.payee.zelle!))}>
                          {copied === formatZelle(settlement.payee.zelle) ? t(T.copied) : t(T.copy)}
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
                    <span className="pay-zelle-value">{formatZelle(settlement.payee.zelle)}</span>
                    <button className="link-btn" onClick={() => copyText(formatZelle(settlement.payee.zelle!))}>
                      {copied === formatZelle(settlement.payee.zelle) ? t(T.copied) : t(T.copy)}
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
                <p className="warn-line">{t(T.payBlankHint)}</p>
                {/* 넣지 않아도 위의 "확인하고 보내기"로 그냥 보낼 수 있다 (현금으로 받는 경우) */}
              </div>
            )}

            {/* 확인 화면이 떠 있는 동안에는 감춘다 — 보내기 버튼이 둘로 보이면 헷갈린다 */}
            {!confirming && (
              <div className="field-row" style={{ marginTop: 16 }}>
                <button disabled={busy} onClick={requestSave}>
                  {busy ? t(T.saving) : t(T.save)}
                </button>
                {/*
                  * 새로 만들다 그만두면 이 자리를 아예 치운다 — 안 그러면 빈 카드가 남는다.
                  * 고치다 그만두는 것은 읽기 화면으로 돌아가는 것뿐이다.
                  */}
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => (settlement ? setEditing(false) : onCancelNew?.())}
                >
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

/**
 * 이 모임의 정산들 — 없으면 「정산 시작하기」, 있으면 나열하고 아래에 「정산 추가하기」.
 *
 * **한 모임에 여러 개다.** 여행에서 한 사람이 여러 번 결제하고 결제마다 나눠 내는 사람이
 * 다르기 때문이다 — 숙소는 다섯 명, 렌터카는 셋. 정산 하나에 항목을 여러 개 넣는 것으로는
 * 안 되는데, 받을 사람이 정산마다 다르다.
 *
 * 각 정산은 **그 정산을 받을 사람만** 고치고 지운다 (관리자는 예외). 서버도 같은 기준으로
 * 다시 본다 — app/api/posts/[id]/settlement.
 */
export default function SettlementPanel(props: {
  postId: string;
  participants: { id: string; name: string }[];
  currentUserId?: string;
  isAdmin?: boolean;
  myVenmo?: string | null;
  myZelle?: string | null;
  noteLabel: string;
}) {
  const t = useT();
  const [list, setList] = useState<Settlement[] | null>(null);
  const [notifiedAt, setNotifiedAt] = useState<Record<string, Record<string, string>>>({});
  /** 새 정산을 만드는 자리를 하나 열어 둘지 */
  const [adding, setAdding] = useState(false);

  async function load() {
    const res = await fetch(`/api/posts/${props.postId}/settlement`);
    if (!res.ok) return setList([]);
    const data = await res.json();
    setList(data.settlements ?? []);
    setNotifiedAt(data.notifiedAt ?? {});
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.postId]);

  const inMeetup = Boolean(props.currentUserId && props.participants.some((p) => p.id === props.currentUserId));
  // 볼 자격이 없으면 「정산」이라는 제목조차 그리지 않는다 (안쪽 컴포넌트와 같은 기준)
  if (!inMeetup && !props.isAdmin) return null;
  if (list === null) return null;

  /*
   * 맨 위 한 줄 — 「나 얼마 보내면 돼?」
   *
   * 정산이 여럿이면 이게 실제로 찾는 값이다. **받을 사람별로 묶는다**: 같은 사람에게
   * 갈 돈이 세 정산에 흩어져 있어도 보낼 때는 한 번에 보내므로, 나뉜 채로 보여주면
   * 보는 사람이 머릿속에서 더해야 한다.
   */
  const send = new Map<string, number>();
  let get = 0;
  for (const s of list) {
    if (s.payee.id === props.currentUserId) {
      get += s.shares.filter((sh) => sh.userId !== s.payee.id).reduce((n, sh) => n + sh.cents, 0);
      continue;
    }
    const mine = s.shares.find((sh) => sh.userId === props.currentUserId);
    if (mine) send.set(s.payee.name, (send.get(s.payee.name) ?? 0) + mine.cents);
  }
  // 정산이 하나면 카드 자체가 이미 그 말을 한다 — 같은 말을 두 번 하지 않는다
  const showSummary = list.length > 1 && Boolean(props.currentUserId);

  return (
    <>
      {/* 카드의 "정산" 버튼이 /p/<id>#settle 로 보내므로 앵커가 필요하다 */}
      <h2 id="settle" style={{ scrollMarginTop: 72 }}>
        {t(T.title)} {list.length > 1 ? list.length : ''}
      </h2>

      {showSummary && (
        <div className="settle-sum">
          {send.size === 0 && get === 0 && <span className="settle-sum-none">{t(T.sumSettled)}</span>}
          {send.size > 0 && (
            <div className="settle-sum-line">
              <span className="settle-sum-label">{t(T.sumSend)}</span>
              <span className="settle-sum-val">
                {[...send.entries()].map(([name, cents]) => `${name} ${formatCents(cents)}`).join(' · ')}
              </span>
            </div>
          )}
          {get > 0 && (
            <div className="settle-sum-line">
              <span className="settle-sum-label">{t(T.sumGet)}</span>
              <span className="settle-sum-val">{formatCents(get)}</span>
            </div>
          )}
        </div>
      )}

      {list.length === 0 && !adding && (
        <div className="card">
          <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>{t(T.none)}</p>
          {inMeetup && (
            <button className="secondary" onClick={() => setAdding(true)}>
              {t(T.start)}
            </button>
          )}
        </div>
      )}

      {list.map((s) => (
        <OneSettlement
          key={s.id}
          {...props}
          settlement={s}
          notifiedAt={notifiedAt[s.id] ?? {}}
          startCollapsed={list.length > 1}
          onChanged={load}
        />
      ))}

      {/*
        * 새로 만드는 자리. 만들고 나면 목록에 들어오므로 이 자리는 닫는다.
        *
        * key에 목록 길이를 넣는다 — 저장 뒤 다시 「추가하기」를 눌렀을 때 앞서 쓰던 초안이
        * 남아 있으면 안 된다 (같은 자리에 새 컴포넌트가 서야 상태가 비워진다).
        */}
      {adding && (
        <OneSettlement
          key={`new-${list.length}`}
          {...props}
          settlement={null}
          notifiedAt={{}}
          startOpen
          onChanged={() => {
            setAdding(false);
            void load();
          }}
          onCancelNew={() => setAdding(false)}
        />
      )}

      {/* 이미 정산이 있어도 하나 더 — 여러 사람이 각자 여러 개씩 올릴 수 있다 */}
      {list.length > 0 && !adding && inMeetup && (
        <button className="secondary" onClick={() => setAdding(true)}>
          {t(T.addMore)}
        </button>
      )}
    </>
  );
}
