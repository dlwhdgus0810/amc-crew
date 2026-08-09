import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { LOADING, PostCardsSkeleton } from '@/app/skeleton';

/**
 * AMC 상영표.
 *
 * 여기는 상류(AMC)가 느리거나 실패할 수 있어서 뼈대가 실제로 오래 보인다 —
 * 다른 화면보다 이 파일이 하는 일이 크다.
 */
export default async function Loading() {
  return <PostCardsSkeleton n={4} label={pick(await getLocale(), LOADING)} />;
}
