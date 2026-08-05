'use client';

import { useEffect, useState } from 'react';

/**
 * 「3분 전」같은 상대 시각을 서버에서도 그리면서 하이드레이션이 안 어긋나게 하는 장치.
 *
 * 문제: 상대 시각은 지금 몇 시인지에 따라 달라진다. 서버가 HTML을 만든 순간과 브라우저가
 * 그 HTML을 이어받는 순간 사이에 분이 한 번 넘어가면 「30분」과 「31분」이 되고, React는
 * 그걸 어긋남으로 보고 오류를 낸다. 둘 다 그 시점에는 맞는 값인데도 그렇다.
 *
 * 그래서 두 가지를 같이 한다.
 *  1) 값을 그리는 자리에 suppressHydrationWarning을 붙인다 — 다를 수 있다고 미리 알리는 것.
 *     React는 첫 렌더에서 서버가 적어 보낸 값을 그대로 둔다.
 *  2) 마운트한 뒤 이 훅이 now를 채워 한 번 다시 그린다 — 그때 브라우저 시계 기준으로 맞는
 *     값이 된다. 페이지가 캐시에 한참 앉아 있다 열려서 서버 값이 낡았을 때도 이때 바로잡힌다.
 *
 * 「마운트 전에는 안 그리기」로 하면 오류는 사라지지만 자리가 비었다가 채워지며 화면이 밀리고,
 * 서버 HTML에서 시각이 통째로 빠진다. 그래서 그리되 고쳐 그리는 쪽을 택했다.
 */
export function useNow(): number | null {
  // null = 아직 마운트 전 (서버 렌더와 하이드레이션 첫 판)
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return now;
}
