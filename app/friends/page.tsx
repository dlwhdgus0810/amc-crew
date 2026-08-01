'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from '../i18n';

/**
 * 친구 화면 — 지금 접속 중인 친구, 친구 목록, 받은/보낸 요청.
 *
 * 알림 화면의 "친구" 줄에서 들어온다. 친구 요청은 모임 화면의 참가자를 눌러 보내므로
 * 여기에는 사람을 찾는 기능이 없다 — 아는 사이에서만 이어지게 두려는 것이다.
 */

const T = {
  title: { ko: '친구', en: 'Friends' },
  subtitle: {
    ko: '같은 모임에서 만난 사람에게 친구 요청을 보낼 수 있어요. 모임 카드에서 참가자를 눌러보세요.',
    en: 'You can add anyone you’ve shared a meetup with — tap a participant on a meetup card.',
  },
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  loginPrompt: { ko: '카카오 로그인 후 볼 수 있어요.', en: 'Log in with Kakao to see this.' },

  online: { ko: '지금 접속 중', en: 'Online now' },
  onlineNone: { ko: '지금 앱을 보고 있는 친구가 없어요.', en: 'No friends are in the app right now.' },
  justNow: { ko: '방금', en: 'just now' },
  minsAgo: { ko: '{n}분 전', en: '{n}m ago' },

  incoming: { ko: '받은 요청', en: 'Requests' },
  outgoing: { ko: '보낸 요청', en: 'Sent' },
  waiting: { ko: '기다리는 중', en: 'Waiting' },
  list: { ko: '내 친구', en: 'My friends' },
  none: {
    ko: '아직 친구가 없어요. 모임에서 만난 사람에게 요청을 보내보세요!',
    en: 'No friends yet — send a request to someone you’ve met at a meetup!',
  },

  listHint: {
    ko: '친구마다 내 접속 상태를 보여줄지 정할 수 있어요. 감춰도 상대에게는 알리지 않아요.',
    en: 'Choose who can see when you’re online. They aren’t told if you hide it.',
  },
  presenceOn: { ko: '내 접속 보임', en: 'They see you' },
  presenceOff: { ko: '내 접속 숨김', en: 'Hidden from them' },

  accept: { ko: '수락', en: 'Accept' },
  decline: { ko: '거절', en: 'Decline' },
  cancel: { ko: '요청 취소', en: 'Cancel' },
  unfriend: { ko: '친구 끊기', en: 'Remove' },
  unfriendAsk: { ko: '{name}님과 친구를 끊을까요?', en: 'Remove {name} from your friends?' },
  failed: { ko: '처리하지 못했어요. 잠시 후 다시 시도해주세요.', en: 'That didn’t go through. Try again shortly.' },
};

interface Friend {
  id: string;
  name: string;
  avatar: string | null;
  status: 'friends' | 'incoming' | 'outgoing';
  /** 내 접속 상태를 이 친구에게 보여주는지 */
  showsPresence: boolean;
  online: boolean;
  secondsAgo: number | null;
}

interface Data {
  friends: Friend[];
  incoming: Friend[];
  outgoing: Friend[];
}

/** 접속 판정 창이 3분이라, 열어 둔 화면은 금세 옛날 것이 된다 */
const POLL_MS = 15_000;

export default function FriendsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const load = useCallback(async () => {
    // 폴링이라 브라우저가 응답을 캐싱하면 접속 목록이 멈춘 것처럼 보인다
    const res = await fetch('/api/friends', { cache: 'no-store' });
    if (res.status === 401) {
      setNeedLogin(true);
      setData({ friends: [], incoming: [], outgoing: [] });
      return;
    }
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function act(id: string, method: 'POST' | 'DELETE', path: string) {
    setBusy(id);
    setError(null);
    const res = await fetch(path, { method });
    if (!res.ok) setError(t(T.failed));
    await load();
    setBusy(null);
  }

  const accept = (f: Friend) => act(f.id, 'POST', `/api/friends/${f.id}/accept`);

  /** 이 친구에게 내 접속을 보여줄지 뒤집는다 */
  async function togglePresence(f: Friend) {
    setBusy(f.id);
    setError(null);
    const res = await fetch(`/api/friends/${f.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ showPresence: !f.showsPresence }),
    });
    if (!res.ok) setError(t(T.failed));
    await load();
    setBusy(null);
  }

  const drop = (f: Friend) => act(f.id, 'DELETE', `/api/friends/${f.id}`);
  function unfriend(f: Friend) {
    if (!confirm(t(T.unfriendAsk, { name: f.name }))) return;
    drop(f);
  }

  if (!data) return <p className="subtitle">{t(T.loading)}</p>;

  if (needLogin) {
    return (
      <>
        <h1>{t(T.title)}</h1>
        <div className="card">{t(T.loginPrompt)}</div>
      </>
    );
  }

  const face = (f: Friend) => (
    <span className="avatar-sm">{f.avatar ? <img src={f.avatar} alt="" /> : f.name.slice(0, 1)}</span>
  );

  const row = (f: Friend, actions: React.ReactNode) => (
    <li key={f.id} className="friend-row">
      {f.online && <span className="online-dot" aria-hidden="true" />}
      {face(f)}
      <span className="online-name">{f.name}</span>
      <span className="friend-actions">{actions}</span>
    </li>
  );

  const online = data.friends.filter((f) => f.online);

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

      {error && <div className="msg err">{error}</div>}

      <h2>{t(T.online)}</h2>
      <div className="card">
        {online.length === 0 ? (
          <p className="hint">{t(T.onlineNone)}</p>
        ) : (
          <ul className="online-list">
            {online.map((f) => (
              <li key={f.id}>
                <span className="online-dot" aria-hidden="true" />
                {face(f)}
                <span className="online-name">{f.name}</span>
                <span className="online-ago">
                  {(f.secondsAgo ?? 0) < 60 ? t(T.justNow) : t(T.minsAgo, { n: Math.floor((f.secondsAgo ?? 0) / 60) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {data.incoming.length > 0 && (
        <>
          <h2>
            {t(T.incoming)} {data.incoming.length}
          </h2>
          <div className="card">
            <ul className="online-list">
              {data.incoming.map((f) =>
                row(
                  f,
                  <>
                    <button className="link-btn strong" disabled={busy === f.id} onClick={() => accept(f)}>
                      {t(T.accept)}
                    </button>
                    <button className="link-btn danger-text" disabled={busy === f.id} onClick={() => drop(f)}>
                      {t(T.decline)}
                    </button>
                  </>
                )
              )}
            </ul>
          </div>
        </>
      )}

      <h2>
        {t(T.list)} {data.friends.length > 0 ? data.friends.length : ''}
      </h2>
      <div className="card">
        {data.friends.length > 0 && (
          <p className="hint" style={{ marginBottom: 12 }}>
            {t(T.listHint)}
          </p>
        )}
        {data.friends.length === 0 ? (
          <p className="hint">{t(T.none)}</p>
        ) : (
          <ul className="online-list">
            {data.friends.map((f) =>
              row(
                f,
                <>
                  <button
                    className={`link-btn ${f.showsPresence ? '' : 'muted-text'}`}
                    disabled={busy === f.id}
                    aria-pressed={f.showsPresence}
                    onClick={() => togglePresence(f)}
                  >
                    {f.showsPresence ? t(T.presenceOn) : t(T.presenceOff)}
                  </button>
                  <button className="link-btn danger-text" disabled={busy === f.id} onClick={() => unfriend(f)}>
                    {t(T.unfriend)}
                  </button>
                </>
              )
            )}
          </ul>
        )}
      </div>

      {/* 보낸 요청은 있을 때만 — 없을 때 빈 칸을 보여줄 이유가 없다 */}
      {data.outgoing.length > 0 && (
        <>
          <h2>{t(T.outgoing)}</h2>
          <div className="card">
            <ul className="online-list">
              {data.outgoing.map((f) =>
                row(
                  f,
                  <>
                    <span className="hint">{t(T.waiting)}</span>
                    <button className="link-btn danger-text" disabled={busy === f.id} onClick={() => drop(f)}>
                      {t(T.cancel)}
                    </button>
                  </>
                )
              )}
            </ul>
          </div>
        </>
      )}
    </>
  );
}
