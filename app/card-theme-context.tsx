'use client';

/**
 * 지금 켜진 카드 테마를 화면 쪽에 흘려 준다.
 *
 * 색은 CSS 변수로 내려가서(lib/card-theme.ts의 cardThemeCss) 컴포넌트가 테마를 알
 * 필요가 없었다. **글자는 그게 안 된다** — CSS로는 문구를 바꿀 수 없어서, 시즌 문구를
 * 쓰는 카드가 지금 무슨 테마인지를 알아야 한다.
 *
 * prop으로 내리지 않는 이유는 자리 수다. 카테고리 카드를 그리는 곳이 홈·둘러보기·
 * 정렬용 래퍼로 나뉘어 있어서, 하나만 빠뜨려도 그 화면만 문구가 안 바뀐다.
 * I18nProvider·SessionProvider와 같은 모양으로 둔다.
 */

import { createContext, useContext } from 'react';
import type { CardTheme } from '@/lib/card-theme';

const Ctx = createContext<CardTheme>('default');

export function CardThemeProvider({ value, children }: { value: CardTheme; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useCardTheme = () => useContext(Ctx);
