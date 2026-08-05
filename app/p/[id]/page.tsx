import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { asc } from 'drizzle-orm';
import { getPostView } from '@/lib/db/posts';
import { listRatings } from '@/lib/db/ratings';
import { listPhotos } from '@/lib/db/photos';
import { getViewer } from '@/lib/session';
import { getDb } from '@/lib/db/index';
import { users } from '@/lib/db/schema';
import { friendsOf, listFriendships } from '@/lib/db/friends';
import { resolveDisplayName } from '@/lib/store';
import { siteUrl } from '@/lib/site';
import { catName } from '@/lib/categories';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { dateLabelShort, timeLabel } from '@/lib/datefmt';
import PostClient from './post-client';

export const dynamic = 'force-dynamic';

const T = {
  notFound: { ko: '모임을 찾을 수 없어요 — Kansas Korean', en: 'Meetup not found — Kansas Korean' },
  title: { ko: '{cat} 모임{title} · {when}', en: '{cat} meetup{title} · {when}' },
  director: { ko: '감독 {name}', en: 'Dir. {name}' },
  joined: { ko: '{n}명 참여 중', en: '{n} joined' },
  capacity: { ko: ' (정원 {n}명)', en: ' (capacity {n})' },
  cta: { ko: ' — 링크를 눌러 바로 참가하세요', en: ' — tap the link to join' },
};

// 카카오톡 등에 공유했을 때 미리보기(OG)용 메타데이터
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  /*
   * 페이지와 **같은 인자로** 부른다. getPostView는 React cache로 감싸여 있어서
   * 인자가 같으면 한 요청 안에서 한 번만 읽는다 — 여기서 읽은 것을 페이지가 그대로 쓴다.
   * 인자가 다르면 캐시가 갈라져 같은 모임을 두 번 읽는다.
   */
  const { user } = await getViewer();
  const [post, locale] = await Promise.all([getPostView(id, user?.id), getLocale()]);
  if (!post) return { title: pick(locale, T.notFound) };

  const title = pick(locale, T.title, {
    cat: catName(post.category, locale),
    title: post.title ? ` 〈${post.title}〉` : '',
    when: `${dateLabelShort(post.date, locale)} ${timeLabel(post.startTime, locale)}`,
  });
  const metaPart = post.titleMeta
    ? [
        post.titleMeta.rating ? `★ ${post.titleMeta.rating.toFixed(1)}` : null,
        post.titleMeta.director ? pick(locale, T.director, { name: post.titleMeta.director }) : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const description = `${metaPart ? `${metaPart} · ` : ''}${post.location} · ${pick(locale, T.joined, {
    // 명단은 로그인한 사람에게만 내려가므로 인원수는 participantCount를 쓴다
    n: post.participantCount,
  })}${post.capacity != null ? pick(locale, T.capacity, { n: post.capacity }) : ''}${pick(locale, T.cta)}`;
  return {
    title: `${title} — Kansas Korean`,
    description,
    openGraph: { title, description },
  };
}

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
 * 모임 하나를 서버에서 읽어 넘긴다.
 *
 * 여기는 원래도 값을 치르고 있었다 — generateMetadata가 카톡 미리보기를 만들려고
 * 같은 모임을 읽는데, 그 결과를 버리고 브라우저가 /api/posts/[id]로 다시 받아 왔다.
 * 이제 그 한 번으로 둘 다 먹인다(React cache).
 *
 * Suspense는 걸지 않는다. Next가 어차피 generateMetadata를 기다렸다 응답을 시작하므로
 * 감싸 봐야 더 일찍 나가는 게 없다.
 */
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, isAdmin } = await getViewer();

  /*
   * 캘린더 링크에 들어갈 주소는 서버가 정한다.
   *
   * 예전에는 클라이언트에서 `typeof window !== 'undefined' ? location.origin : ''`로
   * 만들었는데, 서버 렌더가 붙은 지금은 서버('')와 브라우저(localhost)가 서로 다른 href를
   * 그려 하이드레이션이 어긋난다. 한쪽에서 정해 내려보내면 그럴 일이 없다.
   */
  const h = await headers();
  const origin = siteUrl(h.get('host') ? `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}` : '');

  const noPeople: Awaited<ReturnType<typeof adminMembers>> = [];
  const [post, members, friendships] = await Promise.all([
    getPostView(id, user?.id),
    // 관리자만 — 명단을 고칠 때 친구가 아닌 사람도 골라야 한다
    isAdmin ? adminMembers() : noPeople,
    // 호스트는 친구 중에서만 넣는다
    user ? listFriendships(user.id) : ([] as Awaited<ReturnType<typeof listFriendships>>),
  ]);

  /*
   * 누가 몇 점 줬는지 — 평점을 매길 수 있는 모임일 때만 읽는다.
   * 요약(post.rating)은 목록도 쓰지만 사람별 점수는 이 화면에서만 쓴다.
   */
  const ratings = post?.rating ? await listRatings(id) : [];
  // 사진은 회원에게만 내려간다 (모임이 끝났는지와 무관하다)
  const photos = user ? await listPhotos(id) : [];

  return (
    <PostClient
      id={id}
      initial={{ post, members, friends: friendsOf(friendships), origin, ratings, photos }}
    />
  );
}
