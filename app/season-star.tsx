/**
 * 시즌 테마의 즐겨찾기 그림 — 벚꽃은 꽃, 장마는 물방울.
 *
 * 유니코드 글리프(✿ ◌)를 쓰다가 SVG로 바꿨다. 이 앱은 카테고리 아이콘과 등급 배지에서
 * 이미 같은 이유로 이모지를 걷어냈다 — 기기의 글꼴이 그리는 그림은 사람마다 다르게
 * 보이고, 앱의 나머지가 전부 얇은 선인데 거기만 딴 서체의 글자가 섞인다.
 *
 * 규격은 다른 아이콘과 같다 (app/cat-icon.tsx, app/tier-icon.tsx): 24 격자, 굵기 1.8,
 * 둥근 끝, 색은 currentColor. 즐겨찾기 중이면 같은 모양을 채운다 — 컴포넌트가 ☆와 ★를
 * 갈아 끼우던 것과 같은 뜻이다.
 */

const base = {
  viewBox: '0 0 24 24',
  width: 14,
  height: 14,
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/*
 * 다섯 잎 꽃 — 중심에서 반지름 3인 점 다섯을 반지름 4.23 호로 이었다.
 * 점을 바깥에 두면 골짜기가 얕아져 그냥 동그라미가 된다 (버튼 테두리와 같은 이야기).
 */
const BLOSSOM =
  'M12 9 A4.23 4.23 0 1 1 14.85 11.07 A4.23 4.23 0 1 1 13.76 14.43 ' +
  'A4.23 4.23 0 1 1 10.24 14.43 A4.23 4.23 0 1 1 9.15 11.07 A4.23 4.23 0 1 1 12 9 Z';

/** 물방울 — 위가 뾰족하고 아래가 둥글다. 카드 버튼의 곡률과 같은 말이다 */
const DROP = 'M12 3.6c3.9 4.6 6 7.6 6 9.9a6 6 0 0 1-12 0c0-2.3 2.1-5.3 6-9.9z';

export default function SeasonStar({ deco, on }: { deco: 'petal' | 'rain'; on: boolean }) {
  return (
    <svg {...base} fill={on ? 'currentColor' : 'none'}>
      <path d={deco === 'petal' ? BLOSSOM : DROP} />
    </svg>
  );
}
