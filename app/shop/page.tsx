import { notFound } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { walletOf } from '@/lib/db/shop';
import ShopClient from './shop-client';

export const dynamic = 'force-dynamic';

/**
 * 테마 상점 — 프로필 맨 위, 알림 왼쪽 버튼으로 들어온다.
 *
 * 로그인한 사람만 본다. 코인이 자기 활동에서 나오는 값이라 볼 사람이 정해져 있고,
 * 로그아웃 상태에서는 보여 줄 잔액 자체가 없다.
 */
export default async function ShopPage() {
  const user = await getSessionUser();
  if (!user) notFound();
  return <ShopClient wallet={await walletOf(user.id)} />;
}
