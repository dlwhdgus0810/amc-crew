import { Suspense } from 'react';
import { recentReviews } from '@/lib/db/reviews';
import { getLocale } from '@/lib/locale';
import { getViewer } from '@/lib/session';
import { REVIEW_FEED_LIMIT } from '@/lib/reviews';
import { getRegion } from '@/lib/region-server';
import ReviewsClient from './reviews-client';

export const dynamic = 'force-dynamic';

/**
 * 후기 모아보기 — 공개 모임의 최근 후기.
 *
 * 이름은 보는 사람의 언어로 정해지고 익명 가리기도 보는 사람에 따라 달라져서,
 * 캐시에 담지 않는다 (lib/db/hosting.ts의 순위표 주석 참고).
 */
async function ReviewsData() {
  const [{ user }, region] = await Promise.all([getViewer(), getRegion()]);
  if (!user) return <ReviewsClient initial={null} />;
  const rows = await recentReviews(region, REVIEW_FEED_LIMIT, user.id, await getLocale());
  return <ReviewsClient initial={{ rows }} />;
}

export default function ReviewsPage() {
  return (
    <Suspense fallback={null}>
      <ReviewsData />
    </Suspense>
  );
}
