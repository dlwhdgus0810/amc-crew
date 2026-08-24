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
 */
const COUNT = { petal: 16, rain: 18, snow: 9, leaf: 16 } as const;

export default function SeasonDeco({ kind }: { kind: 'petal' | 'rain' | 'snow' | 'leaf' | null }) {
  const path = usePathname();
  if (!kind || !DECORATED.some((re) => re.test(path))) return null;
  return (
    <div aria-hidden="true" className={`season-deco season-${kind}`}>
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
