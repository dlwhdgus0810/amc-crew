'use client';

import { createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';
import type { Viewer } from '@/lib/session';

/**
 * 로그인한 사람의 정보를 화면 전체가 나눠 쓰는 곳.
 *
 * 값은 레이아웃이 서버에서 한 번 읽어 넣는다. 그래서 여기 있는 건 늘 그 페이지를
 * 그릴 때의 값이다 — 다시 받아올 일이 있으면 useRefreshSession()으로 서버 렌더를
 * 다시 돌린다(fetch를 새로 짜지 않는다).
 *
 * ⚠️ 대리 보기(관리자 → 테스트 계정)를 켜고 끄는 두 곳은 반드시 하드 내비게이션이어야
 * 한다 — app/admin/page.tsx와 app/viewing-as.tsx 둘 다 window.location.href를 쓴다.
 * router.push로 바꾸면 레이아웃이 다시 안 그려져서 여기 값이 옛 사람으로 남는다.
 */
const Ctx = createContext<Viewer | null>(null);

export function SessionProvider({ value, children }: { value: Viewer; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useViewer(): Viewer {
  const v = useContext(Ctx);
  if (!v) throw new Error('useViewer는 SessionProvider 안에서만 쓸 수 있어요 (app/layout.tsx)');
  return v;
}

/** 프로필을 고친 뒤처럼, 서버가 읽은 값을 다시 받아와야 할 때 */
export function useRefreshSession(): () => void {
  const router = useRouter();
  return () => router.refresh();
}
