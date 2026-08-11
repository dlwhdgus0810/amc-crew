'use client';

import { useEffect } from 'react';

/**
 * 해를 지운다 — 화면 전체를 낮 색에서 밤 색으로 흐르게 하는 방아쇠.
 *
 * 그림을 그리지 않는다. 색은 CSS가 갖고 있고(.sky-scope.night), 이 조각은 언제 그
 * 스위치를 올릴지만 정한다.
 *
 * **본문 안에 둔다.** 하늘(app/sky-backdrop.tsx)은 Suspense 바깥이라 첫 순간에 뜨지만,
 * 모임 목록은 서버에서 흘러들어와 조금 늦게 붙는다. 하늘 쪽에서 스위치를 올리면 그 사이에
 * 도착한 카드들이 「낮이었던 적 없이」 밤 색으로 그려져서, 화면이 저무는 동안 본문만
 * 처음부터 어둡다. 이 조각은 본문과 같이 뜨므로 그럴 일이 없다.
 *
 * 두 단계로 나눠 붙이는 이유: transition을 까는 클래스와 값을 바꾸는 클래스를 같은
 * 프레임에 붙이면 브라우저가 「transition 없음 + 낮」에서 「transition 있음 + 밤」으로
 * 한 번에 건너뛴다 — 흐를 이전 값이 없어서 그냥 점프한다.
 */
export default function SkySundown() {
  useEffect(() => {
    const el = document.querySelector('.sky-scope');
    if (!el || el.classList.contains('night')) return;

    let raf2 = 0;
    let armed = false;
    let started = false;

    /** ① transition을 깔아 둔다 (색은 아직 낮) */
    const arm = () => {
      if (armed) return;
      armed = true;
      document.body.classList.add('sky-sundown');
      // 브라우저가 여기까지를 실제로 셈하게 만든다 — 이래야 다음 변경이 흐른다
      void (el as HTMLElement).getBoundingClientRect();
    };
    /** ② 값을 밤으로 바꾼다. 깔아 둔 transition을 타고 흐른다 */
    const start = () => {
      if (started) return;
      arm();
      started = true;
      el.classList.add('night');
    };

    const raf1 = requestAnimationFrame(() => {
      arm();
      raf2 = requestAnimationFrame(start);
    });
    /*
     * requestAnimationFrame은 화면이 안 보이는 동안 아예 안 불린다 — 뒤쪽 탭으로 열었거나
     * 그 사이 화면이 꺼졌으면 영영 안 온다. 그것만 믿으면 그 사람 화면은 낮에 멈춘다.
     */
    const fallback = setTimeout(start, 150);
    // 다 지고 나면 transition을 걷는다 (남겨 두면 그 뒤 모든 색 변화가 5.5초씩 걸린다)
    const done = setTimeout(() => document.body.classList.remove('sky-sundown'), 6200);

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(fallback);
      clearTimeout(done);
      document.body.classList.remove('sky-sundown');
    };
  }, []);

  return null;
}
