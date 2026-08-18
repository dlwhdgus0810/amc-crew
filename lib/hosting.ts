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

/**
 * 참여 등급 — 얼마나 자주 나오나 (횟수).
 *
 * 문턱이 호스팅과 다르다. 호스팅 점수는 「연 모임의 참가 인원 합」이라 한 번에 열댓 점씩
 * 오르는데, 참여는 한 번 나가면 1이다. 지금 회원들이 7~15회 사이라 그 폭에 맞춰 잡았다 —
 * 호스팅의 5/15/30/60을 그대로 쓰면 아무도 두 번째 칸을 못 넘는다.
 */
export const JOIN_TIERS: HostTier[] = [
  { min: 3, sticker: '🌿', label: { ko: '얼굴 도장', en: 'Showing up', es: 'Se deja ver' } },
  { min: 8, sticker: '🤝', label: { ko: '단골', en: 'Regular', es: 'Habitual' } },
  { min: 15, sticker: '🎉', label: { ko: '개근', en: 'Never misses', es: 'No falla' } },
  { min: 25, sticker: '🏅', label: { ko: '붙박이', en: 'Always there', es: 'Siempre está' } },
];

/**
 * 기여 등급 — 사진·댓글·후기·승인된 제안으로 쌓은 점수 (lib/db/hosting.ts의 CONTRIB).
 *
 * 사진과 댓글이 모임당 5점·3점에서 막히므로 점수가 천천히 오른다. 지금 상위가 26점이라
 * 60점 칸은 한동안 아무도 못 닿는데, 그건 그대로 둔다 — 닿을 자리가 남아 있는 것이
 * 등급표의 쓸모다.
 */
export const CONTRIB_TIERS: HostTier[] = [
  { min: 5, sticker: '📷', label: { ko: '기록 시작', en: 'Started keeping', es: 'Empieza a registrar' } },
  { min: 15, sticker: '✍️', label: { ko: '부지런한 손', en: 'Busy hands', es: 'Manos ocupadas' } },
  { min: 30, sticker: '📚', label: { ko: '기록 담당', en: 'Keeper of records', es: 'Encargado del archivo' } },
  { min: 60, sticker: '🏆', label: { ko: '기록 대장', en: 'Chief archivist', es: 'Jefe del archivo' } },
];

/** 점수 → 등급 (첫 칸에 못 미치면 null). 세 순위표가 같은 함수를 쓴다 */
export function tierOf(tiers: HostTier[], count: number): HostTier | null {
  let tier: HostTier | null = null;
  for (const t of tiers) {
    if (count >= t.min) tier = t;
  }
  return tier;
}

/** 주최 점수 → 등급 (첫 칸에 못 미치면 null) */
export function hostTier(count: number): HostTier | null {
  return tierOf(HOST_TIERS, count);
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
