// 앱 기준 시간대의 "오늘". Vercel 서버는 UTC로 돌기 때문에 서버 로컬 날짜를 쓰면
// 미국 중부 저녁 6~7시에 날짜가 넘어가 버린다 (오늘 저녁 모임이 시작 전에 "지난 모임"이 되는 버그).
const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'America/Chicago';

/** 앱 시간대 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayLocal(): string {
  // en-CA 로케일은 YYYY-MM-DD 형식을 그대로 반환한다
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(new Date());
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 시각 하나를 앱 시간대의 'YYYY-MM-DDTHH:mm'으로 (datefmt의 entryLabel이 받는 모양).
 *
 * 시간대 변환은 서버에서 한 번만 한다 — 브라우저에 UTC를 그대로 넘기면
 * 다른 시간대에서 열었을 때 화면에 뜨는 시각이 사람마다 달라진다.
 */
export function localStamp(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  // en-CA + hour12:false는 자정을 '24'로 주는 환경이 있다
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}

/** 모임이 끝난 뒤 "지난 모임"으로 내려가기까지의 유예 (분) — 끝나자마자 접히면 후기 댓글을 달기 번거롭다 */
export const PAST_GRACE_MINUTES = 60;

/**
 * "지난 모임" 판정 기준 시각을 앱 시간대의 (날짜, 시각)으로 반환.
 * 현재 시각에서 유예만큼 뺀 값이라, 모임의 (date, endTime)이 이보다 크면 아직 예정이다.
 */
export function pastCutoff(): { date: string; time: string } {
  const at = new Date(Date.now() - PAST_GRACE_MINUTES * 60_000);
  return {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(at),
    // en-GB + hour12:false = 24시간제 HH:mm
    time: new Intl.DateTimeFormat('en-GB', {
      timeZone: APP_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(at),
  };
}

/**
 * 종료 시각을 안 적은 모임을 이만큼 뒤에 끝난 것으로 친다 (분).
 *
 * 시작 시각을 그대로 끝으로 보면 6시 저녁 모임이 7시에 지난 모임으로 내려간다 — 밥 먹는 중에.
 * 반대로 너무 길게 잡으면 끝난 모임이 며칠씩 예정 칸에 남는다. 세 시간이면 이 앱에서
 * 열리는 모임 대부분을 덮는다.
 */
export const OPEN_END_MINUTES = 180;

/**
 * 이 모임이 사실상 끝나는 시각.
 *
 * 종료 시각은 안 적어도 된다. 안 적었으면 시작 후 OPEN_END_MINUTES 뒤로 보되 23:59에서 묶는다 —
 * 시각을 문자열로 비교하기 때문에 자정을 넘겨 '00:30'이 되면 그날 가장 이른 시각이 되어
 * 만들자마자 지난 모임이 되어버린다.
 */
export function effectiveEnd(startTime: string, endTime?: string | null): string {
  if (endTime) return endTime;
  const mins = toMinutes(startTime) + OPEN_END_MINUTES;
  return mins >= 24 * 60 - 1 ? '23:59' : fromMinutes(mins);
}

/** 'HH:mm' ↔ 자정부터의 분 */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
function fromMinutes(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

/**
 * 종료 시각을 안 적은 모임이 "지난 모임"으로 넘어가는 시작 시각의 상한 (같은 날 안에서).
 * 시작 시각이 이 값 이하면 이미 끝난 것으로 본다. null이면 오늘 아직 아무것도 넘어가지 않았다.
 *
 * 행마다 끝 시각을 계산하는 대신 기준 시각을 당겨 두면, DB 질의도 문자열 비교 하나로 끝난다.
 */
export function openEndCutoffTime(): string | null {
  const cut = toMinutes(pastCutoff().time) - OPEN_END_MINUTES;
  return cut < 0 ? null : fromMinutes(cut);
}

/**
 * (날짜, 시각)이 이미 "지난 모임" 기준을 넘겼는지 — 목록 분류와 생성 검증이 같은 기준을 쓴다.
 *
 * 날짜가 없으면(모집 중) 절대 지나지 않는다. 언제 할지를 안 정했으니 끝났을 리도 없다 —
 * 날짜가 정해지는 순간부터 이 판정이 시작된다.
 */
export function isPastSlot(
  date: string | null,
  startTime: string | null,
  endTime?: string | null,
  /**
   * 마지막 날 (여행처럼 여러 날 이어지는 모임). null이면 하루짜리다.
   *
   * 이게 없으면 3박 4일 여행이 **출발 다음 날부터** 「지난 모임」이 된다 — 아직 가 있는데.
   * 그래서 끝났는지는 언제나 마지막 날로 본다.
   */
  endDate?: string | null
): boolean {
  if (!date) return false;
  const last = endDate && endDate > date ? endDate : date;
  const { date: cutDate, time: cutTime } = pastCutoff();
  if (last !== cutDate) return last < cutDate;
  /*
   * 마지막 날이 오늘이면 시각으로 가른다. 시각이 아예 없는 모임(여행)은 그날이 다
   * 지나야 끝난 것으로 본다 — 마지막 날 낮에 「지난 모임」으로 내려가면 그날 찍은
   * 사진을 올릴 자리가 사라진다.
   */
  if (!startTime) return false;
  if (endTime) return endTime <= cutTime;
  const openCut = openEndCutoffTime();
  return openCut !== null && startTime <= openCut;
}

// YYYY-MM-DD 문자열 연산은 UTC 기준으로 처리한다 (로컬 시간대가 끼면 날짜가 하루씩 밀린다)
function toUtc(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 요일 번호 (0=일 ~ 6=토) */
export function weekdayOf(date: string): number {
  return toUtc(date).getUTCDay();
}

/** n일 뒤 날짜 (음수면 이전) */
export function addDays(date: string, n: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fromUtc(d);
}

/** from 이후(당일 포함)로 처음 오는 해당 요일의 날짜 */
export function nextWeekdayOnOrAfter(from: string, weekday: number): string {
  return addDays(from, (weekday - weekdayOf(from) + 7) % 7);
}

/** 그 날짜가 속한 주의 일요일 */
export function weekStartOf(date: string): string {
  return addDays(date, -weekdayOf(date));
}

/** 그 달의 마지막 날 (다음 달 0일 = 이번 달 말일) */
export function monthEndOf(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return `${date.slice(0, 7)}-${String(new Date(Date.UTC(y!, m!, 0)).getUTCDate()).padStart(2, '0')}`;
}

/**
 * 달력 격자에 그릴 기간.
 *
 * 월 보기는 첫 주·마지막 주를 채우는 앞뒤 달 날짜까지 포함한다.
 * 서버(첫 화면을 미리 읽을 때)와 화면(달을 넘길 때)이 같은 답을 내야 해서 여기 둔다 —
 * 한 칸이라도 어긋나면 서버가 읽어 둔 것을 못 쓰고 다시 받아온다.
 */
export function calendarRange(view: 'week' | 'month', anchor: string): { from: string; to: string } {
  if (view === 'week') {
    const from = weekStartOf(anchor);
    return { from, to: addDays(from, 6) };
  }
  return { from: weekStartOf(`${anchor.slice(0, 7)}-01`), to: addDays(weekStartOf(monthEndOf(anchor)), 6) };
}

/**
 * 앱 시간대의 벽시계 시각(날짜 + 'HH:mm')이 가리키는 실제 순간.
 *
 * localStamp의 반대 방향이다. 시차를 -6시간으로 박아 두면 3월과 11월에 한 시간씩
 * 어긋나므로(서머타임), 그 순간의 시차를 재서 맞춘다 — 한 번 어림잡고 한 번 더 맞춘다.
 * (시계를 되돌리는 새벽 1~2시는 같은 벽시계 시각이 두 번 오는데, 그때는 앞의 것을 준다)
 */
export function instantAt(date: string, hhmm: string): Date {
  const wall = Date.parse(`${date}T${hhmm}:00Z`);
  let guess = wall;
  for (let i = 0; i < 2; i++) {
    guess = wall + (guess - Date.parse(`${localStamp(new Date(guess))}:00Z`));
  }
  return new Date(guess);
}
