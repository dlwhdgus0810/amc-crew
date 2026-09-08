import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { asc } from 'drizzle-orm';
import { getPostView } from '@/lib/db/posts';
import { listRatings } from '@/lib/db/ratings';
import { listPhotos } from '@/lib/db/photos';
import { listReviews } from '@/lib/db/reviews';
import { getViewer } from '@/lib/session';
import { getDb } from '@/lib/db/index';
import { users } from '@/lib/db/schema';
import { friendsOf, listFriendships } from '@/lib/db/friends';
import { nameOf } from '@/lib/store';
import { appName, configuredSiteUrl, siteUrl } from '@/lib/site';
import { getRegion } from '@/lib/region-server';
import { catName, getCategory, isAnonymous } from '@/lib/categories';
import SkyBackdrop from '@/app/sky-backdrop';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { whenLabelShort } from '@/lib/datefmt';
import PostClient from './post-client';

export const dynamic = 'force-dynamic';

const T = {
  notFound: { ko: '모임을 찾을 수 없어요 — {name}', en: 'Meetup not found — {name}', es: 'Quedada no encontrada — {name}' },
  title: { ko: '{cat} 모임{title} · {when}', en: '{cat} meetup{title} · {when}', es: 'quedada de {cat}{title} · {when}' },
  director: { ko: '감독 {name}', en: 'Dir. {name}', es: 'Dir. {name}' },
  joined: { ko: '{n}명 참여 중', en: '{n} joined', es: '{n} apuntados' },
  capacity: { ko: ' (정원 {n}명)', en: ' (capacity {n})', es: ' (aforo {n})' },
  cta: { ko: ' — 링크를 눌러 바로 참가하세요', en: ' — tap the link to join', es: ' — toca el enlace para apuntarte' },
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
  const [post, locale, region] = await Promise.all([getPostView(id, user?.id), getLocale(), getRegion()]);
  if (!post) return { title: pick(locale, T.notFound, { name: appName(region) }) };

  const title = pick(locale, T.title, {
    cat: catName(post.category, locale),
    title: post.title ? ` 〈${post.title}〉` : '',
    when: whenLabelShort(post.date, post.startTime, locale, post.endDate),
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
    // 모임의 지역 이름으로 — 다른 지역 링크를 이 도메인에서 열어도 그 모임의 앱 이름이다
    title: `${title} — ${appName(post.region)}`,
    description,
    openGraph: { title, description },
  };
}

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

  const noPeople: Awaited<ReturnType<typeof adminMembers>> = [];
  const [post, members, friendships, region, h] = await Promise.all([
    getPostView(id, user?.id),
    // 관리자만 — 명단을 고칠 때 친구가 아닌 사람도 골라야 한다
    isAdmin ? adminMembers() : noPeople,
    // 호스트는 친구 중에서만 넣는다
    user ? listFriendships(user.id) : ([] as Awaited<ReturnType<typeof listFriendships>>),
    getRegion(),
    headers(),
  ]);

  /*
   * 다른 지역의 모임 링크를 이 도메인에서 열었으면 그 지역 도메인으로 보낸다.
   *
   * 공유 링크는 지역을 가리지 않고 살아야 한다 — 캔자스 친구가 보낸 링크를 필리 앱에서
   * 눌러도 열려야 하고, 그 지역 앱(설치된 PWA)에서 열리는 편이 낫다. 보안 검사는 그대로다:
   * 옮겨간 자리에서 똑같은 getPostView(id, viewerId)를 지난다.
   *
   * 그 지역의 공개 주소를 **정해 뒀을 때만** 보낸다. 없으면(로컬) 자기 자신으로 무한히
   * 되돌아가므로 그 자리에서 그린다.
   */
  if (post && post.region !== region && configuredSiteUrl(post.region)) {
    redirect(`${configuredSiteUrl(post.region)}/p/${id}`);
  }

  /*
   * 캘린더 링크에 들어갈 주소는 서버가 정한다 — 그 모임의 지역 주소로.
   *
   * 예전에는 클라이언트에서 `typeof window !== 'undefined' ? location.origin : ''`로
   * 만들었는데, 서버 렌더가 붙은 지금은 서버('')와 브라우저(localhost)가 서로 다른 href를
   * 그려 하이드레이션이 어긋난다. 한쪽에서 정해 내려보내면 그럴 일이 없다.
   */
  const requestOrigin = h.get('host') ? `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}` : '';
  const origin = siteUrl(post?.region ?? region, requestOrigin);

  /*
   * 누가 몇 점 줬는지 — 평점을 매길 수 있는 모임일 때만 읽는다.
   * 요약(post.rating)은 목록도 쓰지만 사람별 점수는 이 화면에서만 쓴다.
   */
  const ratings = post?.rating ? await listRatings(id) : [];
  /*
   * 사진은 그 모임에 참가한 사람과 관리자에게만 내려간다 (호스트가 열어 둔 모임이면 회원 누구나).
   * post.photos(요약)가 딱 그 기준으로 채워지므로, 그게 있는지로 판단하면 기준이 하나로 유지된다 —
   * 여기서 따로 판정하면 언젠가 둘이 어긋난다.
   *
   * 익명 카테고리에서는 「누가 올렸는지」를 응답에서 지운다 — 사진을 열어 두면 안 온
   * 사람도 이 목록을 받으므로, 회원번호가 실려 나가면 가려 둔 것이 그대로 읽힌다.
   */
  /*
   * 받기는 갔던 사람과 관리자만. 사진이 보이는 것(post.photos)보다 좁다 — 호스트가
   * photosPublic으로 연 것은 보여 주기까지고, 파일을 가져가는 것까지는 아니다.
   */
  const canDownload = Boolean(
    post?.photos && user && (isAdmin || post.participants.some((p) => p.id === user.id))
  );
  const photos = post?.photos
    ? await listPhotos(id, { anonymous: isAnonymous(post.category), viewerId: user?.id, canDownload })
    : [];
  /*
   * 후기는 회원 누구나 읽는다 — 사진과 달리 참가자로 좁히지 않는다.
   * 「저기 재미있었대」를 보고 다음에 가보는 것이 이 글의 쓸모라서다.
   * 끝난 모임에만 붙으므로 그 전에는 읽지도 않는다.
   */
  const reviews = post?.isPast ? await listReviews(id, user?.id, await getLocale()) : [];

  const body = (
    <PostClient
      id={id}
      initial={{ post, members, friends: friendsOf(friendships), origin, ratings, photos, reviews }}
    />
  );
  // 모임을 눌러 들어와도 하늘은 이어진다 — 카테고리에서만 밤이면 한 걸음 만에 크림색으로 돌아온다
  if (!post || !getCategory(post.category)?.meteors) return body;
  return (
    <div className="sky-scope night">
      <SkyBackdrop />
      {body}
    </div>
  );
}
