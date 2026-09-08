import { Suspense } from 'react';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { notFound } from 'next/navigation';
import { scheduleDay } from '@/lib/schedule-day';
import { getRegion } from '@/lib/region-server';
import { theatreId } from '@/lib/amc';
import MovieClient from './movie-client';
import { LOADING, PostCardsSkeleton } from '../skeleton';

export const dynamic = 'force-dynamic';

/**
 * 첫 하루치 상영표를 서버에서 읽는다.
 *
 * 여기는 Suspense가 특히 값을 한다 — AMC는 남의 서버라 느리거나 안 될 수 있다.
 * 감싸 두지 않으면 AMC가 흔들릴 때 화면 전체가 그만큼 늦게 나온다.
 * (상영표를 못 받아도 선택 현황은 그대로 보인다 — lib/schedule-day.ts가 그렇게 만든다)
 *
 * 날짜를 바꾸는 건 화면이 맡는다 — 그때는 /api/schedule을 부른다.
 */
async function MovieData() {
  return <MovieClient initial={await scheduleDay(await getRegion())} />;
}

export default async function PickPage() {
  // 극장을 안 정한 지역에는 이 화면이 없다 — 카테고리의 AMC 도구도 같은 조건으로 안 그린다
  if (!theatreId(await getRegion())) notFound();
  return (
    <Suspense fallback={<PostCardsSkeleton n={4} label={pick(await getLocale(), LOADING)} />}>
      <MovieData />
    </Suspense>
  );
}
