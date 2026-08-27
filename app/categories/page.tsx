import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { getViewer } from '@/lib/session';
import { getFavorites, getSubscriptions } from '@/lib/db/posts';
import { nextMeetupByCategory } from '@/lib/db/next-meetups';
import { signupCounts } from '@/lib/db/signups';
import { hiddenSlugs } from '@/lib/db/hidden';
import { CAT_LAYOUT_COOKIE, POST_CATEGORY_SLUGS, toCatLayout } from '@/lib/categories';
import { todayLocal } from '@/lib/dates';
import CategoriesClient from './categories-client';
import { CategoryCardsSkeleton, LOADING } from '../skeleton';

export const dynamic = 'force-dynamic';

/**
 * 홈과 같은 것을 읽는다 — 구독·즐겨찾기·카테고리별 다음 모임.
 *
 * 셋은 서로를 안 기다리므로 묶는다. 여기까지 오면 /api/next-meetups를 부르는 화면이
 * 하나도 남지 않는다 (홈도 이미 서버에서 읽는다).
 */
async function CategoriesData() {
  const { user } = await getViewer();
  const [subs, favs, summaries, signups, hidden, jar] = await Promise.all([
    user ? getSubscriptions(user.id) : [],
    user ? getFavorites(user.id) : [],
    nextMeetupByCategory(POST_CATEGORY_SLUGS),
    // 둘러보기에서도 같은 줄을 쓴다 — 모임이 없어도 신청이 모여 있으면 그걸 보여준다
    signupCounts(),
    // 관리자가 내려 둔 카테고리는 목록에서 뺀다 (카테고리 화면은 주소로 그대로 열린다)
    hiddenSlugs(),
    /* 카드 배열 취향 — 토글의 눌린 표시를 첫 렌더부터 맞추려고 여기서도 읽는다.
       카드 배열 자체는 layout.tsx가 html에 붙여 둔 표시로 CSS가 정한다 */
    cookies(),
  ]);
  const layout = toCatLayout(jar.get(CAT_LAYOUT_COOKIE)?.value);
  return (
    <CategoriesClient
      initial={{ subs, favs, summaries: { today: todayLocal(), summaries, signups }, hidden, layout }}
    />
  );
}

export default async function CategoriesPage() {
  return (
    <Suspense fallback={<CategoryCardsSkeleton n={4} label={pick(await getLocale(), LOADING)} />}>
      <CategoriesData />
    </Suspense>
  );
}
