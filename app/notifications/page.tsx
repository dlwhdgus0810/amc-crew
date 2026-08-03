'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useT } from '../i18n';
import { Locale, pick } from '@/lib/i18n';
import { FRIEND_KINDS, NOTIF, POST_KINDS } from '@/lib/notif-kinds';
import { CHANGELOG } from '@/lib/changelog';
import NotifSwipe from '../notif-swipe';

const T = {
  friends: { ko: '친구', en: 'Friends' },
  friendsHint: { ko: '접속 중인 친구와 받은 요청', en: 'Who’s online, and your requests' },
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  title: { ko: '알림', en: 'Alerts' },
  loginPrompt: { ko: '카카오 로그인 후 알림을 볼 수 있어요.', en: 'Log in with Kakao to see your alerts.' },
  subtitle: {
    ko: '구독한 취미에 새 모임이 올라오면 여기에 표시돼요.',
    en: 'New meetups in the hobbies you follow show up here.',
  },
  empty: {
    ko: '아직 알림이 없어요. 홈에서 관심 있는 취미를 구독해보세요!',
    en: 'No alerts yet. Subscribe to a hobby on the home page!',
  },
  justNow: { ko: '방금', en: 'just now' },
  minutesAgo: { ko: '{n}분 전', en: '{n}m ago' },
  hoursAgo: { ko: '{n}시간 전', en: '{n}h ago' },
  daysAgo: { ko: '{n}일 전', en: '{n}d ago' },
  del: { ko: '지우기', en: 'Delete' },
  delFailed: { ko: '지우지 못했어요.', en: 'Couldn’t delete that.' },
  swipeHint: {
    ko: '알림을 왼쪽으로 밀면 지울 수 있어요.',
    en: 'Swipe an alert left to delete it.',
  },
  trash: { ko: '지운 알림', en: 'Deleted' },
  trashEmpty: { ko: '지운 알림이 없어요.', en: 'Nothing deleted yet.' },
  restore: { ko: '되돌리기', en: 'Restore' },
  restoreFailed: { ko: '되돌리지 못했어요.', en: 'Couldn’t restore that.' },
  deletedAt: { ko: '{when} 지움', en: 'deleted {when}' },
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

function timeAgo(iso: string, locale: Locale): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return pick(locale, T.justNow);
  if (min < 60) return pick(locale, T.minutesAgo, { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return pick(locale, T.hoursAgo, { n: hours });
  return pick(locale, T.daysAgo, { n: Math.floor(hours / 24) });
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFriends, setPendingFriends] = useState(0);
  /** 지운 알림 — 열어봤을 때만 불러온다 */
  const [trash, setTrash] = useState<Notification[] | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const t = useT();
  const locale = useLocale();

  /** 되돌리기처럼 목록이 바뀌는 일이 있어서 따로 뺐다 (읽음 처리는 처음 볼 때만) */
  async function load(markRead = false) {
    const r = await fetch('/api/notifications', { cache: 'no-store' });
    if (r.status === 401) {
      setNeedLogin(true);
      return;
    }
    const data = await r.json();
    setItems(data.notifications ?? []);
    setPendingFriends(data.pendingFriends ?? 0);
    // 목록을 봤으면 전부 읽음 처리 (벨 배지 갱신은 다음 페이지 이동 시)
    if (markRead && (data.unreadCount ?? 0) > 0) {
      await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
    }
  }

  useEffect(() => {
    load(true).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      await load();
    }
    setBusy(null);
  }

  if (loading) return <p className="subtitle">{t(T.loading)}</p>;

  if (needLogin) {
    return (
      <>
        <h1>{t(T.title)}</h1>
        <div className="card">{t(T.loginPrompt)}</div>
      </>
    );
  }

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

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
            <span className="notif-time">{timeAgo(n.createdAt, locale)}</span>
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

      {items.length > 0 && <p className="hint">{t(T.swipeHint)}</p>}

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
