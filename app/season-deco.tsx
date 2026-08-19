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
];

/** 꽃잎은 조금 적게, 비는 조금 많게 — 시안에서 그렇게 골랐다 */
const COUNT = { petal: 14, rain: 18 } as const;

export default function SeasonDeco({ kind }: { kind: 'petal' | 'rain' | null }) {
  const path = usePathname();
  if (!kind || !DECORATED.some((re) => re.test(path))) return null;
  return (
    <div aria-hidden="true" className={`season-deco season-${kind}`}>
      {Array.from({ length: COUNT[kind] }, (_, i) => (
        <span key={i} />
      ))}
    </div>
  );
}
