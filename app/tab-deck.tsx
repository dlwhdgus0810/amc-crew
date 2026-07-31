'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { slideTo, TABS } from './tab-transition';
import { PeekProvider } from './tab-peek-context';
import HomePage from './home-page';
import CategoriesPage from './categories/categories-page';
import CalendarClient from './calendar/calendar-client';
import NotificationsPage from './notifications/notifications-page';
import ProfilePage from './profile/profile-page';

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
const NEIGHBOUR_DELAY = 1000;

const EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';

/**
 * 탭 첫 화면들.
 *
 * 라우트(app/page.tsx 등)는 주소만 맡고 아무것도 그리지 않는다. 화면은 전부 여기서 그린다 —
 * 이 컴포넌트가 레이아웃에 있어 탭을 옮겨도 다시 마운트되지 않기 때문이다.
 * 그래서 한 번 띄운 탭은 그대로 살아 있고, 되돌아와도 처음부터 불러오지 않는다.
 */
const PANELS: Record<string, React.ComponentType<{ today: string }>> = {
  '/': HomePage,
  '/categories': CategoriesPage,
  '/calendar': CalendarClient,
  '/notifications': NotificationsPage,
  '/profile': ProfilePage,
};

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
 * 탭 다섯 개를 한 벌로 들고 있는 자리.
 *
 * 지금 탭은 흐름 안에 그대로 그리고, 나머지는 화면 밖에 세워둔다.
 * 좌우로 밀면 지금 탭과 옆 탭이 같은 거리만큼 함께 움직인다 — 두 장이 이어져 있는 것처럼.
 * 넘어간 뒤에도 화면이 다시 마운트되지 않으므로 깜빡이지 않는다.
 *
 * 미는 것은 설치한 앱에서만 켠다 — 브라우저 탭에는 뒤로가기 스와이프가 이미 있어서 서로 싸운다.
 */
export default function TabDeck({ today, children }: { today: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const index = TABS.indexOf(pathname);

  const [standalone, setStandalone] = useState(false);
  /** 지금까지 띄운 탭들 — 한 번 띄우면 내리지 않는다 */
  const [live, setLive] = useState<string[]>(() => (index >= 0 ? [pathname] : []));
  const panels = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (isStandalone()) setStandalone(true);
  }, []);

  /* 지금 탭은 무조건, 옆 탭은 지금 탭이 자리를 잡은 뒤에 올린다 */
  useEffect(() => {
    if (index < 0) return;
    setLive((prev) => (prev.includes(pathname) ? prev : [...prev, pathname]));
    if (!standalone) return;
    // 착지하자마자 옆 탭까지 불러오면 정작 보고 있는 화면이 늦게 찬다
    const timer = window.setTimeout(() => {
      const neighbours = [TABS[index - 1], TABS[index + 1]].filter(Boolean);
      setLive((prev) => [...prev, ...neighbours.filter((h) => !prev.includes(h))]);
    }, NEIGHBOUR_DELAY);
    return () => window.clearTimeout(timer);
  }, [pathname, index, standalone]);

  /*
   * 탭이 바뀌면 맨 위에서 시작한다.
   * 화면이 살아 있는 채로 자리만 바꾸는 것이라 Next가 스크롤을 맞춰주지 않는다 —
   * 안 맞추면 이전 탭에서 내려둔 만큼 내려간 자리에서 새 탭이 열린다.
   * (홈은 이 다음에 자기가 기억한 자리로 되돌린다)
   */
  useLayoutEffect(() => {
    if (index >= 0) window.scrollTo(0, 0);
  }, [index]);

  useEffect(() => {
    if (index < 0 || typeof window === 'undefined' || !standalone) return;
    const page = panels.current[pathname];
    if (!page) return;

    let startX = 0;
    let startY = 0;
    let startedAt = 0;
    let armed = false;
    /** 가로 손짓이라고 판단해 화면을 붙잡고 있는 중인지 */
    let dragging = false;

    const sideward = (dx: number) => panels.current[TABS[index + (dx < 0 ? 1 : -1)]] ?? null;
    const others = () =>
      TABS.filter((h) => h !== pathname)
        .map((h) => panels.current[h])
        .filter(Boolean) as HTMLDivElement[];

    const setOffset = (px: number) => {
      page.style.transform = px === 0 ? '' : `translateX(${px}px)`;
    };

    /** 세워둔 탭들을 화면 밖 제자리로 */
    const park = () => {
      for (const el of others()) {
        el.style.transition = '';
        el.style.transform = '';
      }
    };

    const release = (transition: boolean) => {
      document.documentElement.style.overflowX = '';
      page.style.transition = transition ? `transform 180ms ${EASE}` : '';
      setOffset(0);
      page.style.willChange = '';
      if (!transition) {
        park();
      } else {
        // 지금 탭과 옆 탭이 같은 속도로 함께 돌아와야 붙어 있는 것처럼 보인다
        for (const el of others()) {
          el.style.transition = `transform 180ms ${EASE}`;
          el.style.transform = '';
        }
        window.setTimeout(() => {
          page.style.transition = '';
          park();
        }, 200);
      }
      dragging = false;
    };

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
      dragging = false;
      page.style.transition = '';

      /*
       * 세워둔 탭은 상단 바 아래에서 시작해야 한다. 바 높이는 관리자 배너("~로 보는 중")
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
      for (const el of others()) el.style.top = `${top}px`;
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
      const coming = sideward(dx);
      setOffset(coming ? dx : dx / 4);

      /*
       * 들어오는 탭을 바로 옆에 붙여 같은 거리만큼 끌고 온다.
       * 두 장이 이어져 있는 것처럼 보이는 건 전적으로 이 한 줄이다.
       */
      if (coming) {
        const width = window.innerWidth;
        coming.style.transition = '';
        coming.style.transform = `translateX(${(dx < 0 ? width : -width) + dx}px)`;
      }
      // 손이 방향을 바꾸면 반대쪽은 제자리로 (어중간하게 걸쳐 있으면 두 장이 겹쳐 보인다)
      const other = sideward(-dx);
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

      const coming = sideward(dx);
      if (!coming) {
        /*
         * 옆 탭이 아직 안 올라왔다 (착지한 지 얼마 안 됐다).
         * 손가락이 놓인 자리를 넘겨 화면 전환 애니메이션으로 마무리한다.
         */
        document.documentElement.style.setProperty('--tab-drag', `${Math.round(dx)}px`);
        release(false);
        slideTo(target, pathname, (href) => router.push(href));
        return;
      }

      /*
       * 남은 거리를 마저 민 다음 주소만 바꾼다.
       * 화면은 이미 제자리에 와 있고 다시 그려지지도 않는다 — 자리만 맞바꾸면 끝이다.
       */
      dragging = false;
      const width = window.innerWidth;
      page.style.transition = `transform ${FINISH_MS}ms ${EASE}`;
      setOffset(dx < 0 ? -width : width);
      coming.style.transition = `transform ${FINISH_MS}ms ${EASE}`;
      coming.style.transform = 'translateX(0px)';

      window.setTimeout(() => router.push(target), FINISH_MS);
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
      /*
       * 탭이 바뀌어 여기까지 왔다면 자리 맞바꾸기는 이미 끝났다.
       * 밀어놨던 자국만 지운다 — 같은 순간에 일어나므로 눈에는 이어진다.
       */
      release(false);
      page.style.transition = '';
    };
  }, [pathname, index, router, standalone, live]);

  return (
    <>
      {children}
      {TABS.filter((href) => live.includes(href)).map((href) => {
        const Panel = PANELS[href];
        /*
         * 옆에 세워두는 건 밀 수 있을 때뿐이다. 브라우저에서는 미는 기능이 없으니
         * 그릴 이유도 없다 — 화면 밖이라도 그리는 값은 든다.
         */
        const at = index < 0 || !standalone ? 99 : TABS.indexOf(href) - index;
        const here = at === 0;
        return (
          <div
            key={href}
            ref={(el) => {
              panels.current[href] = el;
            }}
            className={here ? 'tab-live' : 'tab-parked'}
            data-side={at === -1 ? 'prev' : at === 1 ? 'next' : 'away'}
            aria-hidden={here ? undefined : true}
            inert={here ? undefined : true}
          >
            {/* 세워둔 탭은 사람이 보고 있는 화면이 아니다 — 읽음 처리·스크롤 저장을 막는다 */}
            <PeekProvider value={!here}>
              <Panel today={today} />
            </PeekProvider>
          </div>
        );
      })}
    </>
  );
}
