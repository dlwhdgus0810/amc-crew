'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useT } from '../i18n';
import { pick } from '@/lib/i18n';
import { FRIEND_KINDS, NOTIF, POST_KINDS } from '@/lib/notif-kinds';
import { timeAgo } from '@/lib/datefmt';
import { useNow } from '../use-now';
import { CHANGELOG } from '@/lib/changelog';
import NotifSwipe from '../notif-swipe';

/** 서버가 페이지를 그리면서 미리 읽어 둔 것 (page.tsx). 로그인 전이면 null */
export interface NotificationsInitial {
  items: Notification[];
  pendingFriends: number;
  /** 지운 것을 뺀 안 읽은 수 전체 — 목록은 50개까지라 목록만 보고는 알 수 없다 */
  unread: number;
}

const T = {
  friends: { ko: '친구', en: 'Friends', es: 'Amigos' },
  friendsHint: { ko: '접속 중인 친구와 받은 요청', en: 'Who’s online, and your requests', es: 'Quién está en línea y tus solicitudes' },
  loading: { ko: '불러오는 중…', en: 'Loading…', es: 'Cargando…' },
  title: { ko: '알림', en: 'Alerts', es: 'Avisos' },
  loginPrompt: { ko: '카카오 로그인 후 알림을 볼 수 있어요.', en: 'Log in with Kakao to see your alerts.', es: 'Entra con Kakao para ver tus avisos.' },
  empty: {
    ko: '아직 알림이 없어요. 홈에서 관심 있는 취미를 구독해보세요!',
    en: 'No alerts yet. Subscribe to a hobby on the home page!',
    es: 'Aún no hay avisos. ¡Suscríbete a una afición desde el inicio!',
  },
  del: { ko: '지우기', en: 'Delete', es: 'Borrar' },
  delFailed: { ko: '지우지 못했어요.', en: 'Couldn’t delete that.', es: 'No se pudo borrar.' },
  /* 제목 바로 아래에 둔다 — 지우는 방법을 모르면 목록 끝까지 내려갈 이유가 없다 */
  swipeHint: {
    ko: '알림을 왼쪽으로 밀면 지울 수 있어요.',
    en: 'Swipe an alert left to delete it.',
    es: 'Desliza un aviso a la izquierda para borrarlo.',
  },
  trash: { ko: '지운 알림', en: 'Deleted', es: 'Borrados' },
  trashEmpty: { ko: '지운 알림이 없어요.', en: 'Nothing deleted yet.', es: 'Nada borrado todavía.' },
  restore: { ko: '되돌리기', en: 'Restore', es: 'Restaurar' },
  restoreFailed: { ko: '되돌리지 못했어요.', en: 'Couldn’t restore that.', es: 'No se pudo restaurar.' },
  deletedAt: { ko: '{when} 지움', en: 'deleted {when}', es: 'borrado {when}' },
};

interface Notification {
  id: string;
  postId: string | null;
  /** 어디로 보낼지 — 값은 lib/notif-kinds.ts에 모아 둔다 */
  kind: string | null;
  message: string;
  read: boolean;
  createdAt: string;
  category: string | null;
}

export default function NotificationsClient({ initial }: { initial: NotificationsInitial | null }) {
  const [items, setItems] = useState<Notification[]>(initial?.items ?? []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** 지운 알림 — 열어봤을 때만 불러온다 */
  const [trash, setTrash] = useState<Notification[] | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const now = useNow();

  // 서버가 다시 그려 새 prop이 오면 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다)
  useEffect(() => {
    if (initial) setItems(initial.items);
  }, [initial]);

  /*
   * 목록을 봤으면 전부 읽음 처리. 화면의 표시는 그대로 둔다 —
   * 방금 뭐가 새로 왔는지는 보고 나가야 알 수 있다. 탭바 벨 배지는 다음 이동 때 다시 센다.
   *
   * 한 번 보낸 뒤로는 다시 보내지 않는다. 지우기·되돌리기로 서버가 이 화면을 다시 그리면
   * initial이 새 객체로 오는데, 그때마다 또 부를 이유가 없다.
   */
  const marked = useRef(false);
  useEffect(() => {
    if (marked.current || !initial || initial.unread === 0) return;
    marked.current = true;
    void fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }, [initial]);

  /** 지우면 화면에서 먼저 없앤다 — 실패하면 문구를 띄우고 되돌린다 */
  async function remove(id: string) {
    const before = items;
    setBusy(id);
    setError(null);
    setItems((list) => list.filter((n) => n.id !== id));
    const res = await fetch(`/api/notifications/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setItems(before);
      setError(t(T.delFailed));
    }
    setBusy(null);
    // 지운 목록을 열어 두고 있었다면 방금 지운 것이 거기 보여야 한다
    if (trashOpen) void loadTrash();
  }

  async function loadTrash() {
    const res = await fetch('/api/notifications/deleted', { cache: 'no-store' });
    if (res.ok) setTrash((await res.json()).notifications ?? []);
  }

  async function restore(id: string) {
    setBusy(id);
    setError(null);
    const res = await fetch('/api/notifications/deleted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) setError(t(T.restoreFailed));
    else {
      setTrash((list) => (list ?? []).filter((n) => n.id !== id));
      // 되돌린 것을 목록의 제자리에 끼워 넣어야 하는데, 지운 목록에는 그 모임의 카테고리가
      // 없어서(링크를 만들 때 쓴다) 여기서 만들 수 없다 — 서버에 다시 그리게 한다
      router.refresh();
    }
    setBusy(null);
  }

  if (!initial) {
    return (
      <>
        <h1>{t(T.title)}</h1>
        <div className="card">{t(T.loginPrompt)}</div>
      </>
    );
  }

  const pendingFriends = initial.pendingFriends;

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.swipeHint)}</p>

      <Link href="/friends" className="card friend-entry">
        <span className="friend-entry-text">
          <span className="friend-entry-title">🤝 {t(T.friends)}</span>
          <span className="friend-entry-hint">{t(T.friendsHint)}</span>
        </span>
        {pendingFriends > 0 && <span className="friend-count">{pendingFriends}</span>}
        <span className="friend-chev" aria-hidden="true">
          ›
        </span>
      </Link>

      {items.length === 0 && (
        <div className="card" style={{ color: 'var(--text-dim)' }}>
          {t(T.empty)}
        </div>
      )}

      {error && <div className="msg err">{error}</div>}

      {items.map((n) => {
        /*
         * 정산 알림은 그 모임의 정산 카드로 바로 보낸다 (#settle).
         * 친구·초대 알림은 그 모임 하나로 — 비공개 모임은 카테고리 피드에 아예 없어서
         * 피드로 보내면 찾을 수 없는 곳에 떨어진다.
         * 나머지는 예전처럼 카테고리 피드 — 목록에서 앞뒤 맥락까지 같이 보는 게 낫다.
         */
        /*
         * 새 소식 알림은 그 소식 자리로 보낸다.
         * 어느 소식인지는 문구에 든 제목으로 찾는다 — 알림에 소식 위치를 따로 저장하지 않았고,
         * 제목이 곧 사람이 보고 누른 그 줄이라 이쪽이 더 정확하다.
         * 예전에 나간 알림은 kind가 비어 있어 📣로도 알아본다.
         */
        const isNews = n.kind === NOTIF.news || (!n.kind && n.message.startsWith('📣'));
        const newsEntry = isNews ? CHANGELOG.find((e) => n.message.includes(pick(locale, e.title))) : null;
        const href = isNews
          ? newsEntry
            ? `/whats-new#${encodeURIComponent(newsEntry.at)}`
            : '/whats-new'
          : n.kind === NOTIF.settle && n.postId
            ? `/p/${n.postId}#settle`
            : n.postId && POST_KINDS.includes(n.kind ?? '')
              ? `/p/${n.postId}`
              : FRIEND_KINDS.includes(n.kind ?? '')
                ? '/friends'
                : n.category
                  ? `/c/${n.category}`
                  : null;
        const inner = (
          <div className={`notif-item ${n.read ? '' : 'unread'}`}>
            <span className="notif-message">{n.message}</span>
            {/* 서버와 브라우저의 시각이 다를 수 있다 — app/use-now.ts 참고 */}
            <span className="notif-time" suppressHydrationWarning>
              {timeAgo(n.createdAt, locale, now)}
            </span>
          </div>
        );
        return (
          <NotifSwipe key={n.id} label={t(T.del)} disabled={busy === n.id} onDelete={() => remove(n.id)}>
            {href ? (
              <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                {inner}
              </Link>
            ) : (
              inner
            )}
          </NotifSwipe>
        );
      })}

      {/* 지운 알림 — 잘못 지웠을 때 찾아볼 자리 */}
      <button
        className="link-btn"
        style={{ marginTop: 18 }}
        onClick={() => {
          const next = !trashOpen;
          setTrashOpen(next);
          if (next && trash === null) void loadTrash();
        }}
      >
        {t(T.trash)} {trashOpen ? '▴' : '▾'}
      </button>

      {trashOpen &&
        (trash === null ? (
          <p className="hint">{t(T.loading)}</p>
        ) : trash.length === 0 ? (
          <p className="hint">{t(T.trashEmpty)}</p>
        ) : (
          trash.map((n) => (
            <div key={n.id} className="notif-item notif-gone">
              <span className="notif-message">{n.message}</span>
              <span className="friend-actions">
                <button className="link-btn" disabled={busy === n.id} onClick={() => restore(n.id)}>
                  {t(T.restore)}
                </button>
              </span>
            </div>
          ))
        ))}
    </>
  );
}
