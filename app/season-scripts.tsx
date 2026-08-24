'use client';

import { useEffect } from 'react';

/**
 * 시즌 캔버스 스크립트를 **테마를 바꾼 그 자리에서** 붙인다.
 *
 * layout.tsx가 <head>에 <script defer>로도 내려 준다. 그것만으로 되는 것은 **문서를
 * 새로 열 때**뿐이다 — 프로필이나 관리자 화면에서 테마를 고르면 쿠키를 쓰고
 * router.refresh()를 부르는데, 그때 서버가 새로 내려 준 <script>는 React가 head에
 * 꽂아 주기는 해도 **브라우저가 받지도 실행하지도 않는다**. 재 봤다: 태그는 head에
 * 있는데 performance의 resource 목록에는 그 주소가 없고, customElements.get도
 * undefined였다. 그래서 색·서체·카드 모양은 바로 바뀌는데 비와 눈만 안 왔다.
 *
 * 여기서 만드는 <script>는 DOM이 만든 것이라 그냥 실행된다.
 *
 * 문서를 새로 열 때는 head의 defer 스크립트가 이미 다 돌아 있다(defer는
 * DOMContentLoaded 전에 끝나고 이 effect는 그 뒤에 돈다). 그때는 customElements가
 * 이미 있으니 여기서 아무것도 안 한다 — 첫 화면이 느려지지 않는다.
 */
const SRC = {
  rain: [
    ['rain-canvas', '/rain-canvas.js'],
    ['rain-field', '/rain-field.js'],
  ],
  snow: [
    ['snow-canvas', '/snow-canvas.js'],
    ['snow-field', '/snow-field.js'],
  ],
} as const;

export default function SeasonScripts({ kind }: { kind: 'rain' | 'snow' | null }) {
  useEffect(() => {
    if (!kind) return;
    for (const [tag, src] of SRC[kind]) {
      /*
       * 이미 정의돼 있으면 끝이다. 두 파일 다 스스로도 다시 정의하지 않게 막아 두었지만
       * (customElements.get 확인), 받아 오는 것부터 안 하는 편이 낫다.
       */
      if (customElements.get(tag)) continue;
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      document.head.appendChild(s);
    }
  }, [kind]);
  return null;
}
