/**
 * 사진을 찍은 순서로 묶는다 — 날짜, 그리고 그날 **멈춘 자리**로.
 *
 * 여행 사진 열한 장을 격자에 늘어놓으면 그냥 사진 열한 장이다. 같은 열한 장이라도
 * 「금요일 저녁 여기, 밤에 저기, 토요일 낮 저기, 일요일 밤 돌아오는 길」로 묶이면 그게
 * 여행이 된다. 우리가 새로 만드는 정보는 없다 — 사진에 이미 들어 있던 것(lib/exif.ts)을
 * 늘어놓기만 한다.
 *
 * 시간대를 다루는 방식이 특이하니 먼저 읽어야 한다: takenAt은 찍은 순간이고 offset은
 * 그 자리의 UTC 오프셋이다. **날짜와 시각은 언제나 offset을 더한 뒤 UTC로 읽는다** —
 * 그래야 보는 사람이 어디에 있든 「토요일 오후 7시」가 그때 거기서의 7시가 된다.
 * 서버와 브라우저가 같은 답을 내야 해서(하이드레이션) 기기의 시간대는 절대 안 쓴다.
 */

/** 칸이 다 선택인 이유: 화면 쪽 PhotoItem은 여행이 아닌 카테고리에서 이 값을 아예 안 받는다 */
export interface TimelineInput {
  takenAt?: string | null;
  takenOffset?: number | null;
  lat?: number | null;
  lon?: number | null;
}

/** 한 번 멈춘 자리 — 사진 몇 장이 비슷한 때 비슷한 곳에서 찍혔다 */
export interface Stop<T> {
  /** 'HH:MM' — 그 자리의 첫 사진 */
  time: string;
  /** 'HH:MM' — 마지막 사진. 한 장뿐이면 time과 같다 */
  endTime: string;
  /** 가운데쯤의 좌표. 좌표가 하나도 없는 자리면 null */
  lat: number | null;
  lon: number | null;
  photos: T[];
}

export interface TimelineDay<T> {
  /** 'YYYY-MM-DD' — 찍은 자리 기준의 그 날짜 (lib/datefmt.ts의 dateLabelShort에 그대로 넘긴다) */
  date: string;
  stops: Stop<T>[];
}

export interface Timeline<T> {
  days: TimelineDay<T>[];
  /** 찍은 시각을 모르는 사진 — 스크린샷, 옛날에 올린 것, 원본이 없는 것 */
  undated: T[];
}

/**
 * 한 자리로 볼 시간 간격.
 *
 * 한 시간이면 「저녁 먹다가 찍은 것들」은 한 덩어리로 남고 「밥 먹고 다른 데로 옮긴 것」은
 * 갈라진다. 더 짧게 잡으면 한 자리에서 띄엄띄엄 찍은 사진이 여러 줄로 쪼개져, 늘어놓은
 * 뜻이 없어진다.
 */
const SAME_STOP_MINUTES = 60;

/**
 * 한 자리로 볼 거리(m).
 *
 * GPS 자체가 실내에서 100m씩 튄다. 300m면 그 흔들림은 삼키고 「길 건너 다른 가게」는
 * 가른다. 실제 여행 사진에서 같은 집 마당의 네 장이 21~190m 안에 들어왔다.
 */
const SAME_STOP_METERS = 300;

export function buildTimeline<T extends TimelineInput>(photos: T[]): Timeline<T> {
  const dated: { p: T; at: number; local: Date }[] = [];
  const undated: T[] = [];
  for (const p of photos) {
    const ms = p.takenAt ? Date.parse(p.takenAt) : NaN;
    if (Number.isNaN(ms)) undated.push(p);
    else dated.push({ p, at: ms, local: new Date(ms + (p.takenOffset ?? 0) * 60_000) });
  }
  dated.sort((a, b) => a.at - b.at);

  /*
   * 먼저 줄만 나눈다. 자리마다 Stop을 그때그때 만들면, 뒤에 붙는 사진이 이미 만들어 둔
   * Stop에 반영되지 않는다 — 다 나눈 뒤에 한 번에 만든다.
   */
  type Row = (typeof dated)[number];
  const groups: { date: string; rows: Row[] }[] = [];
  for (const row of dated) {
    const date = ymd(row.local);
    const last = groups[groups.length - 1];
    const prev = last?.rows[last.rows.length - 1];
    const sameStop =
      prev != null &&
      last!.date === date &&
      row.at - prev.at <= SAME_STOP_MINUTES * 60_000 &&
      near(prev.p, row.p);
    if (sameStop) last!.rows.push(row);
    else groups.push({ date, rows: [row] });
  }

  const days: TimelineDay<T>[] = [];
  for (const g of groups) {
    const day = days[days.length - 1]?.date === g.date ? days[days.length - 1]! : null;
    if (day) day.stops.push(toStop(g.rows));
    else days.push({ date: g.date, stops: [toStop(g.rows)] });
  }
  return { days, undated };
}

/** 좌표가 둘 다 있을 때만 거리를 본다. 하나라도 없으면 시간만으로 판단한다 */
function near(a: TimelineInput, b: TimelineInput): boolean {
  if (a.lat == null || a.lon == null || b.lat == null || b.lon == null) return true;
  return distanceMeters(a.lat, a.lon, b.lat, b.lon) <= SAME_STOP_METERS;
}

function toStop<T extends TimelineInput>(rows: { p: T; local: Date }[]): Stop<T> {
  const withGps = rows.filter((r) => r.p.lat != null && r.p.lon != null);
  /*
   * 자리를 대표하는 좌표는 가운데 것을 쓴다 — 평균이 아니라. 평균은 아무도 서 있지
   * 않은 지점을 만들 수 있고(길 하나를 사이에 둔 두 무리), 가운데 것은 실제로 찍은 자리다.
   */
  const mid = withGps[Math.floor(withGps.length / 2)]?.p;
  return {
    time: hhmm(rows[0]!.local),
    endTime: hhmm(rows[rows.length - 1]!.local),
    lat: mid?.lat ?? null,
    lon: mid?.lon ?? null,
    photos: rows.map((r) => r.p),
  };
}

/** offset을 이미 더해 둔 Date를 UTC로 읽는다 — 기기의 시간대를 안 탄다 */
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const hhmm = (d: Date) => d.toISOString().slice(11, 16);

const R = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** 하버사인. 몇백 미터를 재는 데는 넘치지만 짧고 어디서나 맞는다 */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
