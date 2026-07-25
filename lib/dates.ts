// 앱 기준 시간대의 "오늘". Vercel 서버는 UTC로 돌기 때문에 서버 로컬 날짜를 쓰면
// 미국 중부 저녁 6~7시에 날짜가 넘어가 버린다 (오늘 저녁 모임이 시작 전에 "지난 모임"이 되는 버그).
const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'America/Chicago';

/** 앱 시간대 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayLocal(): string {
  // en-CA 로케일은 YYYY-MM-DD 형식을 그대로 반환한다
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(new Date());
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

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
