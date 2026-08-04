import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { getCategory } from '@/lib/categories';
import { getViewer } from '@/lib/session';

import { getDb } from '@/lib/db/index';
import { users } from '@/lib/db/schema';
import { dbGetUser } from '@/lib/db/users';
import { getSubscriptions, listPosts } from '@/lib/db/posts';
import { friendsOf, incomingOf, listFriendships, outgoingOf } from '@/lib/db/friends';
import { resolveDisplayName } from '@/lib/store';
import CategoryClient from './category-client';
import { PostCardsSkeleton } from '@/app/skeleton';

export const dynamic = 'force-dynamic';

/** 회원 전체 (관리자 전용) — /api/admin/members와 같은 모양 */
async function adminMembers() {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, kakaoName: users.kakaoName, avatar: users.avatar })
    .from(users)
    .orderBy(asc(users.kakaoName));
  return rows.map((r) => ({
    id: r.id,
    name: resolveDisplayName({ kakaoName: r.kakaoName, kakaoNameHistory: [] }, r.kakaoName),
    avatar: r.avatar,
  }));
}

/**
 * 이 화면이 쓰는 것을 서버에서 한 번에 읽는다.
 *
 * 예전에는 브라우저가 마운트한 뒤 다섯 가지를 따로 받아 왔다 —
 * 예정 목록, 지난 목록, 구독 여부, 친구, (관리자면) 회원 명단.
 *
 * 지난 목록도 함께 읽는다. 탭 라벨에 개수를 바로 띄우려면 어차피 필요하고,
 * 서버에서는 예정 목록과 나란히 나가므로 기다림이 늘지 않는다.
 */
async function CategoryData({ slug }: { slug: string }) {
  const { user, isAdmin } = await getViewer();
  // 지난 비공개 모임을 볼지는 사람마다 다르다 (프로필 설정, 기본은 안 보임)
  const showPastPrivate = user ? ((await dbGetUser(user.id))?.showPastPrivate ?? false) : false;

  // 로그인 안 한 사람에게 줄 빈 값들 — 삼항 안에서 []를 그냥 쓰면 타입이 never[]로 좁아진다
  const noSubs: string[] = [];
  const noFriends: Awaited<ReturnType<typeof listFriendships>> = [];
  const noMembers: Awaited<ReturnType<typeof adminMembers>> = [];

  const [posts, pastPosts, subs, friendships, members] = await Promise.all([
    listPosts(slug, false, user?.id, showPastPrivate),
    listPosts(slug, true, user?.id, showPastPrivate),
    user ? getSubscriptions(user.id) : noSubs,
    user ? listFriendships(user.id) : noFriends,
    // 관리자만 — 명단을 고칠 때 친구가 아닌 사람도 골라야 한다
    isAdmin ? adminMembers() : noMembers,
  ]);

  return (
    <CategoryClient
      slug={slug}
      initial={{
        posts,
        pastPosts,
        subscribed: subs.includes(slug),
        friends: friendsOf(friendships),
        incoming: incomingOf(friendships),
        outgoing: outgoingOf(friendships),
        members,
      }}
    />
  );
}

export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const cat = getCategory(category);
  if (!cat || cat.kind !== 'posts') notFound();
  // 이름·라벨은 클라이언트가 현재 언어로 직접 고른다
  return (
    <Suspense fallback={<PostCardsSkeleton n={3} label="불러오는 중" />}>
      <CategoryData slug={cat.slug} />
    </Suspense>
  );
}
