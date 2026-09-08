import { Suspense } from 'react';
import { myPhotoWall } from '@/lib/db/photos';
import { getViewer } from '@/lib/session';
import { getRegion } from '@/lib/region-server';
import PhotosClient from './photos-client';

export const dynamic = 'force-dynamic';

/**
 * 사진 모아보기 — 내가 다녀온 모임들의 사진.
 *
 * 서명된 주소는 6시간이면 만료된다. 그래서 캐시에 담지 않고 열 때마다 새로 만든다
 * (lib/blob.ts).
 */
async function PhotosData() {
  const [{ user }, region] = await Promise.all([getViewer(), getRegion()]);
  if (!user) return <PhotosClient initial={null} />;
  return <PhotosClient initial={{ groups: await myPhotoWall(user.id, region) }} />;
}

export default function PhotosPage() {
  return (
    <Suspense fallback={null}>
      <PhotosData />
    </Suspense>
  );
}
