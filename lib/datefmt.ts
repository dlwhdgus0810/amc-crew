// 모임 날짜·시간 표기. 화면과 알림 문구가 같은 포맷을 쓰도록 한곳에 모아둔다.
// YYYY-MM-DD / HH:mm 문자열만 다루므로 시간대 변환은 하지 않는다 (UTC 기준으로 파싱해 날짜 밀림 방지).

import { Locale, pick } from './i18n';

const WEEKDAYS: Record<Locale, string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

/** 피드의 날짜 헤더처럼 한 줄을 온전히 쓰는 자리 — "토요일" */
const WEEKDAYS_LONG: Record<Locale, string[]> = {
  ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function parts(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d, weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** 요일 한 글자/세 글자 (예: 토 / Sat) */
export function weekdayLabel(date: string, locale: Locale): string {
  return WEEKDAYS[locale][parts(date).weekday];
}

/** ko: 7/25 (토) · en: Sat, Jul 25 */
export function dateLabel(date: string, locale: Locale): string {
  const { m, d, weekday } = parts(date);
  return locale === 'en'
    ? `${WEEKDAYS.en[weekday]}, ${MONTHS_EN[m - 1]} ${d}`
    : `${m}/${d} (${WEEKDAYS.ko[weekday]})`;
}

/**
 * 피드의 날짜 헤더 — ko: 8월 2일 토요일 · en: Saturday, Aug 2
 * 괄호 안에 한 글자만 든 「8월 2일 (토)」가 만드는 빈 리듬을 없앤다.
 * (알림·짧은 줄에는 위의 dateLabel / dateLabelShort를 그대로 쓴다)
 */
export function dateLabelLong(date: string, locale: Locale): string {
  const { m, d, weekday } = parts(date);
  return locale === 'en'
    ? `${WEEKDAYS_LONG.en[weekday]}, ${MONTHS_EN[m - 1]} ${d}`
    : `${m}월 ${d}일 ${WEEKDAYS_LONG.ko[weekday]}`;
}

/** ko: 7/25(토) · en: Sat Jul 25 — 알림 한 줄에 들어가는 짧은 형태 */
export function dateLabelShort(date: string, locale: Locale): string {
  const { m, d, weekday } = parts(date);
  return locale === 'en'
    ? `${WEEKDAYS.en[weekday]} ${MONTHS_EN[m - 1]} ${d}`
    : `${m}/${d}(${WEEKDAYS.ko[weekday]})`;
}

/** YYYY-MM-DDTHH:mm → "7/29 (수) 오후 4:40" / "Wed, Jul 29 · 4:40 PM" */
export function entryLabel(at: string, locale: Locale): string {
  const [date, time] = at.split('T');
  if (!time) return dateLabel(date, locale);
  return locale === 'en'
    ? `${dateLabel(date, locale)} · ${timeLabel(time, locale)}`
    : `${dateLabel(date, locale)} ${timeLabel(time, locale)}`;
}

/** ko: 오후 6:00 · en: 6:00 PM */
export function timeLabel(time: string, locale: Locale): string {
  const [h, min] = time.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(min).padStart(2, '0');
  return locale === 'en'
    ? `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
    : `${h < 12 ? '오전' : '오후'} ${h12}:${mm}`;
}

/** "얼마나 지났나" 한 마디 — 알림함과 정산 다시 알리기가 같이 쓴다 */
const AGO = {
  justNow: { ko: '방금', en: 'just now' },
  minutesAgo: { ko: '{n}분 전', en: '{n}m ago' },
  hoursAgo: { ko: '{n}시간 전', en: '{n}h ago' },
  daysAgo: { ko: '{n}일 전', en: '{n}d ago' },
};

export function timeAgo(iso: string, locale: Locale): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return pick(locale, AGO.justNow);
  if (min < 60) return pick(locale, AGO.minutesAgo, { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return pick(locale, AGO.hoursAgo, { n: hours });
  return pick(locale, AGO.daysAgo, { n: Math.floor(hours / 24) });
}
