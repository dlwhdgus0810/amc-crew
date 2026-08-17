// 모임 날짜·시간 표기. 화면과 알림 문구가 같은 포맷을 쓰도록 한곳에 모아둔다.
// YYYY-MM-DD / HH:mm 문자열만 다루므로 시간대 변환은 하지 않는다 (UTC 기준으로 파싱해 날짜 밀림 방지).

import { Locale, Msg, pick } from './i18n';

const WEEKDAYS: Record<Locale, string[]> = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  es: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
};

/** 피드의 날짜 헤더처럼 한 줄을 온전히 쓰는 자리 — "토요일" */
const WEEKDAYS_LONG: Record<Locale, string[]> = {
  ko: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
};

const MONTHS: Record<Locale, string[]> = {
  // 한국어는 「8월 2일」처럼 숫자로 적으므로 이 표를 쓰지 않는다 (자리만 채운다)
  ko: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
};

/*
 * 날짜 모양은 두 갈래다 — 한국어는 「8/2 (토)」, 나머지는 「Sat, Aug 2」.
 * 스페인어는 영어와 같은 차례를 쓰고 이름만 바뀐다(「sáb, 2 ago」는 더 자연스럽지만
 * 카드·알림에서 폭이 들쭉날쭉해져서 한 모양으로 맞춘다).
 */
const isKo = (locale: Locale) => locale === 'ko';

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
  return isKo(locale)
    ? `${m}/${d} (${WEEKDAYS.ko[weekday]})`
    : `${WEEKDAYS[locale][weekday]}, ${MONTHS[locale][m - 1]} ${d}`;
}

/**
 * 피드의 날짜 헤더 — ko: 8월 2일 토요일 · en: Saturday, Aug 2
 * 괄호 안에 한 글자만 든 「8월 2일 (토)」가 만드는 빈 리듬을 없앤다.
 * (알림·짧은 줄에는 위의 dateLabel / dateLabelShort를 그대로 쓴다)
 */
export function dateLabelLong(date: string, locale: Locale): string {
  const { m, d, weekday } = parts(date);
  return isKo(locale)
    ? `${m}월 ${d}일 ${WEEKDAYS_LONG.ko[weekday]}`
    : `${WEEKDAYS_LONG[locale][weekday]}, ${MONTHS[locale][m - 1]} ${d}`;
}

/**
 * 날짜가 아직 없는 모임 — 사람부터 모으는 중이라는 뜻이다 (posts.date IS NULL).
 * 화면과 알림이 같은 말을 쓰도록 여기 한 번만 적는다.
 */
export const WHEN_TBD: Msg = { ko: '날짜 미정', en: 'Date TBD', es: 'Fecha por decidir' };

/**
 * 모임 한 줄의 「언제」 자리 — 날짜가 없으면 「날짜 미정」.
 *
 * 세 모양이 나온다.
 *   8/5(수) 오후 6:00     하루 + 시각 (대부분의 모임)
 *   8/5(수) ~ 8/9(일)      여러 날 (여행 — endDate가 있다)
 *   8/5(수)                하루인데 시각이 없다 (당일치기 여행)
 *
 * 예전에는 시각이 없으면 「날짜 미정」이었다. 날짜와 시각이 늘 한 쌍이라는 전제였는데,
 * 여행이 그 전제를 깼다 — 여행은 날짜만 받고 시각을 안 받는다. 날짜가 있는데 미정이라고
 * 적으면 카드가 거짓말을 한다.
 */
export function whenLabelShort(
  date: string | null,
  startTime: string | null,
  locale: Locale,
  endDate?: string | null
): string {
  if (!date) return pick(locale, WHEN_TBD);
  if (endDate && endDate > date) {
    return `${dateLabelShort(date, locale)} ~ ${dateLabelShort(endDate, locale)}`;
  }
  if (!startTime) return dateLabelShort(date, locale);
  return `${dateLabelShort(date, locale)} ${timeLabel(startTime, locale)}`;
}

/** ko: 7/25(토) · en: Sat Jul 25 — 알림 한 줄에 들어가는 짧은 형태 */
export function dateLabelShort(date: string, locale: Locale): string {
  const { m, d, weekday } = parts(date);
  return isKo(locale)
    ? `${m}/${d}(${WEEKDAYS.ko[weekday]})`
    : `${WEEKDAYS[locale][weekday]} ${MONTHS[locale][m - 1]} ${d}`;
}

/** YYYY-MM-DDTHH:mm → "7/29 (수) 오후 4:40" / "Wed, Jul 29 · 4:40 PM" */
export function entryLabel(at: string, locale: Locale): string {
  const [date, time] = at.split('T');
  if (!time) return dateLabel(date, locale);
  return isKo(locale)
    ? `${dateLabel(date, locale)} ${timeLabel(time, locale)}`
    : `${dateLabel(date, locale)} · ${timeLabel(time, locale)}`;
}

/** ko: 오후 6:00 · en: 6:00 PM */
export function timeLabel(time: string, locale: Locale): string {
  const [h, min] = time.split(':').map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(min).padStart(2, '0');
  return isKo(locale)
    ? `${h < 12 ? '오전' : '오후'} ${h12}:${mm}`
    : `${h12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "얼마나 지났나" 한 마디 — 알림함과 정산 다시 알리기가 같이 쓴다 */
const AGO = {
  justNow: { ko: '방금', en: 'just now', es: 'ahora mismo' },
  minutesAgo: { ko: '{n}분 전', en: '{n}m ago', es: 'hace {n} min' },
  hoursAgo: { ko: '{n}시간 전', en: '{n}h ago', es: 'hace {n} h' },
  daysAgo: { ko: '{n}일 전', en: '{n}d ago', es: 'hace {n} d' },
};

/**
 * now를 받는 이유는 하이드레이션 때문이다 — app/use-now.ts의 설명을 볼 것.
 * 안 주면 부르는 순간의 시각을 쓴다 (서버 렌더가 그렇게 쓴다).
 */
export function timeAgo(iso: string, locale: Locale, now?: number | null): string {
  const diff = (now ?? Date.now()) - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return pick(locale, AGO.justNow);
  if (min < 60) return pick(locale, AGO.minutesAgo, { n: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return pick(locale, AGO.hoursAgo, { n: hours });
  return pick(locale, AGO.daysAgo, { n: Math.floor(hours / 24) });
}
