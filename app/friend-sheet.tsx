'use client';

import { useState } from 'react';
import { useT } from './i18n';

/**
 * 모임 화면에서 뜨는 두 개의 친구 창.
 *
 *  - FriendRequestSheet : 참가자를 눌렀을 때. 그 사람과의 사이를 정한다.
 *  - AddFriendSheet     : ＋친구를 눌렀을 때. 아직 안 들어온 친구를 대신 넣는다.
 *
 * 껍데기는 푸시 안내(app/push-nudge.tsx)와 같은 .nudge를 쓴다 — 이 앱의 바텀시트다.
 */

const T = {
  close: { ko: '닫기', en: 'Close' },

  // 참가자를 눌렀을 때
  addFriend: { ko: '친구 추가', en: 'Add friend' },
  rosterTitle: { ko: '지금 명단', en: 'In this meetup' },
  adminTitle: { ko: '모임 명단 고치기', en: 'Edit the roster' },
  addSection: { ko: '넣을 사람', en: 'Add someone' },
  drop: { ko: '빼기', en: 'Remove' },
  dropping: { ko: '빼는 중…', en: 'Removing…' },
  dropAsk: { ko: '{name}님을 이 모임 명단에서 뺄까요?', en: 'Remove {name} from this meetup?' },
  dropDone: { ko: '{name}님을 뺐어요.', en: 'Removed {name}.' },
  adminHint: {
    ko: '관리자라 친구가 아닌 사람도 넣고 뺄 수 있어요. 지난 모임도요.',
    en: 'As an admin you can add or remove anyone, including on past meetups.',
  },
  hostHint: {
    ko: '지난 모임이라 그날 온 친구를 뒤늦게 넣거나 뺄 수 있어요. 알림은 가지 않아요.',
    en: 'This meetup already happened — add or remove who actually came. Nobody is notified.',
  },
  sending: { ko: '보내는 중…', en: 'Sending…' },
  sent: { ko: '친구 요청을 보냈어요.', en: 'Friend request sent.' },
  waiting: { ko: '친구 요청을 보내 둔 사이예요. 상대가 수락하면 친구가 돼요.', en: 'Your request is waiting for them to accept.' },
  cancel: { ko: '요청 취소', en: 'Cancel request' },
  incoming: { ko: '이분이 먼저 친구 요청을 보냈어요.', en: 'They sent you a friend request.' },
  accept: { ko: '수락', en: 'Accept' },
  decline: { ko: '거절', en: 'Decline' },
  already: { ko: '이미 친구예요.', en: 'You’re already friends.' },
  unfriend: { ko: '친구 끊기', en: 'Remove friend' },
  unfriendAsk: { ko: '{name}님과 친구를 끊을까요?', en: 'Remove {name} from your friends?' },
  me: { ko: '나예요.', en: 'That’s you.' },
  needLogin: { ko: '카카오 로그인 후 친구를 추가할 수 있어요.', en: 'Log in with Kakao to add friends.' },

  // ＋친구
  addTitle: { ko: '친구를 모임에 넣기', en: 'Add a friend' },
  addHint: {
    ko: '누르면 바로 참가자로 들어가요. 본인이 나가기를 누르면 빠져요.',
    en: 'They join right away — they can leave on their own.',
  },
  addNone: { ko: '이 모임에 넣을 친구가 없어요.', en: 'No friends left to add to this meetup.' },
  put: { ko: '넣기', en: 'Add' },
  putting: { ko: '넣는 중…', en: 'Adding…' },
  putAsk: { ko: '{name}님을 이 모임에 넣을까요?', en: 'Add {name} to this meetup?' },
  putDone: { ko: '{name}님을 넣었어요.', en: '{name} is in.' },
  failed: { ko: '처리하지 못했어요. 잠시 후 다시 시도해주세요.', en: 'That didn’t go through. Try again shortly.' },
};

export interface Person {
  id: string;
  name: string;
  avatar: string | null;
}

/** 나와 그 사람 사이 */
export type Tie = 'none' | 'outgoing' | 'incoming' | 'friends' | 'me';

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="nudge-back" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="nudge" onClick={(e) => e.stopPropagation()}>
        <h2 className="nudge-title">{title}</h2>
        {children}
        <div className="nudge-actions">
          <button className="secondary" onClick={onClose}>
            {t(T.close)}
          </button>
        </div>
      </div>
    </div>
  );
}

function Face({ p }: { p: Person }) {
  return <span className="avatar-sm">{p.avatar ? <img src={p.avatar} alt="" /> : p.name.slice(0, 1)}</span>;
}

export function FriendRequestSheet({
  person,
  tie,
  signedIn,
  onClose,
  onDone,
}: {
  person: Person;
  tie: Tie;
  signedIn: boolean;
  onClose: () => void;
  /** 목록을 다시 읽어야 할 때 */
  onDone: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const t = useT();

  async function run(path: string, method: 'POST' | 'DELETE', okText?: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(method === 'POST' && path === '/api/friends'
          ? { body: JSON.stringify({ userId: person.id }) }
          : {}),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg(data?.error ?? t(T.failed));
        return;
      }
      await onDone();
      if (okText) setMsg(okText);
      else onClose();
    } catch {
      setMsg(t(T.failed));
    } finally {
      setBusy(false);
    }
  }

  const body = () => {
    if (tie === 'me') return <p className="nudge-why">{t(T.me)}</p>;
    if (!signedIn) return <p className="nudge-why">{t(T.needLogin)}</p>;
    if (tie === 'friends')
      return (
        <>
          <p className="nudge-why">{t(T.already)}</p>
          <button
            className="link-btn danger-text"
            disabled={busy}
            onClick={() => {
              if (confirm(t(T.unfriendAsk, { name: person.name }))) run(`/api/friends/${person.id}`, 'DELETE');
            }}
          >
            {t(T.unfriend)}
          </button>
        </>
      );
    if (tie === 'outgoing')
      return (
        <>
          <p className="nudge-why">{t(T.waiting)}</p>
          <button className="link-btn danger-text" disabled={busy} onClick={() => run(`/api/friends/${person.id}`, 'DELETE')}>
            {t(T.cancel)}
          </button>
        </>
      );
    if (tie === 'incoming')
      return (
        <>
          <p className="nudge-why">{t(T.incoming)}</p>
          <div className="nudge-actions">
            <button className="big-cta" disabled={busy} onClick={() => run(`/api/friends/${person.id}/accept`, 'POST')}>
              {t(T.accept)}
            </button>
            <button className="link-btn danger-text" disabled={busy} onClick={() => run(`/api/friends/${person.id}`, 'DELETE')}>
              {t(T.decline)}
            </button>
          </div>
        </>
      );
    return (
      <button className="big-cta" disabled={busy} onClick={() => run('/api/friends', 'POST', t(T.sent))}>
        {busy ? t(T.sending) : t(T.addFriend)}
      </button>
    );
  };

  return (
    <Shell title={person.name} onClose={onClose}>
      <div className="friend-sheet-who">
        <Face p={person} />
      </div>
      {body()}
      {msg && <p className="nudge-msg">{msg}</p>}
    </Shell>
  );
}

export function AddFriendSheet({
  postId,
  candidates,
  roster,
  asAdmin,
  onClose,
  onDone,
}: {
  postId: string;
  /** 아직 이 모임에 없는 사람들 (관리자는 회원 전체, 그 밖에는 내 친구) */
  candidates: Person[];
  /** 주면 「지금 명단」에서 뺄 수 있다 — 관리자, 그리고 지난 모임의 호스트 */
  roster?: Person[];
  /** 안내 문구를 가른다 — 관리자는 회원 전체를, 호스트는 친구만 넣을 수 있다 */
  asAdmin?: boolean;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [dropped, setDropped] = useState<Set<string>>(new Set());
  const t = useT();

  async function add(p: Person) {
    // 대신 넣는 일이라 한 번 더 묻는다 — 남의 이름이 명단에 올라가는 일이다
    if (!confirm(t(T.putAsk, { name: p.name }))) return;
    setBusy(p.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/posts/${postId}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: p.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg(data?.error ?? t(T.failed));
        return;
      }
      setAdded((s) => new Set(s).add(p.id));
      setMsg(t(T.putDone, { name: p.name }));
      await onDone();
    } catch {
      setMsg(t(T.failed));
    } finally {
      setBusy(null);
    }
  }

  /** 관리자만 — 남을 명단에서 뺀다 */
  async function drop(p: Person) {
    if (!confirm(t(T.dropAsk, { name: p.name }))) return;
    setBusy(p.id);
    setMsg(null);
    try {
      const res = await fetch(`/api/posts/${postId}/participants`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: p.id }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMsg(data?.error ?? t(T.failed));
        return;
      }
      setDropped((s) => new Set(s).add(p.id));
      setMsg(t(T.dropDone, { name: p.name }));
      await onDone();
    } catch {
      setMsg(t(T.failed));
    } finally {
      setBusy(null);
    }
  }

  const left = candidates.filter((p) => !added.has(p.id));
  const staying = (roster ?? []).filter((p) => !dropped.has(p.id));

  return (
    <Shell title={roster ? t(T.adminTitle) : t(T.addTitle)} onClose={onClose}>
      <p className="nudge-why">{roster ? t(asAdmin ? T.adminHint : T.hostHint) : t(T.addHint)}</p>

      {/* 관리자에게만 보이는 칸 — 잘못 올라간 이름을 여기서 뺀다 */}
      {roster && staying.length > 0 && (
        <>
          <div className="field-label" style={{ margin: '14px 0 6px' }}>
            {t(T.rosterTitle)}
          </div>
          <ul className="online-list friend-sheet-list" style={{ marginBottom: 18 }}>
            {staying.map((p) => (
              <li key={p.id}>
                <Face p={p} />
                <span className="online-name">{p.name}</span>
                <span className="friend-actions">
                  <button className="link-btn danger-text" disabled={busy === p.id} onClick={() => drop(p)}>
                    {busy === p.id ? t(T.dropping) : t(T.drop)}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {roster && left.length > 0 && (
        <div className="field-label" style={{ margin: '0 0 6px' }}>{t(T.addSection)}</div>
      )}
      {left.length === 0 ? (
        <p className="hint">{t(T.addNone)}</p>
      ) : (
        <ul className="online-list friend-sheet-list">
          {left.map((p) => (
            <li key={p.id}>
              <Face p={p} />
              <span className="online-name">{p.name}</span>
              <span className="friend-actions">
                <button className="link-btn strong" disabled={busy === p.id} onClick={() => add(p)}>
                  {busy === p.id ? t(T.putting) : t(T.put)}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="nudge-msg">{msg}</p>}
    </Shell>
  );
}
