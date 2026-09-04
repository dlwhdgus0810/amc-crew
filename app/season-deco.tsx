'use client';

/**
 * 시즌 테마의 배경 장식 — 벚꽃 꽃잎, 장마 빗줄기.
 *
 * 그림만 있고 손가락은 받지 않는다. overrides.css의 유성(.meteors)과 같은 방식이다.
 *
 * **경로를 보는 이유.** 장식은 홈·둘러보기·카테고리 피드·캘린더·모아보기에만 깐다.
 * 만들기 패널·정산·프로필처럼 뭔가 적어 넣는 화면에서는 뒤에서 계속 움직이는 것이
 * 방해가 된다. 그래서 layout.tsx 한 곳에 그냥 둘 수 없고, 이 컴포넌트가 경로를 본다.
 *
 * 낱개 <span>은 CSS의 :nth-child가 위치·주기·투명도를 흩뜨린다. 여기서는 개수만 정한다.
 */

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

/* <rain-field>·<snow-field>는 커스텀 엘리먼트다 — React 19는 JSX 이름을 React 밑에서 찾는다 */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'rain-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { rate?: string };
      'snow-field': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { rate?: string };
    }
  }
}

/**
 * 장식을 깔 화면.
 *
 * 탭바 다섯 개(app/nav.tsx) 중 프로필만 뺀 것 + 카테고리 피드(/c/[slug]).
 * 탭 경로를 바꾸면 여기도 같이 봐야 한다.
 */
const DECORATED = [
  /^\/$/, // 홈
  /^\/categories/, // 둘러보기
  /^\/c\//, // 카테고리 피드
  /^\/calendar/, // 캘린더
  /^\/photos/, // 모아보기
  /*
   * 테마 미리보기 (app/preview/page.tsx) — 홈 그대로를 보여 주는 자리다.
   *
   * 여기를 빼 두면 미리보기에 **카드 안의 비만** 보이고 배경 비는 안 온다. 시즌
   * 테마에서 배경 장식은 곁다리가 아니라 절반이라, 그걸 빼고 견주면 산 뒤에 다른
   * 화면을 보게 된다.
   */
  /^\/preview$/,
];

/**
 * 꽃잎은 열여섯이다 — app/season-spring-petals.css가 모양·색·크기를 그 수에 맞춰
 * 갈라 두었다(부채꼴 6, 모난 둥근꼴 3, 잔물결 3, 말린 2, 날아가는 자세 1, 달걀꼴 1).
 *
 * 눈은 아홉이다. 결정 하나가 20~26px이라 꽃잎만큼 뿌리면 화면이 눈으로 덮인다.
 *
 * 낙엽은 열여섯이다. 도안 여덟 종을 두 번씩 쓴다 — 여덟이면 같은 잎이 화면에 하나씩
 * 뿐이라 무엇이 떨어지는지 보이기 전에 지나가고, 서른둘이면 낙엽이 아니라 폭우다.
 *
 * 금가루는 스물둘이다. 4~13px짜리 빛점이라 열여섯이면 화면이 휑하다 (patch14).
 */
const COUNT = { petal: 16, rain: 18, snow: 9, leaf: 16, gold: 22 } as const;

/**
 * 꽃잎 한 장이 한 바퀴를 마칠 때마다 그 장을 다시 뽑는다.
 *
 * **왜 CSS만으로는 안 되나.** CSS 애니메이션은 같은 길을 무한히 되풀이하는 것이다.
 * season-spring-petals.css가 모양 여섯, 크기 넷, 주기 여섯(9·12.5·15·17·19·21초)을
 * 갈라 두었으니 열여섯 장이 한꺼번에 같은 모습이 되는 일은 없다 — 주기의 최소공배수가
 * 141시간이라 「화면 전체」가 되풀이되지는 않는다. 그런데도 되풀이로 보이는 이유는
 * 따로 있다. **한 장 한 장이 자기 길을 그대로 다시 내려온다.** 24% 자리의 꽃잎은
 * 9초마다 똑같은 자리에서 똑같이 두 번 흔들리고 똑같이 두 바퀴 돌아 내려간다.
 * 스무 초쯤 보고 있으면 열여섯 장의 밑천이 다 드러난다.
 *
 * 그래서 한 바퀴가 끝나는 순간(animationiteration)에 자리·크기·주기·흔들림·회전을
 * 새로 뽑아 꽂는다. 그 순간 꽃잎은 화면 아래(120vh)를 막 지나 위(-4%)로 돌아간
 * 참이라 무엇을 바꿔도 보이지 않는다.
 *
 * 값을 갈아 끼운 다음 animation-name을 껐다 켜서 애니메이션을 다시 시작시킨다.
 * 그냥 두면 시작 시각이 그대로라 브라우저가 「지난 시간 ÷ 새 주기」로 진행도를 다시
 * 계산한다 — 15초짜리를 21초로 바꾼 순간 꽃잎이 71% 지점으로 순간이동한다.
 *
 * 움직임 줄이기(prefers-reduced-motion)에서는 애니메이션 자체가 없으므로 이 이벤트가
 * 오지 않는다 — 여기서 따로 볼 것이 없다.
 */
function usePetalShuffle(box: { current: HTMLDivElement | null }, on: boolean) {
  useEffect(() => {
    const root = box.current;
    if (!on || !root) return;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const px = (n: number) => `${Math.round(n)}px`;

    /* 처음 한 번 잰 CSS 값. 인라인을 씌운 뒤에 재면 우리가 쓴 값이 되돌아온다 */
    type Base = { w: number; h: number; dur: number; spin: number };
    const base = new WeakMap<HTMLElement, Base>();
    const baseOf = (el: HTMLElement): Base => {
      let b = base.get(el);
      if (!b) {
        const cs = getComputedStyle(el);
        b = {
          w: parseFloat(cs.width) || 15,
          h: parseFloat(cs.height) || 15,
          dur: parseFloat(cs.animationDuration) || 15,
          spin: parseFloat(cs.getPropertyValue('--spin')) || 0.5,
        };
        base.set(el, b);
      }
      return b;
    };

    const BAND = 100 / COUNT.petal;

    const deal = (el: HTMLElement, i: number) => {
      const b = baseOf(el);
      const st = el.style;

      /*
       * 가로 자리. 그냥 0~100%로 뽑으면 열여섯 장이 한쪽에 몰리는 때가 생겨 화면 반쪽이
       * 빈다. 자기 띠 안에서 뽑되 열에 넷은 옆 띠까지 넘어가게 두면, 폭은 고르게 덮으면서
       * 같은 자리로 두 번 내려오지는 않는다.
       */
      const lane = i + (Math.random() < 0.4 ? (Math.random() < 0.5 ? -1 : 1) : 0);
      st.left = `${(((((lane + Math.random()) * BAND) % 100) + 100) % 100).toFixed(2)}%`;

      /* 크기와 속도는 같이 간다 — 큰 것이 가까이 있는 것이고, 가까운 것이 빨리 진다 */
      const f = rand(0.85, 1.2);
      st.width = px(b.w * f);
      st.height = px(b.h * f);
      st.animationDuration = `${Math.max(8, (b.dur * rand(0.9, 1.15)) / f).toFixed(1)}s`;
      /* 뜸을 준다. 없으면 한 자리에서 박자 맞춰 떨어지는 것이 보인다 */
      st.animationDelay = `${rand(0, 2.6).toFixed(1)}s`;

      /* 도는 방향과 양. 바탕값에 곱하므로 「날아가는 자세」가 덜 도는 설계는 그대로다 */
      st.setProperty('--spin', (b.spin * rand(0.55, 1.5) * (Math.random() < 0.5 ? -1 : 1)).toFixed(2));
      st.setProperty('--w', Math.random() < 0.5 ? '-1' : '1');

      /*
       * 흔들리는 폭 다섯 마디. 넷 중 셋만 방향을 바꾸므로 어떤 장은 한동안 한쪽으로
       * 미끄러지다 돌아온다 — 폭이 늘 -20 → 18 → -16 → 20이면 그 한 가지 춤이 눈에 띈다.
       */
      let sign = Math.random() < 0.5 ? 1 : -1;
      for (let k = 0; k <= 4; k++) {
        st.setProperty(`--x${k}`, px(sign * rand(8, 32)));
        if (Math.random() < 0.75) sign = -sign;
      }
      /* 마디의 높이도 어긋나게 — 사분점에 딱 맞으면 열여섯 장이 같은 속도로 내려간다 */
      st.setProperty('--y1', `${rand(22, 36).toFixed(0)}vh`);
      st.setProperty('--y2', `${rand(52, 68).toFixed(0)}vh`);
      st.setProperty('--y3', `${rand(82, 94).toFixed(0)}vh`);

      /* 새 주기로 처음부터. 이 세 줄이 없으면 진행도가 다시 계산돼 순간이동한다 */
      st.animationName = 'none';
      void el.offsetWidth;
      st.animationName = '';
    };

    const onIter = (e: AnimationEvent) => {
      if (e.animationName !== 'kk-petal-air') return;
      const el = e.target as HTMLElement;
      const i = Array.prototype.indexOf.call(root.children, el);
      if (i >= 0) deal(el, i);
    };

    root.addEventListener('animationiteration', onIter);
    return () => {
      root.removeEventListener('animationiteration', onIter);
      /* 테마가 바뀌면 <span>은 그대로 두고 class만 갈리므로 우리가 쓴 값을 걷어 낸다 */
      for (const el of Array.from(root.children)) (el as HTMLElement).removeAttribute('style');
    };
  }, [box, on]);
}

export default function SeasonDeco({ kind }: { kind: 'petal' | 'rain' | 'snow' | 'leaf' | 'gold' | null }) {
  const path = usePathname();
  const box = useRef<HTMLDivElement>(null);
  /* 훅은 늘 같은 수만큼 불러야 하므로 「그릴 자리인가」를 먼저 재고 돌아가는 것은 뒤로 */
  const on = !!kind && DECORATED.some((re) => re.test(path));
  usePetalShuffle(box, on && kind === 'petal');
  if (!on) return null;
  return (
    <div ref={box} aria-hidden="true" className={`season-deco season-${kind}`}>
      {/*
        * 비는 캔버스 하나가 화면 전체를 맡는다 (public/rain-field.js). 낱개 <span>으로
        * 두면 방울이 어디쯤 있는지 코드가 몰라서, 카드를 만났을 때 그 방울을 카드에
        * 넘겨줄 수가 없다 — 배경 비와 카드 비가 따로 노는 이유가 그것이었다.
        *
        * 꽃잎은 지금처럼 낱개다. 넘겨줄 데가 없으므로 알 필요도 없다.
        */}
      {kind === 'rain' ? (
        <rain-field />
      ) : kind === 'snow' ? (
        /* 눈도 같은 이유로 캔버스 하나다 — 낱개 <span>은 카드에 넘겨줄 수가 없다 */
        <snow-field />
      ) : (
        Array.from({ length: COUNT[kind] }, (_, i) => <span key={i} />)
      )}
    </div>
  );
}
