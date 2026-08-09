import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { LOADING, PostCardsSkeleton } from '@/app/skeleton';

/** 카테고리 화면 — 날짜 헤더 하나와 모임 카드 몇 장 자리를 잡아 둔다 */
export default async function Loading() {
  return <PostCardsSkeleton n={3} label={pick(await getLocale(), LOADING)} />;
}
