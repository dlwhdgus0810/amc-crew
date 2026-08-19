import { HomeView } from '../home-view';
import { PREVIEW_CARDS } from '@/lib/card-theme';

export const dynamic = 'force-dynamic';

/**
 * 테마 미리보기 — **홈 화면 그대로**를 보여 준다.
 *
 * 흉내 낸 그림이 아니라 진짜 홈이다. 시즌 테마에서 볼 만한 것이 색만이 아니라 카드
 * 모양·서체·꽃잎·빗물이라, 축소판을 따로 그리면 그중 절반은 못 보여 준다. 그리고
 * 축소판은 홈이 바뀔 때마다 같이 고쳐야 하는데 대개 잊는다.
 *
 * 어느 테마로 보일지는 레이아웃이 PREVIEW_COOKIE로 정한다 (lib/card-theme.ts).
 * 그 쿠키는 경로가 /preview여서 이 주소에서만 딸려 온다 — 상점에서 미리보기를 열어도
 * 나머지 화면은 원래 테마 그대로다.
 *
 * 카드는 늘 같은 셋만 세운다 (PREVIEW_CARDS). 진짜 홈은 그 사람의 즐겨찾기나 다가오는
 * 모임에 따라 카드가 매번 다른데, 테마를 견주러 온 자리에서 그러면 사람마다 다른 것을
 * 보게 된다 — 즐겨찾기가 하나뿐인 사람은 카드 한 장으로 테마를 판단하게 된다.
 *
 * 상점이 이 주소를 iframe으로 띄운다 (app/shop/shop-client.tsx).
 */
export default function PreviewPage() {
  return <HomeView only={PREVIEW_CARDS} />;
}
