'use client';

import { createContext, useContext } from 'react';
import { DEFAULT_REGION, REGIONS, type Region, type RegionConfig } from '@/lib/region';

/**
 * 지금 지역을 클라이언트 트리에 내려준다 — 언어(app/i18n.tsx)와 같은 꼴.
 *
 * location.hostname으로 알아내지 않는 이유: 서버가 그린 첫 화면과 맞아야 하고(하이드레이션),
 * localhost·미리보기에선 호스트로는 지역을 알 수 없다. 서버가 정한 값을 그대로 받는다.
 *
 * amcName은 서버만 아는 값(env)이라 같이 실어 보낸다 — 무비나잇의 AMC 도구가 극장 이름을
 * 적고, 없으면 도구 자체를 안 그린다.
 */
interface RegionCtx {
  region: Region;
  amcName: string | null;
}

const Ctx = createContext<RegionCtx>({ region: DEFAULT_REGION, amcName: null });

export function RegionProvider({ value, children }: { value: RegionCtx; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRegion(): Region {
  return useContext(Ctx).region;
}

export function useRegionConfig(): RegionConfig {
  return REGIONS[useContext(Ctx).region];
}

/** 이 지역의 AMC 극장 이름 — 없으면 null (그 지역엔 아직 극장을 안 정했다) */
export function useAmcName(): string | null {
  return useContext(Ctx).amcName;
}
