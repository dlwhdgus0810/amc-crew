import { PostCardsSkeleton } from '@/app/skeleton';

/** 카테고리 화면 — 날짜 헤더 하나와 모임 카드 몇 장 자리를 잡아 둔다 */
export default function Loading() {
  return <PostCardsSkeleton n={3} label="불러오는 중" />;
}
