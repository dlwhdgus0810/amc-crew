import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { LOADING, CategoryCardsSkeleton } from './skeleton';

/**
 * 홈이 서버에서 그려지는 동안 보이는 화면.
 *
 * 이 파일이 있어야 <Link>가 이 라우트를 미리 받아 둔다 — 탭바를 누르는 순간
 * 이미 받아 둔 걸 그리므로 화면이 바로 뜬다. 뼈대를 그리는 것보다 그쪽이 더 크다.
 */
export default async function Loading() {
  return <CategoryCardsSkeleton n={3} label={pick(await getLocale(), LOADING)} />;
}
