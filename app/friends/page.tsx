import { Suspense } from 'react';
import { getViewer } from '@/lib/session';
import { friendsOf, incomingOf, listFriendships, outgoingOf } from '@/lib/db/friends';
import FriendsClient from './friends-client';

export const dynamic = 'force-dynamic';

/**
 * 첫 화면 몫만 서버가 읽는다.
 *
 * 접속 중 목록은 지금 내려 두었다(lib/flags.ts) — 그래서 열어 둔 화면을 따라가지 않는다.
 * 서버가 읽어 주는 건 그 첫 값이다 — 화면이 뜨자마자 목록이 있고, 그 뒤로는 폴링이 맡는다.
 */
async function FriendsData() {
  const { user } = await getViewer();
  if (!user) {
    return <FriendsClient initial={{ data: { friends: [], incoming: [], outgoing: [] }, needLogin: true }} />;
  }
  const all = await listFriendships(user.id);
  return (
    <FriendsClient
      initial={{
        data: { friends: friendsOf(all), incoming: incomingOf(all), outgoing: outgoingOf(all) },
        needLogin: false,
      }}
    />
  );
}

export default function FriendsPage() {
  return (
    <Suspense fallback={null}>
      <FriendsData />
    </Suspense>
  );
}
