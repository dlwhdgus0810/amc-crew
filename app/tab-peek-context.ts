'use client';

import { createContext, useContext } from 'react';

/**
 * 지금 그려지는 화면이 "미리보기"인지 알려준다.
 *
 * 탭을 넘기는 동안 옆 탭을 실제로 띄워 손가락을 따라오게 하는데(app/tab-peek.tsx),
 * 그 화면은 사람이 보고 있는 탭이 아니다. 읽음 처리나 스크롤 위치 저장처럼
 * "이 화면을 봤다"를 전제로 하는 일은 미리보기에서 하면 안 된다 —
 * 넘기다 말았는데 알림이 읽음으로 바뀌거나, 다른 탭의 스크롤 위치가 덮인다.
 */
const PeekContext = createContext(false);

export const PeekProvider = PeekContext.Provider;

/** 이 컴포넌트가 미리보기 층에서 그려지는 중인지 */
export function useIsPeek(): boolean {
  return useContext(PeekContext);
}
