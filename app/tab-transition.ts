'use client';

/**
 * 탭 사이 이동을 옆으로 미끄러지게 만든다.
 *
 * 다섯 화면을 한꺼번에 띄워놓고 굴리는 대신 View Transitions에 맡긴다 —
 * 브라우저가 이전 화면을 그림으로 떠서 새 화면과 겹쳐 움직여주므로,
 * 라우팅 구조를 그대로 두고도 이어지는 느낌이 난다.
 * 지원하지 않는 브라우저에서는 그냥 바로 바뀐다 (예전과 같은 동작).
 */

/** 탭바 순서 (app/nav.tsx와 같아야 한다) */
export const TABS = ['/', '/categories', '/calendar', '/notifications', '/profile'];

type Direction = 'next' | 'prev';

/* 아직 없는 브라우저가 있어 있는지부터 확인하고 쓴다 (타입 정의는 lib.dom에 이미 있다) */
type StartViewTransition = (callback: () => void | Promise<void>) => { finished: Promise<void> };

/** 이 이동이 오른쪽으로 가는 것인지 왼쪽으로 가는 것인지 (탭 목록 밖이면 null) */
export function directionBetween(from: string, to: string): Direction | null {
  const a = TABS.indexOf(from);
  const b = TABS.indexOf(to);
  if (a < 0 || b < 0 || a === b) return null;
  return b > a ? 'next' : 'prev';
}

/**
 * 새 화면이 실제로 그려질 때까지 기다린다.
 *
 * router.push는 곧바로 돌아오고 렌더는 그 뒤에 일어난다. 그대로 두면 브라우저가
 * "바뀌기 전"과 "바뀌기 전"을 겹쳐 애니메이션이 없는 것처럼 보인다.
 * 주소가 바뀐 뒤 한 프레임을 더 준다. 늦어지면 기다림을 끊는다 — 화면이 멈춰 보이는 것보다는 낫다.
 */
function waitForRender(target: string, timeout = 700): Promise<void> {
  return new Promise((resolve) => {
    const startedAt = performance.now();
    /*
     * setTimeout으로 확인한다. requestAnimationFrame은 쓸 수 없다 —
     * 전환이 시작되면 브라우저가 렌더를 멈추므로 rAF 콜백이 아예 돌지 않아,
     * 타임아웃까지 걸리지 않고 그대로 굳어버린다.
     */
    const tick = () => {
      if (window.location.pathname === target || performance.now() - startedAt > timeout) {
        // 주소가 바뀐 직후엔 아직 옛 화면이라, 한 박자 두고 새 화면을 잡게 한다
        setTimeout(resolve, 32);
        return;
      }
      setTimeout(tick, 16);
    };
    tick();
  });
}

/**
 * 방향을 실어 탭으로 이동한다.
 * push는 호출부가 넘긴다 — 이 파일이 next/navigation을 알 필요는 없다.
 */
export function slideTo(target: string, from: string, push: (href: string) => void): void {
  const direction = directionBetween(from, target);
  const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition;
  // 움직임을 줄여 달라고 설정한 사람에게는 애니메이션을 걸지 않는다
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!direction || reduced || typeof start !== 'function') {
    // 스와이프가 남긴 시작점을 치운다 — 여기서 안 지우면 다음 전환까지 따라간다
    document.documentElement.style.removeProperty('--tab-drag');
    push(target);
    return;
  }

  // CSS가 이 값을 보고 어느 쪽으로 밀지 정한다
  document.documentElement.dataset.tabSlide = direction;
  const transition = start.call(document, async () => {
    push(target);
    await waitForRender(target);
  });
  const clear = () => {
    delete document.documentElement.dataset.tabSlide;
    // 다음 전환이 옛 손짓 위치에서 출발하지 않도록 치운다
    document.documentElement.style.removeProperty('--tab-drag');
  };
  // 전환이 중간에 건너뛰어지면 finished가 거부된다 — 표시는 어느 쪽이든 지워야 한다
  transition.finished.then(clear, clear);
}
