import { notFound } from 'next/navigation';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { walletOf } from '@/lib/db/shop';
import ShopClient from './shop-client';

export const dynamic = 'force-dynamic';

/**
 * 테마 상점.
 *
 * **아직 관리자만 들어온다.** 관리자 화면에 링크가 하나 있는 것이 유일한 입구지만,
 * 주소를 치면 누구나 열 수 있으므로 여기서 막는다. 못 들어가는 사람에게는 404를 준다 —
 * 403은 「여기 뭔가 있다」를 알려 주는 답이고, 아직 알릴 단계가 아니다.
 *
 * 모두에게 열 때는 이 가드와 app/api/shop/buy의 같은 줄을 같이 지운다.
 */
export default async function ShopPage() {
  const user = await getSessionUser();
  if (!user || !isAdmin(user)) notFound();
  return <ShopClient wallet={await walletOf(user.id)} />;
}
