'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/** 탭바 순서와 같아야 한다 (app/nav.tsx) — 좌우로 넘길 때 이 차례대로 간다 */
const TABS = ['/', '/categories', '/calendar', '/notifications', '/profile'];

/** 이만큼은 밀어야 넘긴다 (px) — 짧게 스치는 손짓으로 화면이 바뀌면 성가시다 */
const DISTANCE = 60;
/** 가로가 세로보다 이 배 이상이어야 가로 스와이프로 본다 (비스듬한 스크롤을 넘기지 않으려고) */
const HORIZONTAL_RATIO = 1.5;
/** 이보다 오래 끌었으면 스와이프가 아니라 무언가를 붙잡고 있던 것으로 본다 (ms) */
const MAX_DURATION = 600;
/** 화면 가장자리에서 시작한 손짓은 건드리지 않는다 — iOS의 시스템 제스처 영역이다 */
const EDGE = 24;

/** 홈 화면에 설치해 주소창 없이 열린 상태인지 */
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * 이 손짓을 우리가 가로채면 안 되는 자리인지.
 *
 * 가로로 스크롤되는 것(AMC 날짜 띠, 화면 안 탭, 관리자 표)과 즐겨찾기 드래그 손잡이 위에서는
 * 손가락이 그것들을 움직여야 한다. 탭까지 넘어가면 둘 다 못 쓰게 된다.
 */
function startsOnSomethingElse(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  while (el) {
    if (el.closest?.('.car-drag')) return true;
    const style = window.getComputedStyle(el);
    const scrollsSideways = style.overflowX === 'auto' || style.overflowX === 'scroll';
    if (scrollsSideways && el.scrollWidth > el.clientWidth + 1) return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * 탭 첫 화면끼리 좌우로 넘기기.
 *
 * 설치한 앱에서만 켠다 — 브라우저 탭에는 뒤로가기 스와이프가 이미 있어서 서로 싸운다.
 * 모임 상세나 카테고리 피드처럼 탭 첫 화면이 아닌 곳에서도 켜지 않는다.
 */
export default function TabSwipe() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const index = TABS.indexOf(pathname);
    if (index < 0 || typeof window === 'undefined' || !isStandalone()) return;

    // 옆 탭을 미리 받아둔다 — 넘긴 뒤 빈 화면을 보는 시간을 줄인다
    for (const next of [TABS[index - 1], TABS[index + 1]]) if (next) router.prefetch(next);

    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let armed = false;

    const onStart = (e: TouchEvent) => {
      // 손가락이 둘 이상이면 확대·축소다
      if (e.touches.length !== 1) {
        armed = false;
        return;
      }
      const touch = e.touches[0];
      armed =
        touch.clientX > EDGE &&
        touch.clientX < window.innerWidth - EDGE &&
        !startsOnSomethingElse(e.target);
      startX = touch.clientX;
      startY = touch.clientY;
      startedAt = Date.now();
    };

    const onEnd = (e: TouchEvent) => {
      if (!armed) return;
      armed = false;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Date.now() - startedAt > MAX_DURATION) return;
      if (Math.abs(dx) < DISTANCE || Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return;

      // 왼쪽으로 밀면 다음 탭. 양 끝에서는 더 가지 않는다 (돌아 나오면 어디 있는지 헷갈린다)
      const target = TABS[index + (dx < 0 ? 1 : -1)];
      if (target) router.push(target);
    };

    // passive — 스크롤을 막지 않는다. 우리는 손짓이 끝난 뒤에만 판단한다
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchend', onEnd);
    };
  }, [pathname, router]);

  return null;
}
