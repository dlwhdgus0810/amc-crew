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
  { min: 5, sticker: '🌱', label: { ko: '새싹 호스트', en: 'Sprout host', es: 'Anfitrión brote' } },
  { min: 15, sticker: '⭐', label: { ko: '단골 호스트', en: 'Regular host', es: 'Anfitrión habitual' } },
  { min: 30, sticker: '🔥', label: { ko: '열정 호스트', en: 'Fired-up host', es: 'Anfitrión en racha' } },
  { min: 60, sticker: '👑', label: { ko: '전설의 호스트', en: 'Legendary host', es: 'Anfitrión legendario' } },
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

/**
 * 공동 순위.
 *
 * 점수가 같으면 같은 등수를 주고, 다음 등수는 앞사람 수만큼 건너뛴다.
 * 8, 8, 6, 6, 5 → 1, 1, 3, 3, 5 — 8점 둘이 1등이므로 6점은 2등이 아니라 3등이고,
 * 그 둘 뒤의 5점은 5등이다. 은메달을 받는 사람이 아무도 없는 경우가 생기는데, 그게 맞다.
 *
 * 내림차순으로 정렬된 목록을 전제한다 (주최·참가 랭킹 둘 다 그렇게 온다).
 */
export function ranksOf(counts: number[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < counts.length; i++) {
    out.push(i > 0 && counts[i] === counts[i - 1] ? out[i - 1]! : i + 1);
  }
  return out;
}
