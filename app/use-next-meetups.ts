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

export interface NextMeetups {
  /** 카드 하단 한 줄. 아직 불러오는 중이면 null이라 줄이 나타나지 않고, 받은 뒤 조용히 채워진다 */
  summaryFor: (slug: string, kind?: 'movie' | 'posts') => CardSummary | null;
  /**
   * 요청이 끝났는지 (성공이든 실패든).
   *
   * 홈은 「예정된 모임이 있는 카테고리만」을 고르는 데 이 답이 필요해서, 오기 전에 그리면
   * 열두 장이 깔렸다가 두세 장으로 접히는 게 눈에 보인다. 실패해도 true가 되어야 한다 —
   * 아니면 요약 서버가 조용히 죽었을 때 홈이 영영 「불러오는 중」에 머문다.
   */
  settled: boolean;
}

/** 카테고리별 다음 모임 요약 — 홈과 카테고리 목록이 같이 쓴다 */
export default function useNextMeetups(): NextMeetups {
  const [data, setData] = useState<{ today: string; summaries: Record<string, NextMeetup> } | null>(null);
  const [settled, setSettled] = useState(false);
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
      })
      .finally(() => {
        if (alive) setSettled(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const summaryFor = (slug: string, kind: 'movie' | 'posts' = 'posts') => {
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

  return { summaryFor, settled };
}
