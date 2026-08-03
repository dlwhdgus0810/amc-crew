import { Msg } from './i18n';

/**
 * 모임 주최 등급 — 많이 모을수록 아바타에 붙는 스티커가 자란다.
 *
 * 점수는 연 모임의 참가 인원이다 (lib/db/hosting.ts). 같이 연 사람이 있으면 나눠 갖는다.
 * 집계는 공개 모임만 센다 — 비공개(link) 모임을 공개 랭킹에 세면
 * "무언가 열었다"는 사실 자체가 새기 때문이다.
 */
export interface HostTier {
  /** 이 점수부터 이 등급 */
  min: number;
  sticker: string;
  label: Msg;
}

/** 낮은 등급부터 — hostTier()가 뒤에서부터 찾는다 */
export const HOST_TIERS: HostTier[] = [
  { min: 5, sticker: '🌱', label: { ko: '새싹 호스트', en: 'Sprout host' } },
  { min: 15, sticker: '⭐', label: { ko: '단골 호스트', en: 'Regular host' } },
  { min: 30, sticker: '🔥', label: { ko: '열정 호스트', en: 'Fired-up host' } },
  { min: 60, sticker: '👑', label: { ko: '전설의 호스트', en: 'Legendary host' } },
];

/** 주최 점수 → 등급 (첫 칸에 못 미치면 null) */
export function hostTier(count: number): HostTier | null {
  let tier: HostTier | null = null;
  for (const t of HOST_TIERS) {
    if (count >= t.min) tier = t;
  }
  return tier;
}

/**
 * 점수 표기 — 호스트가 둘인 모임에서만 .5가 나오므로 소수점은 한 자리면 충분하다.
 * 정수일 때 「5.0점」이라고 쓰면 실제보다 정밀해 보인다.
 */
export function formatPoints(points: number): string {
  return Number.isInteger(points) ? String(points) : points.toFixed(1);
}
