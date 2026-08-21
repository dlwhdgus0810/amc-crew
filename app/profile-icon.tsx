/*
 * 탭바 프로필 아이콘 — 벚꽃 · 장마 · 겨울
 *
 * 이 자리는 원래 아이콘이 아니라 .t-ava 하나입니다 — 사진이 있으면 사진, 없으면 이름 첫
 * 자입니다. 사진이 있을 때는 틀 곡률만 계절을 따르고(그건 season.css에 있습니다),
 * **사진이 없을 때** 첫 자 대신 이 아이콘을 쓸 수 있습니다.
 *
 * SVG의 d 속성이라 CSS로는 바꿀 수 없어서 nav.tsx에서 갈라야 합니다. 넷(집·나침반·달력·
 * 사진틀)은 그대로 두십시오 — 탭을 그림으로 기억한 사람이 매번 다시 찾게 됩니다.
 *
 * 선 굵기가 계절마다 다릅니다: 벚꽃 1.5 / 장마 1.2 / 겨울 1.8. 나머지 넷과 같은 값이라
 * 한 탭바 안에서 굵기가 어긋나지 않습니다.
 */

type Season = 'petal' | 'rain' | 'snow';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function ProfileIcon({ season, size = 20 }: { season?: Season; size?: number }) {
  /* 벚꽃 — 다섯 잎 꽃 + 가운데 수술.
     꽃잎 다섯은 지름 4 원 위의 다섯 점을 반지름 4.2 호로 이은 것입니다. 점을 바깥 원에
     두면 골짜기가 2px밖에 안 파여서 그냥 동그라미로 보입니다. */
  if (season === 'petal') {
    return (
      <svg {...base} width={size} height={size} style={{ strokeWidth: 1.5 }}>
        <path d="M12 9 A4.2 4.2 0 1 1 14.85 11.07 A4.2 4.2 0 1 1 13.76 14.43 A4.2 4.2 0 1 1 10.24 14.43 A4.2 4.2 0 1 1 9.15 11.07 A4.2 4.2 0 1 1 12 9 Z" />
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    );
  }

  /* 장마 — 큰 방울 + 작은 방울. 프로필 자체가 방울입니다. */
  if (season === 'rain') {
    return (
      <svg {...base} width={size} height={size} style={{ strokeWidth: 1.2 }}>
        <path d="M12 4.4c3.4 4.2 5.2 7.2 5.2 9.2a5.2 5.2 0 0 1-10.4 0c0-2 1.8-5 5.2-9.2z" />
        <path d="M18.9 15.6c1.5 1.9 2.3 3.2 2.3 4.1a2.3 2.3 0 0 1-4.6 0c0-.9.8-2.2 2.3-4.1z" />
      </svg>
    );
  }

  /* 겨울 — 여섯 갈래 결정. 즐겨찾기 버튼(--sf-crystal)과 같은 언어이고, 20px에서 뭉개지지
     않게 갈래마다 잔가지를 한 쌍씩만 남겼습니다. 틀이 이미 육각이라(clip-path) 안에
     육각을 또 두지 않습니다. */
  return (
    <svg {...base} width={size} height={size} style={{ strokeWidth: 1.8 }}>
      <path d="M12 3.6v16.8M4.73 7.8l14.54 8.4M4.73 16.2l14.54-8.4" />
      <path d="M12 7.2l2.2-1.3M12 7.2 9.8 5.9M12 16.8l2.2 1.3M12 16.8l-2.2 1.3" />
    </svg>
  );
}
