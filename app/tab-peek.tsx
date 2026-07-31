'use client';

import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { PeekProvider } from './tab-peek-context';

/**
 * 옆 탭의 첫 화면을 실제로 그려두는 층.
 *
 * 다섯 탭을 처음부터 다 띄우면 착지가 눈에 띄게 느려져서(다 합쳐 1초가 넘는다),
 * 지금 탭이 자리를 잡은 뒤에 양옆 하나씩만 올린다. 화면 밖에 있는 동안에도
 * 자기 데이터를 스스로 불러오므로, 손가락을 따라 들어올 때 이미 채워져 있다.
 *
 * 화면 코드는 하나도 고치지 않는다 — 같은 컴포넌트를 그대로 쓴다.
 * 다만 "보고 있는 화면"이 아니라는 것만 PeekProvider로 알려준다.
 */

/* 필요해질 때 내려받는다 — 안 미는 사람의 첫 화면까지 무거워지면 안 된다 */
const LAZY: Record<string, ComponentType<{ today: string }>> = {
  '/': dynamic(() => import('./page'), { ssr: false }),
  '/categories': dynamic(() => import('./categories/page'), { ssr: false }),
  '/calendar': dynamic(() => import('./calendar/calendar-client'), { ssr: false }),
  '/notifications': dynamic(() => import('./notifications/page'), { ssr: false }),
  '/profile': dynamic(() => import('./profile/page'), { ssr: false }),
};

export default function TabPeek({ href, today }: { href: string; today: string }) {
  const Page = LAZY[href];
  if (!Page) return null;
  return (
    <PeekProvider value={true}>
      {/* today는 캘린더만 쓴다 — 나머지는 받고 버린다 */}
      <Page today={today} />
    </PeekProvider>
  );
}
