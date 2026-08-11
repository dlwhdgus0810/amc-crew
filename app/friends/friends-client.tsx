'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { FRIEND_PRESENCE } from '@/lib/flags';
import { useT } from '../i18n';
import { useRefreshSession } from '../session';

/**
 * 친구 화면 — 지금 접속 중인 친구, 친구 목록, 받은/보낸 요청.
 *
 * 알림 화면의 "친구" 줄에서 들어온다. 친구 요청은 모임 화면의 참가자를 눌러 보내므로
 * 여기에는 사람을 찾는 기능이 없다 — 아는 사이에서만 이어지게 두려는 것이다.
 */

const T = {
  title: { ko: '친구', en: 'Friends', es: 'Amigos' },
  subtitle: {
    ko: '같은 모임에서 만난 사람에게 친구 요청을 보낼 수 있어요. 모임 카드에서 참가자를 눌러보세요.',
    en: 'You can add anyone you’ve shared a meetup with — tap a participant on a meetup card.',
    es: 'Puedes añadir a cualquiera con quien hayas coincidido: toca a alguien en la tarjeta de una quedada.',
  },
  loading: { ko: '불러오는 중…', en: 'Loading…', es: 'Cargando…' },
  loginPrompt: { ko: '카카오 로그인 후 볼 수 있어요.', en: 'Log in with Kakao to see this.', es: 'Entra con Kakao para ver esto.' },

  online: { ko: '지금 접속 중', en: 'Online now', es: 'En línea ahora' },
  onlineNone: { ko: '지금 앱을 보고 있는 친구가 없어요.', en: 'No friends are in the app right now.', es: 'Ahora mismo no hay amigos en la app.' },
  // 숫자만 — 누구인지는 일부러 안 적는다 (lib/flags.ts)
  onlineCount: {
    ko: '친구 {n}명이 지금 앱을 보고 있어요',
    en: '{n} of your friends are in the app right now',
    es: '{n} de tus amistades están en la app ahora mismo',
  },
  onlineCountNone: {
    ko: '지금 앱을 보고 있는 친구가 없어요',
    en: 'None of your friends are in the app right now',
    es: 'Ninguna de tus amistades está en la app ahora mismo',
  },
  justNow: { ko: '방금', en: 'just now', es: 'ahora mismo' },
  minsAgo: { ko: '{n}분 전', en: '{n}m ago', es: 'hace {n} min' },

  incoming: { ko: '받은 요청', en: 'Requests', es: 'Solicitudes' },
  outgoing: { ko: '보낸 요청', en: 'Sent', es: 'Enviadas' },
  waiting: { ko: '기다리는 중', en: 'Waiting', es: 'Pendiente' },
  list: { ko: '내 친구', en: 'My friends', es: 'Mis amigos' },
  none: {
    ko: '아직 친구가 없어요. 모임에서 만난 사람에게 요청을 보내보세요!',
    en: 'No friends yet — send a request to someone you’ve met at a meetup!',
    es: 'Aún no tienes amigos: ¡envía una solicitud a alguien de una quedada!',
  },

  listHint: {
    ko: '이름을 누르면 그 친구의 모임과, 그 친구에게 보여줄 범위를 정할 수 있어요.',
    en: 'Tap a name to see their meetups and choose what they see of yours.',
    es: 'Toca un nombre para ver sus quedadas y elegir qué ve de las tuyas.',
  },

  accept: { ko: '수락', en: 'Accept', es: 'Aceptar' },
  decline: { ko: '거절', en: 'Decline', es: 'Rechazar' },
  cancel: { ko: '요청 취소', en: 'Cancel', es: 'Cancelar' },
  unfriend: { ko: '친구 끊기', en: 'Remove', es: 'Quitar' },
  unfriendAsk: { ko: '{name}님과 친구를 끊을까요?', en: 'Remove {name} from your friends?', es: '¿Quitar a {name} de tus amigos?' },
  failed: { ko: '처리하지 못했어요. 잠시 후 다시 시도해주세요.', en: 'That didn’t go through. Try again shortly.', es: 'No salió bien. Inténtalo de nuevo en un momento.' },
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
  /** 지금 접속 중인 친구 수 — 누구인지는 안 내려온다 */
  onlineCount: number;
}

/**
 * 접속 판정 창이 3분이라, 열어 둔 화면은 금세 옛날 것이 된다.
 * 숫자 하나만 따라가면 되므로 예전(15초)보다 느긋하게 묻는다.
 */
const POLL_MS = 30_000;

/** 서버가 첫 화면 몫으로 미리 읽어 둔 것 (page.tsx) */
export interface FriendsInitial {
  data: Data;
  needLogin: boolean;
}

export default function FriendsPage({ initial }: { initial: FriendsInitial }) {
  const [data, setData] = useState<Data | null>(initial.data);
  const [needLogin, setNeedLogin] = useState(initial.needLogin);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  const refresh = useRefreshSession();

  const load = useCallback(async () => {
    // 폴링이라 브라우저가 응답을 캐싱하면 접속 목록이 멈춘 것처럼 보인다
    const res = await fetch('/api/friends', { cache: 'no-store' });
    if (res.status === 401) {
      setNeedLogin(true);
      setData({ friends: [], incoming: [], outgoing: [], onlineCount: 0 });
      return;
    }
    if (res.ok) setData(await res.json());
  }, []);

  /*
   * 15초마다 다시 묻던 것은 「지금 누가 접속해 있나」 때문이었다. 그 목록을 내려 둔 지금은
   * 물어봐야 답이 그대로라, 화면을 열어 둔 사람 수만큼 요청만 늘어난다.
   * 친구 요청은 다음에 화면을 열 때 반영된다 (탭바 배지가 먼저 알려 준다).
   */
  useEffect(() => {
    if (FRIEND_PRESENCE === 'off') return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // 서버가 다시 그려 새 prop이 오면 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다)
  useEffect(() => {
    setData(initial.data);
    setNeedLogin(initial.needLogin);
  }, [initial]);

  async function act(id: string, method: 'POST' | 'DELETE', path: string) {
    setBusy(id);
    setError(null);
    const res = await fetch(path, { method });
    if (!res.ok) setError(t(T.failed));
    // 화면은 곧바로 맞추고, 서버가 들고 있는 것도 같이 새로 그린다
    await load();
    refresh();
    setBusy(null);
  }

  const accept = (f: Friend) => act(f.id, 'POST', `/api/friends/${f.id}/accept`);

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
      {FRIEND_PRESENCE === 'list' && f.online && <span className="online-dot" aria-hidden="true" />}
      {face(f)}
      <span className="online-name">{f.name}</span>
      <span className="friend-actions">{actions}</span>
    </li>
  );

  /** 맺어진 친구는 이름을 눌러 그 사람의 화면으로 간다 */
  const linkRow = (f: Friend, actions: React.ReactNode) => (
    <li key={f.id} className="friend-row">
      {FRIEND_PRESENCE === 'list' && f.online && <span className="online-dot" aria-hidden="true" />}
      <Link href={`/friends/${f.id}`} className="friend-link">
        {face(f)}
        <span className="online-name">{f.name}</span>
      </Link>
      <span className="friend-actions">{actions}</span>
    </li>
  );

  const online = data.friends.filter((f) => f.online);

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

      {error && <div className="msg err">{error}</div>}

      {/*
        * 숫자만 — 누가 있는지는 안 보여준다. 「누군가 있다」는 것만 알면 말을 걸어볼
        * 이유로는 충분하고, 그 이상은 서로를 지켜보는 화면이 된다.
        */}
      {FRIEND_PRESENCE === 'count' && (
        <p className="online-count">
          {data.onlineCount > 0 ? (
            <>
              <span className="online-dot" aria-hidden="true" />
              {t(T.onlineCount, { n: data.onlineCount })}
            </>
          ) : (
            t(T.onlineCountNone)
          )}
        </p>
      )}

      {/* 이름까지 보여주던 모양 — 지금은 내려 두었다 (lib/flags.ts) */}
      {FRIEND_PRESENCE === 'list' && (
        <>
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
        </>
      )}

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
              linkRow(
                f,
                <button className="link-btn danger-text" disabled={busy === f.id} onClick={() => unfriend(f)}>
                  {t(T.unfriend)}
                </button>
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
