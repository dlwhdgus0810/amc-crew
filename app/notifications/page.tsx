'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Notification {
  id: string;
  postId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
  category: string | null;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

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

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  if (needLogin) {
    return (
      <>
        <h1>알림</h1>
        <div className="card">카카오 로그인 후 알림을 볼 수 있어요.</div>
      </>
    );
  }

  return (
    <>
      <h1>알림</h1>
      <p className="subtitle">구독한 취미에 새 모임이 올라오면 여기에 표시돼요.</p>

      {items.length === 0 && (
        <div className="card" style={{ color: 'var(--text-dim)' }}>
          아직 알림이 없어요. 홈에서 관심 있는 취미를 구독해보세요!
        </div>
      )}

      {items.map((n) => {
        const inner = (
          <div className={`notif-item ${n.read ? '' : 'unread'}`}>
            <span className="notif-message">{n.message}</span>
            <span className="notif-time">{timeAgo(n.createdAt)}</span>
          </div>
        );
        return n.category ? (
          <Link key={n.id} href={`/c/${n.category}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            {inner}
          </Link>
        ) : (
          <div key={n.id}>{inner}</div>
        );
      })}
    </>
  );
}
