'use client';

import { useEffect, useState } from 'react';
import { useT } from './i18n';
import { formatCents, venmoLink } from '@/lib/money';

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
  headsWithExtra: { ko: '{n}명 + 외부 {x}명', en: '{n} here + {x} outside' },
  payNeeded: { ko: '받을 계좌를 먼저 넣어주세요', en: 'Add a payment method first' },
  payNeededDesc: {
    ko: 'Venmo나 Zelle을 넣어두면 알림에 보내기 링크가 같이 나가요. 프로필에도 저장됩니다.',
    en: 'With Venmo or Zelle on file, the alert carries a link to pay you. It’s saved to your profile too.',
  },
  venmoPh: { ko: 'Venmo 아이디 (@ 없이)', en: 'Venmo username (no @)' },
  zellePh: { ko: 'Zelle 전화번호 또는 이메일', en: 'Zelle phone or email' },
  savePayAndSend: { ko: '저장하고 알림 보내기', en: 'Save and notify' },
  skipPay: { ko: '나중에 넣고 그냥 보내기', en: 'Skip and notify anyway' },
  addItem: { ko: '+ 항목 추가', en: '+ Add an item' },
  dropItem: { ko: '이 항목 빼기', en: 'Remove this item' },
  whoPays: { ko: '누가 나눠 내나요', en: 'Who splits it' },
  everyone: { ko: '참가자 전원', en: 'Everyone' },
  somePeople: { ko: '고른 사람만', en: 'Only who I pick' },
  pickHint: { ko: '내기에서 진 사람들처럼, 일부만 낼 때 골라주세요.', en: 'For a bet — pick who actually pays.' },

  payTo: { ko: '{name}님에게 보내주세요', en: 'Send to {name}' },
  yourShare: { ko: '내가 보낼 금액', en: 'Your share' },
  payeeIsYou: { ko: '내가 받는 정산이에요.', en: 'You’re collecting this one.' },
  nothingToPay: { ko: '보낼 금액이 없어요.', en: 'You owe nothing here.' },
  total: { ko: '합계', en: 'Total' },
  venmoGo: { ko: 'Venmo로 보내기', en: 'Pay with Venmo' },
  venmoMissing: {
    ko: '{name}님이 아직 Venmo 아이디를 등록하지 않았어요.',
    en: '{name} hasn’t added a Venmo username yet.',
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
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([{ ...EMPTY }]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // 받을 계좌가 비어 있을 때 저장 직전에 한 번 물어보는 화면
  const [askPay, setAskPay] = useState(false);
  const [venmoInput, setVenmoInput] = useState('');
  const [zelleInput, setZelleInput] = useState('');

  async function copyZelle(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 클립보드를 막아둔 브라우저 — 값은 화면에 그대로 보이므로 손으로 옮기면 된다 */
    }
  }

  async function load() {
    const res = await fetch(`/api/posts/${postId}/settlement`);
    if (res.ok) setSettlement((await res.json()).settlement ?? null);
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

  /** 계좌를 넣지 않았으면 저장 전에 한 번 묻는다 — 링크 없는 알림은 반쪽짜리다 */
  function requestSave() {
    if (!myVenmo && !myZelle && !askPay) {
      setVenmoInput('');
      setZelleInput('');
      setAskPay(true);
      return;
    }
    save();
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
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t(T.failed));
      setSettlement(data.settlement ?? null);
      setEditing(false);
      setAskPay(false);
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

  const inMeetup = participants.some((p) => p.id === currentUserId);
  // 참가하지 않았으면 정산이 있는지조차 보이지 않는다 (금액·받을 계좌가 담긴 화면이다)
  if (!inMeetup && !isAdmin) return null;
  if (loading) return null;

  const mine = settlement?.shares.find((s) => s.userId === currentUserId);
  const isPayee = settlement?.payee.id === currentUserId;
  const canEdit = Boolean(currentUserId) && (!settlement || isPayee);

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
              <p style={{ fontWeight: 600, margin: '0 0 14px' }}>{t(T.payeeIsYou)}</p>
            ) : mine ? (
              <div style={{ marginBottom: 16 }}>
                <div className="settle-eyebrow">{t(T.yourShare)}</div>
                <div className="settle-mine">{formatCents(mine.cents)}</div>
                <div style={{ color: 'var(--text-dim)', fontSize: 13.5, marginTop: 2 }}>
                  {t(T.payTo, { name: settlement.payee.name })}
                </div>
                {settlement.payee.venmo && (
                  <a
                    className="link-btn strong"
                    style={{ marginTop: 10, display: 'inline-block' }}
                    href={venmoLink(settlement.payee.venmo, mine.cents, noteLabel)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t(T.venmoGo)}
                  </a>
                )}
                {/* Zelle은 열어줄 링크가 없어서 값을 보여주고 복사시킨다 */}
                {settlement.payee.zelle && (
                  <div className="pay-zelle">
                    <span className="pay-zelle-label">{t(T.zelleLabel)}</span>
                    <span className="pay-zelle-value">{settlement.payee.zelle}</span>
                    <button className="link-btn" onClick={() => copyZelle(settlement.payee.zelle!)}>
                      {copied ? t(T.copied) : t(T.copy)}
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
                          .map((id) => participants.find((p) => p.id === id)?.name ?? '?')
                          .join(', ')}
                      </span>
                    )}
                    {/* 총 금액을 몇 명이 나누는지 — 외부 인원이 있으면 어디서 왔는지도 밝힌다 */}
                    <span className="settle-item-who">
                      {t(T.perHead, {
                        heads:
                          item.extraPeople > 0
                            ? t(T.headsWithExtra, { n: item.heads - item.extraPeople, x: item.extraPeople })
                            : String(item.heads),
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
                      {participants.map((p) => (
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

            {askPay && (
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
                <div className="field-row" style={{ marginTop: 10 }}>
                  <button
                    disabled={busy || (!venmoInput.trim() && !zelleInput.trim())}
                    onClick={savePayThenSend}
                  >
                    {busy ? t(T.saving) : t(T.savePayAndSend)}
                  </button>
                  {/* 현금으로 받을 수도 있으니 막지는 않는다 */}
                  <button className="secondary" disabled={busy} onClick={() => { setAskPay(false); save(); }}>
                    {t(T.skipPay)}
                  </button>
                </div>
              </div>
            )}

            <div className="field-row" style={{ marginTop: 16 }}>
              <button disabled={busy} onClick={requestSave}>
                {busy ? t(T.saving) : t(T.save)}
              </button>
              <button className="secondary" disabled={busy} onClick={() => setEditing(false)}>
                {t(T.cancel)}
              </button>
            </div>
          </>
        )}

        {msg && <div className={`msg ${msg.type}`} style={{ marginTop: 14 }}>{msg.text}</div>}
      </div>
    </>
  );
}
