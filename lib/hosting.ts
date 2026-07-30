import { Msg } from './i18n';

/**
 * 모임 주최 등급 — 많이 열수록 아바타에 붙는 스티커가 자란다.
 *
 * 집계는 공개 모임만 센다 (lib/db/hosting.ts). 비공개(link) 모임을 공개 랭킹에
 * 세면 "무언가 열었다"는 사실 자체가 새기 때문이다.
 */
export interface HostTier {
  /** 이 횟수부터 이 등급 */
  min: number;
  sticker: string;
  label: Msg;
}

/** 낮은 등급부터 — hostTier()가 뒤에서부터 찾는다 */
export const HOST_TIERS: HostTier[] = [
  { min: 1, sticker: '🌱', label: { ko: '새싹 호스트', en: 'Sprout host' } },
  { min: 3, sticker: '⭐', label: { ko: '단골 호스트', en: 'Regular host' } },
  { min: 5, sticker: '🔥', label: { ko: '열정 호스트', en: 'Fired-up host' } },
  { min: 10, sticker: '👑', label: { ko: '전설의 호스트', en: 'Legendary host' } },
];

/** 주최 횟수 → 등급 (0회면 null) */
export function hostTier(count: number): HostTier | null {
  let tier: HostTier | null = null;
  for (const t of HOST_TIERS) {
    if (count >= t.min) tier = t;
  }
  return tier;
}
