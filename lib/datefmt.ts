// 모임 날짜·시간 표기. 화면과 알림 문구가 같은 포맷을 쓰도록 한곳에 모아둔다.
// YYYY-MM-DD / HH:mm 문자열만 다루므로 시간대 변환은 하지 않는다 (UTC 기준으로 파싱해 날짜 밀림 방지).

import { Locale } from './i18n';

const WEEKDAYS: Record<Locale, string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
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

/** ko: 7/25(토) · en: Sat Jul 25 — 알림 한 줄에 들어가는 짧은 형태 */
export function dateLabelShort(date: string, locale: Locale): string {
  const { m, d, weekday } = parts(date);
  return locale === 'en'
    ? `${WEEKDAYS.en[weekday]} ${MONTHS_EN[m - 1]} ${d}`
    : `${m}/${d}(${WEEKDAYS.ko[weekday]})`;
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
