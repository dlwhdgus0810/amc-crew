import { CategoryCardsSkeleton } from '@/app/skeleton';

/** 둘러보기 — 열세 장이 다 나오지만 화면에 처음 보이는 만큼만 그린다 */
export default function Loading() {
  return <CategoryCardsSkeleton n={4} label="불러오는 중" />;
}
