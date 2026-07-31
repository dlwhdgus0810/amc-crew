'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { slideTo, TABS } from './tab-transition';
import TabPeek from './tab-peek';

/** 이만큼은 밀어야 넘긴다 (px) — 짧게 스치는 손짓으로 화면이 바뀌면 성가시다 */
const DISTANCE = 60;
/** 가로가 세로보다 이 배 이상이어야 가로 스와이프로 본다 (비스듬한 스크롤을 넘기지 않으려고) */
const HORIZONTAL_RATIO = 1.5;
/** 이보다 오래 끌었으면 스와이프가 아니라 무언가를 붙잡고 있던 것으로 본다 (ms) */
const MAX_DURATION = 600;
/** 화면 가장자리에서 시작한 손짓은 건드리지 않는다 — iOS의 시스템 제스처 영역이다 */
const EDGE = 24;
/** 손을 뗀 뒤 남은 거리를 마저 미는 시간 (ms) */
const FINISH_MS = 220;
/** 지금 탭이 자리를 잡고 이만큼 지나면 옆 탭을 올린다 (ms) */
const PEEK_DELAY = 1000;
/** 넘긴 뒤 새 화면이 이때까지도 안 오면 미리보기를 걷는다 — 굳은 화면보다는 낫다 (ms) */
const HANDOVER_MAX = 1500;

const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

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
 *
 * 옆 탭을 실제로 띄워두고 본문과 함께 민다. 미리보기가 아직 안 올라왔으면
 * (막 착지했거나 아직 내려받는 중) 예전처럼 화면 전환 애니메이션으로 넘긴다.
 */
export default function TabSwipe({ today }: { today: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const index = TABS.indexOf(pathname);

  const [standalone, setStandalone] = useState(false);
  /** 옆 탭을 올려도 될 만큼 지금 탭이 자리를 잡았는지 */
  const [peeksUp, setPeeksUp] = useState(false);
  const prevRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 움직임을 줄여 달라고 한 사람에게는 옆 탭을 띄울 이유가 없다
    if (!isStandalone() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setStandalone(true);
  }, []);

  useEffect(() => {
    setPeeksUp(false);
    if (!standalone || index < 0) return;
    // 착지하자마자 옆 탭까지 불러오면 정작 보고 있는 화면이 늦게 찬다
    const timer = window.setTimeout(() => setPeeksUp(true), PEEK_DELAY);
    return () => window.clearTimeout(timer);
  }, [standalone, index]);

  useEffect(() => {
    if (index < 0 || typeof window === 'undefined' || !isStandalone()) return;

    // 옆 탭을 미리 받아둔다 — 넘긴 뒤 빈 화면을 보는 시간을 줄인다
    for (const next of [TABS[index - 1], TABS[index + 1]]) if (next) router.prefetch(next);

    // 손가락을 따라 움직일 대상. 헤더와 탭바는 고정이라 본문만 민다.
    const page = document.querySelector('main');
    if (!page) return;

    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let armed = false;
    /** 가로 손짓이라고 판단해 화면을 붙잡고 있는 중인지 */
    let dragging = false;
    /** 넘기기로 확정하고 새 화면을 기다리는 중 — 이때는 새 손짓을 받지 않는다 */
    let handingOver = false;
    let handoverTimer = 0;

    const peekOf = (dx: number) => (dx < 0 ? nextRef.current : prevRef.current);
    const peeks = () => [prevRef.current, nextRef.current].filter(Boolean) as HTMLDivElement[];

    /** 미리보기를 화면 밖 제자리로 (움직임 없이) */
    const parkPeeks = () => {
      for (const el of peeks()) {
        el.style.transition = '';
        el.style.transform = '';
      }
    };

    const setOffset = (px: number) => {
      page.style.transform = px === 0 ? '' : `translateX(${px}px)`;
    };

    const release = (transition: boolean) => {
      document.documentElement.style.overflowX = '';
      page.style.transition = transition ? `transform 180ms ${EASE}` : '';
      setOffset(0);
      page.style.willChange = '';
      if (!transition) {
        parkPeeks();
      } else {
        // 본문과 미리보기가 같은 속도로 함께 돌아와야 붙어 있는 것처럼 보인다
        for (const el of peeks()) {
          el.style.transition = `transform 180ms ${EASE}`;
          el.style.transform = '';
        }
        window.setTimeout(() => {
          page.style.transition = '';
          parkPeeks();
        }, 200);
      }
      dragging = false;
    };

    const onStart = (e: TouchEvent) => {
      // 손가락이 둘 이상이면 확대·축소다
      if (e.touches.length !== 1 || handingOver) {
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
      dragging = false;
      page.style.transition = '';

      /*
       * 미리보기는 상단 바 아래에서 시작해야 한다. 바 높이는 관리자 배너("~로 보는 중")
       * 때문에 화면마다 다를 수 있어, 손이 닿을 때 실제로 재서 맞춘다.
       */
      const header = document.querySelector('.site-header');
      let top = 0;
      if (header) {
        const rect = header.getBoundingClientRect();
        /*
         * 내려서 상단 바가 감춰진 상태면 bottom이 음수다. 손이 닿는 순간
         * 바가 다시 내려오므로(app/chrome-autohide.tsx), 그때의 자리인 높이를 쓴다.
         */
        top = document.body.dataset.chrome === 'hidden' ? rect.height : Math.max(0, rect.bottom);
      }
      for (const el of peeks()) el.style.top = `${top}px`;
    };

    const onMove = (e: TouchEvent) => {
      if (!armed || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!dragging) {
        // 세로가 이기면 스크롤이다 — 이번 손짓은 놓아준다
        if (Math.abs(dy) > Math.abs(dx)) {
          armed = false;
          return;
        }
        // 가로 의도가 분명해질 때까지는 아무것도 하지 않는다 (탭·스크롤을 방해하지 않으려고)
        if (Math.abs(dx) < 10) return;
        dragging = true;
        page.style.willChange = 'transform';
        /*
         * 오른쪽으로 밀면 본문이 문서 밖으로 나가 페이지가 옆으로 스크롤된다.
         * 미는 동안만 잘라둔다 (clip은 hidden과 달리 스크롤 컨테이너를 만들지 않아
         * 안쪽의 sticky·세로 스크롤이 그대로다).
         */
        document.documentElement.style.overflowX = 'clip';
      }

      // 갈 곳이 없는 쪽으로는 뻑뻑하게 — 끝이라는 게 손에 느껴진다
      const hasNeighbour = Boolean(TABS[index + (dx < 0 ? 1 : -1)]);
      setOffset(hasNeighbour ? dx : dx / 4);

      /*
       * 들어오는 화면을 바로 옆에 붙여 같은 거리만큼 끌고 온다.
       * 두 장이 이어져 있는 것처럼 보이는 건 전적으로 이 한 줄이다.
       */
      const width = window.innerWidth;
      const coming = hasNeighbour ? peekOf(dx) : null;
      if (coming) {
        coming.style.transition = '';
        coming.style.transform = `translateX(${(dx < 0 ? width : -width) + dx}px)`;
      }
      // 손이 방향을 바꾸면 반대쪽은 제자리로 (어중간하게 걸쳐 있으면 두 장이 겹쳐 보인다)
      const other = hasNeighbour ? peekOf(-dx) : null;
      if (other) other.style.transform = '';

      // 여기서부터는 우리 손짓이다. 세로 스크롤이 함께 일어나지 않게 막는다
      if (e.cancelable) e.preventDefault();
    };

    const onEnd = (e: TouchEvent) => {
      if (!armed) return;
      armed = false;
      const touch = e.changedTouches[0];
      if (!touch) {
        release(true);
        return;
      }

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const target = TABS[index + (dx < 0 ? 1 : -1)];
      const enough =
        Date.now() - startedAt <= MAX_DURATION &&
        Math.abs(dx) >= DISTANCE &&
        Math.abs(dx) >= Math.abs(dy) * HORIZONTAL_RATIO;

      if (!enough || !target) {
        // 모자라면 제자리로 — 튕겨 돌아오는 것으로 "안 넘어갔다"를 알린다
        if (dragging) release(true);
        return;
      }

      const coming = peekOf(dx);
      if (!coming) {
        /*
         * 옆 탭이 아직 안 올라왔다 (착지한 지 얼마 안 됐거나 내려받는 중).
         * 손가락이 놓인 자리를 넘겨 화면 전환 애니메이션으로 마무리한다.
         */
        document.documentElement.style.setProperty('--tab-drag', `${Math.round(dx)}px`);
        release(false);
        slideTo(target, pathname, (href) => router.push(href));
        return;
      }

      /*
       * 남은 거리를 마저 민다. 다 밀고 나면 미리보기가 화면을 덮고 있고,
       * 그 자리로 진짜 화면이 도착하는 순간 이 층이 통째로 사라진다 —
       * 눈에는 밀어 넣은 화면이 그대로 남아 있는 것처럼 보인다.
       */
      handingOver = true;
      dragging = false;
      const width = window.innerWidth;
      page.style.transition = `transform ${FINISH_MS}ms ${EASE}`;
      setOffset(dx < 0 ? -width : width);
      coming.style.transition = `transform ${FINISH_MS}ms ${EASE}`;
      coming.style.transform = 'translateX(0px)';

      window.setTimeout(() => router.push(target), FINISH_MS);
      // 새 화면이 끝내 안 오면 되돌린다 (경로가 안 바뀌면 아래 정리도 돌지 않는다)
      handoverTimer = window.setTimeout(() => {
        handingOver = false;
        release(false);
      }, HANDOVER_MAX);
    };

    const onCancel = () => release(true);

    window.addEventListener('touchstart', onStart, { passive: true });
    // passive: false — 가로 손짓으로 판단한 뒤에만 preventDefault를 부른다
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onCancel);
      window.clearTimeout(handoverTimer);
      /*
       * 경로가 바뀌어 여기까지 왔다면 새 화면이 이미 자리에 있다.
       * 밀어놨던 본문이 제자리로 돌아오는 것과 미리보기가 사라지는 것이 같은 순간에
       * 일어나므로, 눈에는 그대로 이어진다.
       */
      release(false);
      page.style.transition = '';
    };
  }, [pathname, router, index]);

  if (!standalone || index < 0 || !peeksUp) return null;

  const prev = TABS[index - 1];
  const next = TABS[index + 1];
  return (
    <>
      {prev && (
        <div className="tab-peek" data-side="prev" ref={prevRef} aria-hidden inert>
          <div className="container">
            <TabPeek href={prev} today={today} />
          </div>
        </div>
      )}
      {next && (
        <div className="tab-peek" data-side="next" ref={nextRef} aria-hidden inert>
          <div className="container">
            <TabPeek href={next} today={today} />
          </div>
        </div>
      )}
    </>
  );
}
