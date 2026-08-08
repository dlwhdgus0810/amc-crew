import { NextResponse } from 'next/server';
import { E, errJson } from './apierr';
import type { SessionUser } from './auth';
import { banStateOf } from './db/bans';
import { Locale, pick } from './i18n';
import { getLocale } from './locale';

/**
 * 이용 정지 확인 — 무언가를 바꾸는 라우트는 전부 이걸 거친다.
 *
 * 세션 자체를 무효로 만들지 않는 이유: 그러면 정지당한 사람에게 "로그인하세요"가 뜨고,
 * 왜 막혔는지도 언제 풀리는지도 알 수 없다. 신원은 그대로 두고 행동만 막는다.
 *
 * 화면에서도 가리지만(app/ban-screen.tsx), 그건 보여주기일 뿐이고 실제로 막는 건 여기다 —
 * 브라우저 콘솔에서 요청을 직접 쏘는 것까지 막으려면 서버에서 걸러야 한다.
 *
 * 쓰는 법:
 *   const banned = await banGuard(user);
 *   if (banned) return banned;
 */
export async function banGuard(user: SessionUser): Promise<NextResponse | null> {
  const ban = await banStateOf(user.id);
  if (!ban) return null;
  return await errJson(E.banned, 403, { left: leftLabel(ban.secondsLeft, await getLocale()) });
}

const U = {
  min: { ko: '{n}분', en: '{n} min', es: '{n} min' },
  hour: { ko: '{n}시간', en: '{n}h' },
  day: { ko: '{n}일 {h}시간', en: '{n}d {h}h' },
  dayOnly: { ko: '{n}일', en: '{n}d', es: '{n} d' },
};

/** "2일 3시간" 처럼 남은 기간을 굵직하게 — 초 단위까지 셀 자리가 아니다 */
function leftLabel(seconds: number, locale: Locale): string {
  const m = Math.ceil(seconds / 60);
  if (m < 60) return pick(locale, U.min, { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return pick(locale, U.hour, { n: h });
  // "3일 0시간"은 사람이 쓰는 말이 아니다
  return h % 24 === 0
    ? pick(locale, U.dayOnly, { n: h / 24 })
    : pick(locale, U.day, { n: Math.floor(h / 24), h: h % 24 });
}
