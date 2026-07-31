'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useT } from '../i18n';
import { Locale, pick } from '@/lib/i18n';

const T = {
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
};

interface Notification {
  id: string;
  postId: string | null;
  /** 'settle'이면 모임 화면의 정산 카드로 바로 보낸다 */
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
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    fetch('/api/notifications')
      .then(async (r) => {
        if (r.status === 401) {
          setNeedLogin(true);
          return;
        }
        const data = await r.json();
        setItems(data.notifications ?? []);
        // 목록을 봤으면 전부 읽음 처리 (벨 배지 갱신은 다음 페이지 이동 시)
        if ((data.unreadCount ?? 0) > 0) {
          await fetch('/api/notifications/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          });
        }
      })
      .finally(() => setLoading(false));
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

      {items.length === 0 && (
        <div className="card" style={{ color: 'var(--text-dim)' }}>
          {t(T.empty)}
        </div>
      )}

      {error && <div className="msg err">{error}</div>}

      {items.map((n) => {
        /*
         * 정산 알림은 그 모임의 정산 카드로 바로 보낸다 (#settle).
         * 나머지는 예전처럼 카테고리 피드 — 목록에서 앞뒤 맥락까지 같이 보는 게 낫다.
         */
        const href =
          n.kind === 'settle' && n.postId
            ? `/p/${n.postId}#settle`
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
          <div key={n.id} className="notif-row">
            {href ? (
              <Link href={href} style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}>
                {inner}
              </Link>
            ) : (
              <div style={{ flex: 1, minWidth: 0 }}>{inner}</div>
            )}
            <button
              className="notif-del"
              aria-label={t(T.del)}
              disabled={busy === n.id}
              onClick={() => remove(n.id)}
            >
              ✕
            </button>
          </div>
        );
      })}
    </>
  );
}
