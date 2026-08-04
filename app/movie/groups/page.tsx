import { Suspense } from 'react';
import { scheduleDay } from '@/lib/schedule-day';
import GroupsClient from './groups-client';

export const dynamic = 'force-dynamic';

/**
 * 회차 그룹 화면이 쓰는 것 — 전체 선택 현황과, 이미 모임이 된 회차.
 *
 * 상영표(movies)는 안 쓴다. 고른 회차의 정보가 선택 안에 스냅샷으로 들어 있어서
 * AMC를 다시 부를 이유가 없다. 그래도 같은 함수를 쓰는 이유는 선택 현황을 만드는
 * 규칙(이름 해석)이 한 곳에만 있어야 해서다.
 */
async function GroupsData() {
  const { selections, meetups } = await scheduleDay();
  return <GroupsClient initial={{ selections, meetups }} />;
}

export default function GroupsPage() {
  return (
    <Suspense fallback={null}>
      <GroupsData />
    </Suspense>
  );
}
