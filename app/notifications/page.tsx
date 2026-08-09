import { Suspense } from 'react';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { getViewer } from '@/lib/session';
import { listNotifications } from '@/lib/db/posts';
import { pendingIncomingCount } from '@/lib/db/friends';
import NotificationsClient from './notifications-client';
import { Bar, Block, LOADING_NOTIFICATIONS, Skeleton } from '../skeleton';

export const dynamic = 'force-dynamic';

/**
 * 알림함을 서버에서 읽어 첫 프레임에 담는다.
 *
 * 안 읽은 수는 getViewer가 이미 세어 둔 것을 그대로 쓴다 — 레이아웃(탭바 배지)이
 * 같은 요청 안에서 먼저 불렀고 React.cache로 묶여 있어 질의가 늘지 않는다.
 * 목록은 50개까지만 내려오므로 「안 읽은 게 있는지」를 목록으로 판단하면 안 된다.
 */
async function NotificationsData() {
  const { user, unread } = await getViewer();
  if (!user) return <NotificationsClient initial={null} />;

  const [items, pendingFriends] = await Promise.all([
    listNotifications(user.id),
    pendingIncomingCount(user.id),
  ]);
  return <NotificationsClient initial={{ items, pendingFriends, unread }} />;
}

export default async function NotificationsPage() {
  return (
    <Suspense fallback={<NotificationsSkeleton label={pick(await getLocale(), LOADING_NOTIFICATIONS)} />}>
      <NotificationsData />
    </Suspense>
  );
}

/** 제목 · 친구 줄 · 알림 몇 줄 — 실제로 그려질 자리와 같은 크기로 깔아 둔다 */
function NotificationsSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <Bar w={96} h={24} />
      <Bar w={220} h={13} mt={10} />
      <Block h={62}>
        <Bar w={110} h={15} />
        <Bar w={168} h={12} mt={6} />
      </Block>
      {[0, 1, 2, 3].map((i) => (
        <Block key={i} h={58}>
          <Bar w="72%" h={14} />
          <Bar w={52} h={11} mt={8} />
        </Block>
      ))}
    </Skeleton>
  );
}
