'use client';

/* ============================================================
   새 파일 — app/use-next-meetups.ts 로 저장하세요.
   /api/next-meetups 를 한 번 불러, 카테고리 카드에 넘길
   { when, detail } 문구를 만들어주는 훅입니다. (홈 · 카테고리 목록 공용)
   ============================================================ */

import { useEffect, useState } from 'react';
import { useLocale, useT } from './i18n';
import { dateLabelShort, timeLabel, weekdayLabel } from '@/lib/datefmt';
import { addDays } from '@/lib/dates';

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
  joined: boolean;
}

export interface CardSummary {
  when?: string;
  detail?: string;
}

/**
 * 카드 하단 한 줄을 만드는 함수를 돌려준다.
 * 아직 불러오는 중이면 null을 주므로 줄이 나타나지 않고, 받은 뒤 조용히 채워진다.
 */
export default function useNextMeetups(): (slug: string, kind?: 'movie' | 'posts') => CardSummary | null {
  const [data, setData] = useState<{ today: string; summaries: Record<string, NextMeetup> } | null>(null);
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    let alive = true;
    fetch('/api/next-meetups')
      .then((r) => r.json())
      .then((d) => {
        if (alive) setData({ today: d.today ?? '', summaries: d.summaries ?? {} });
      })
      .catch(() => {
        /* 요약은 부가 정보라 실패하면 줄을 그리지 않는다 */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (slug: string, kind: 'movie' | 'posts' = 'posts') => {
    if (!data) return null;
    const next = data.summaries[slug];
    if (!next) return { detail: t(T.noUpcoming) };

    // 한 주 안이면 요일로("토 오후 3:00"), 그보다 멀면 날짜로("8/23(토) 오후 3:00")
    const withinWeek = data.today ? next.date <= addDays(data.today, 6) : false;
    const when = `${withinWeek ? weekdayLabel(next.date, locale) : dateLabelShort(next.date, locale)} ${timeLabel(
      next.startTime,
      locale
    )}`;

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
}
