// 앱 기준 시간대의 "오늘". Vercel 서버는 UTC로 돌기 때문에 서버 로컬 날짜를 쓰면
// 미국 중부 저녁 6~7시에 날짜가 넘어가 버린다 (오늘 저녁 모임이 시작 전에 "지난 모임"이 되는 버그).
const APP_TIMEZONE = process.env.APP_TIMEZONE ?? 'America/Chicago';

/** 앱 시간대 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayLocal(): string {
  // en-CA 로케일은 YYYY-MM-DD 형식을 그대로 반환한다
  return new Intl.DateTimeFormat('en-CA', { timeZone: APP_TIMEZONE }).format(new Date());
}
