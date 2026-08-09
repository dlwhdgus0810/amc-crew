import { Suspense } from 'react';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { getCategory } from '@/lib/categories';
import { getViewer } from '@/lib/session';

import { getDb } from '@/lib/db/index';
import { users } from '@/lib/db/schema';
import { dbGetUser } from '@/lib/db/users';
import { listSignups } from '@/lib/db/signups';
import { getSubscriptions, listPosts } from '@/lib/db/posts';
import { friendsOf, incomingOf, listFriendships, outgoingOf } from '@/lib/db/friends';
import { nameOf } from '@/lib/store';
import CategoryClient from './category-client';
import { LOADING, PostCardsSkeleton } from '@/app/skeleton';

export const dynamic = 'force-dynamic';

/** 회원 전체 (관리자 전용) — /api/admin/members와 같은 모양 */
async function adminMembers() {
  const locale = await getLocale();
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, kakaoName: users.kakaoName, nameEn: users.nameEn, avatar: users.avatar })
    .from(users)
    .orderBy(asc(users.kakaoName));
  return rows.map((r) => ({
    id: r.id,
    name: nameOf(r, r.kakaoName, locale, true),
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

  // 참가신청을 쓰는 카테고리(독서나눔)만 명단을 읽는다 — 나머지는 빈 배열이라 질의도 없다
  const noSignups: Awaited<ReturnType<typeof listSignups>> = [];
  const [posts, pastPosts, subs, friendships, members, signups] = await Promise.all([
    listPosts(slug, false, user?.id, showPastPrivate),
    listPosts(slug, true, user?.id, showPastPrivate),
    user ? getSubscriptions(user.id) : noSubs,
    user ? listFriendships(user.id) : noFriends,
    // 관리자만 — 명단을 고칠 때 친구가 아닌 사람도 골라야 한다
    isAdmin ? adminMembers() : noMembers,
    getCategory(slug)?.signup ? listSignups(slug) : noSignups,
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
        signups,
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
    <Suspense fallback={<PostCardsSkeleton n={3} label={pick(await getLocale(), LOADING)} />}>
      <CategoryData slug={cat.slug} />
    </Suspense>
  );
}
