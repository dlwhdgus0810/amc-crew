import { Suspense } from 'react';
import { getViewer } from '@/lib/session';
import { friendMeetups } from '@/lib/db/friend-meetups';
import { listFriendships } from '@/lib/db/friends';
import { getRegion } from '@/lib/region-server';
import FriendClient, { type FriendInitial } from './friend-client';

export const dynamic = 'force-dynamic';

/**
 * 친구 한 명의 모임 목록 + 그 친구에 대한 내 설정을 서버에서 읽는다.
 *
 * 친구가 아니면 「없는 사람」과 같게 다룬다 — 「친구만 볼 수 있어요」라고 답하면
 * 그 사람이 회원인지 아닌지가 드러난다. (/api/friends/[id]/meetups와 같은 규칙)
 */
async function FriendData({ id }: { id: string }) {
  const [{ user }, region] = await Promise.all([getViewer(), getRegion()]);
  const empty: FriendInitial = { data: null, missing: true };
  if (!user) return <FriendClient id={id} initial={empty} />;

  const [meetups, all] = await Promise.all([friendMeetups(region, user.id, id), listFriendships(user.id)]);
  const friend = all.find((f) => f.id === id && f.status === 'friends');
  if (!meetups || !friend) return <FriendClient id={id} initial={empty} />;

  return <FriendClient id={id} initial={{ data: { friend, ...meetups }, missing: false }} />;
}

export default async function FriendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <FriendData id={id} />
    </Suspense>
  );
}
