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
  /** 배지 그림의 이름 — app/tier-icon.tsx의 PATHS 키다 (이모지가 아니다) */
  icon: string;
  label: Msg;
  /** 배지 바탕색. 칸 번호로 정해지므로 손으로 적지 않는다 — ladder()가 채운다 */
  color: string;
}

/**
 * 등급 색 — **칸 번호로 정한다.** 첫 칸은 초록, 마지막 칸은 호박색.
 *
 * 세 순위표가 같은 사다리를 쓴다. 주최 3칸과 참여 3칸이 같은 색이면 「어느 표에서든
 * 세 번째까지 왔다」가 색 하나로 읽히고, 표마다 색을 따로 두면 그 뜻이 사라진다.
 * 그림이 하는 말(무엇으로 올랐나)과 색이 하는 말(얼마나 올랐나)이 서로 안 겹친다.
 *
 * 넷 다 크림(#F6F4EE) 대비 4.6:1을 넘게 잡았다. 배지 안의 그림이 크림색 얇은 선이고,
 * 등급표에서는 이 원이 크림 카드 위에 놓인다 — 한 색으로 두 대비를 다 감당해야 한다.
 * 그래서 최고 등급이 금색이 아니다. 진짜 금색(#E6AD00)은 크림 대비가 1.85:1이라
 * 카드 위에서 원이 사라진다. 밝기를 포기하는 대신 색조를 초록→파랑→보라→호박으로
 * 돌려서 「올라간다」를 만들었다.
 */
export const TIER_COLORS = ['#018039', '#0472BD', '#815ABC', '#AC5701'];

/** 등급표에 색을 입힌다 — 칸 번호가 곧 색이라 손으로 적을 것이 없다 */
function ladder(specs: Omit<HostTier, 'color'>[]): HostTier[] {
  return specs.map((s, i) => ({ ...s, color: TIER_COLORS[i] ?? TIER_COLORS[TIER_COLORS.length - 1]! }));
}

/** 낮은 등급부터 — hostTier()가 뒤에서부터 찾는다 */
export const HOST_TIERS: HostTier[] = ladder([
  { min: 5, icon: 'sprout', label: { ko: '새싹 호스트', en: 'Sprout host', es: 'Anfitrión brote' } },
  { min: 15, icon: 'star', label: { ko: '단골 호스트', en: 'Regular host', es: 'Anfitrión habitual' } },
  { min: 30, icon: 'flame', label: { ko: '열정 호스트', en: 'Fired-up host', es: 'Anfitrión en racha' } },
  { min: 60, icon: 'crown', label: { ko: '전설의 호스트', en: 'Legendary host', es: 'Anfitrión legendario' } },
]);

/**
 * 참여 등급 — 얼마나 자주 나오나 (횟수).
 *
 * 문턱이 호스팅과 다르다. 호스팅 점수는 「연 모임의 참가 인원 합」이라 한 번에 열댓 점씩
 * 오르는데, 참여는 한 번 나가면 1이다.
 *
 * 문턱을 정하는 기준은 **순위표에 보이는 열 명이 갈리는가**다. 3/8/15로 뒀을 때 상위
 * 열 명 중 여덟이 같은 「단골」이었다 — 다 같은 스티커를 달면 등급표가 아무 말도 안 한다.
 * 5/12로 올리니 여섯 대 넷으로 갈린다.
 *
 * 위 두 칸(20·30)은 지금 아무도 못 닿는다. 그건 그대로 둔다 — 닿을 자리가 남아 있는 것이
 * 등급표의 쓸모다. (재 본 분포: 38명, 최고 15회, 중앙 4회)
 */
export const JOIN_TIERS: HostTier[] = ladder([
  { min: 5, icon: 'stamp', label: { ko: '얼굴 도장', en: 'Showing up', es: 'Se deja ver' } },
  { min: 12, icon: 'again', label: { ko: '단골', en: 'Regular', es: 'Habitual' } },
  { min: 20, icon: 'calendarCheck', label: { ko: '개근', en: 'Never misses', es: 'No falla' } },
  { min: 30, icon: 'anchor', label: { ko: '붙박이', en: 'Always there', es: 'Siempre está' } },
]);

/**
 * 기여 등급 — 사진·댓글·후기·승인된 제안으로 쌓은 점수 (lib/db/hosting.ts의 CONTRIB).
 *
 * 참여와 같은 기준으로 잡았다. 5/15로 뒀을 때 점수가 있는 열넷 중 여섯이 한꺼번에
 * 「부지런한 손」이었다. 10/20으로 올리니 네 명과 세 명으로 갈린다.
 *
 * 사진과 댓글이 모임당 5점·3점에서 막히므로 점수가 천천히 오른다 — 그래서 위 두 칸이
 * 비어 있는 것이 오래갈 텐데, 그게 목표로 쓸모가 있다.
 * (재 본 분포: 점수가 있는 사람 14명, 최고 26점)
 */
export const CONTRIB_TIERS: HostTier[] = ladder([
  { min: 10, icon: 'camera', label: { ko: '기록 시작', en: 'Started keeping', es: 'Empieza a registrar' } },
  { min: 20, icon: 'pen', label: { ko: '부지런한 손', en: 'Busy hands', es: 'Manos ocupadas' } },
  { min: 35, icon: 'photos', label: { ko: '기록 담당', en: 'Keeper of records', es: 'Encargado del archivo' } },
  { min: 60, icon: 'trophy', label: { ko: '기록 대장', en: 'Chief archivist', es: 'Jefe del archivo' } },
]);

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

/**
 * 순위표 세 장의 이름 — 등급 알림이 「무엇으로 올랐는지」 말하려면 이 이름이 필요하다.
 *
 * 등급표(HOST/JOIN/CONTRIB_TIERS)는 각자 따로 있었고 화면도 탭마다 골라 썼는데,
 * 알림을 보내는 쪽은 세 장을 한 번에 훑는다. 여기 모아 두지 않으면 그 쪽에 if 세 개가
 * 생기고, 표를 하나 더 만드는 날 그 세 개를 다 찾아 고쳐야 한다.
 */
export const BOARDS = ['host', 'join', 'contrib'] as const;
export type Board = (typeof BOARDS)[number];

export const BOARD_TIERS: Record<Board, HostTier[]> = {
  host: HOST_TIERS,
  join: JOIN_TIERS,
  contrib: CONTRIB_TIERS,
};

/** 순위표 이름 — 알림 문구에 들어간다 (화면의 탭 이름과 같은 말로 맞춰 뒀다) */
export const BOARD_LABEL: Record<Board, Msg> = {
  host: { ko: '주최', en: 'Hosting', es: 'Anfitrión' },
  join: { ko: '참여', en: 'Attendance', es: 'Asistencia' },
  contrib: { ko: '기여도', en: 'Contribution', es: 'Contribución' },
};
