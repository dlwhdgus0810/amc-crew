import { Suspense } from 'react';
import { getViewer } from '@/lib/session';
import { getSubscriptions } from '@/lib/db/posts';
import { getNewsAlerts } from '@/lib/db/news';
import { dbGetUser } from '@/lib/db/users';
import ProfileClient from './profile-client';

export const dynamic = 'force-dynamic';

/**
 * 프로필이 쓰는 것을 서버에서 읽는다.
 *
 * 사진·닉네임·계좌 같은 폼 값은 이미 레이아웃의 세션에서 채운다. 여기서 읽는 건
 * 그 밖의 셋 — 구독 목록, 새 소식 알림, 지난 비공개 모임 설정.
 */
async function ProfileData() {
  const { user } = await getViewer();
  if (!user) return <ProfileClient initial={{ subs: [], newsAlerts: false, showPastPrivate: false, showPresence: true }} />;
  const [subs, newsAlerts, row] = await Promise.all([
    getSubscriptions(user.id),
    getNewsAlerts(user.id),
    dbGetUser(user.id),
  ]);
  return (
    <ProfileClient initial={{ subs, newsAlerts, showPastPrivate: row?.showPastPrivate ?? false, showPresence: row?.showPresence ?? true }} />
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileData />
    </Suspense>
  );
}
