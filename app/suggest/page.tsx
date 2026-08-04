import { Suspense } from 'react';
import { getViewer } from '@/lib/session';
import { listCategoryRequests } from '@/lib/db/category-requests';
import SuggestClient from './suggest-client';

export const dynamic = 'force-dynamic';

/** 내가 낸 카테고리 제안을 서버에서 읽는다 (건의함과 같은 모양) */
async function SuggestData() {
  const { user } = await getViewer();
  const requests = user ? await listCategoryRequests(user.id) : [];
  return <SuggestClient initial={{ requests }} />;
}

export default function SuggestPage() {
  return (
    <Suspense fallback={null}>
      <SuggestData />
    </Suspense>
  );
}
