'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/** 이 위쪽에서는 항상 보여준다 (맨 위에서 감추면 갑자기 사라지는 느낌이 난다) */
const ALWAYS_SHOW_ABOVE = 40;
/** 이만큼은 움직여야 반응한다 — 손가락이 살짝 떨릴 때마다 깜빡이지 않도록 */
const STEP = 6;

/**
 * 아래로 내리면 상단 바와 하단 탭바를 감춰 화면을 넓게 쓴다. 위로 올리면 다시 나온다.
 * 감추고 보이는 건 CSS가 하고(body[data-chrome]), 여기서는 방향만 알려준다.
 *
 * 홈 화면에 설치해서 쓰는 중인지도 여기서 적는다(body[data-standalone]) — 그 상태에서는
 * 상단 바를 통째로 감춘다. 둘 다 「이 화면에 앱 껍데기를 얼마나 보여줄까」라서 한자리에 둔다.
 */
export default function ChromeAutoHide() {
  const pathname = usePathname();

  /*
   * 설치해서 쓰는 중인지는 한 번만 본다 — 브라우저 탭에서 홈 화면 앱으로 바뀌는 일은 없다.
   *
   * 두 가지를 같이 보는 이유는 앱의 다른 곳(push-toggle·install-prompt)과 같다:
   * 표준 display-mode가 아이폰에서 틀리게 나올 때가 있어서 사파리 전용 플래그도 함께 본다.
   */
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) document.body.dataset.standalone = 'yes';
  }, []);

  useEffect(() => {
    // 화면을 옮기면 항상 보이는 상태로 시작한다
    document.body.dataset.chrome = 'shown';

    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - last;
      if (Math.abs(dy) < STEP) return;
      last = y;
      document.body.dataset.chrome = y > ALWAYS_SHOW_ABOVE && dy > 0 ? 'hidden' : 'shown';
    };

    /*
     * 손이 닿는 순간 바를 즉시 되돌린다. 감춰져 있다가 되돌아오는 0.25초 사이에 누르면
     * 움직이는 표적을 누르는 셈이라 첫 탭이 새는 일이 있다.
     */
    const reveal = () => {
      if (document.body.dataset.chrome === 'hidden') document.body.dataset.chrome = 'shown';
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('touchstart', reveal, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('touchstart', reveal);
    };
  }, [pathname]);

  return null;
}
