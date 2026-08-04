import { Suspense } from 'react';
import { getViewer } from '@/lib/session';
import { getFavorites, getSubscriptions } from '@/lib/db/posts';
import { nextMeetupByCategory } from '@/lib/db/next-meetups';
import { POST_CATEGORY_SLUGS } from '@/lib/categories';
import { todayLocal } from '@/lib/dates';
import CategoriesClient from './categories-client';
import { CategoryCardsSkeleton } from '../skeleton';

export const dynamic = 'force-dynamic';

/**
 * 홈과 같은 것을 읽는다 — 구독·즐겨찾기·카테고리별 다음 모임.
 *
 * 셋은 서로를 안 기다리므로 묶는다. 여기까지 오면 /api/next-meetups를 부르는 화면이
 * 하나도 남지 않는다 (홈도 이미 서버에서 읽는다).
 */
async function CategoriesData() {
  const { user } = await getViewer();
  const [subs, favs, summaries] = await Promise.all([
    user ? getSubscriptions(user.id) : [],
    user ? getFavorites(user.id) : [],
    nextMeetupByCategory(POST_CATEGORY_SLUGS),
  ]);
  return <CategoriesClient initial={{ subs, favs, summaries: { today: todayLocal(), summaries } }} />;
}

export default function CategoriesPage() {
  return (
    <Suspense fallback={<CategoryCardsSkeleton n={4} label="불러오는 중" />}>
      <CategoriesData />
    </Suspense>
  );
}
