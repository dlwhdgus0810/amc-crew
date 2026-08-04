'use client';

/**
 * 카테고리 카드 하단 「다음 일정」 한 줄을 만든다. 홈과 둘러보기가 같이 쓴다.
 *
 * 예전에는 마운트한 뒤 /api/next-meetups를 불렀는데, 지금은 서버가 페이지를 그리면서
 * 이미 읽어 넘겨준다(app/page.tsx · app/categories/page.tsx). 그래서 여기서는
 * 받아오는 일 없이 문구만 만든다 — 그 라우트도 부르는 곳이 없어져 지웠다.
 */

import { useLocale, useT } from './i18n';
import { dateLabelShort, timeLabel } from '@/lib/datefmt';

const T = {
  people: { ko: '{n}명', en: '{n} joined' },
  peopleCap: { ko: '{n}/{cap}명', en: '{n}/{cap}' },
  matched: { ko: '{n}명 매칭', en: '{n} matched' },
  noUpcoming: { ko: '예정된 모임 없음', en: 'No upcoming meetups' },
};

interface NextMeetup {
  postId: string;
  date: string;
  startTime: string;
  location: string;
  title: string | null;
  count: number;
  capacity: number | null;
}

export interface CardSummary {
  when?: string;
  detail?: string;
}

/** 서버가 미리 읽어 넘겨준 요약 */
export interface NextMeetupsSeed {
  today: string;
  summaries: Record<string, NextMeetup>;
}

export interface NextMeetups {
  /** 카드 하단 한 줄 — 예정된 모임이 없으면 when 없이 문구만 준다 */
  summaryFor: (slug: string, kind?: 'movie' | 'posts') => CardSummary;
}

export default function useNextMeetups(seed: NextMeetupsSeed): NextMeetups {
  const t = useT();
  const locale = useLocale();

  const summaryFor = (slug: string, kind: 'movie' | 'posts' = 'posts'): CardSummary => {
    const next = seed.summaries[slug];
    if (!next) return { detail: t(T.noUpcoming) };

    // 언제나 날짜까지 적는다 — "토 오후 3:00"만 있으면 이번 주 토요일인지 다음 주인지
    // 카드만 보고는 알 수 없다. 한 주 안일 때만 요일로 줄여 쓰던 것을 없앴다.
    const when = `${dateLabelShort(next.date, locale)} ${timeLabel(next.startTime, locale)}`;

    const people =
      kind === 'movie'
        ? t(T.matched, { n: next.count })
        : next.capacity != null
          ? t(T.peopleCap, { n: next.count, cap: next.capacity })
          : t(T.people, { n: next.count });
    // AMC는 영화 이름이, 나머지는 장소가 앞에 온다
    const head = kind === 'movie' ? (next.title ?? next.location) : next.location;
    return { when, detail: `${head} · ${people}` };
  };

  return { summaryFor };
}
