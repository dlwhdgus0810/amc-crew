'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getCategory } from '@/lib/categories';
import { addDays, weekdayOf } from '@/lib/dates';
import { dateLabel, timeLabel } from '@/lib/datefmt';
import { useLocale, useT } from '../i18n';

interface CalendarMeetup {
  id: string;
  category: string;
  title: string | null;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  capacity: number | null;
  count: number;
  joined: boolean;
  isPast: boolean;
  private: boolean;
}

type View = 'month' | 'week';

const T = {
  title: { ko: '캘린더', en: 'Calendar' },
  subtitle: {
    ko: '모든 카테고리의 모임을 날짜별로 봐요. 날짜를 누르면 그날 모임이 아래에 나와요.',
    en: 'Every meetup by date. Tap a day to see what’s on.',
  },
  subtitleWeek: {
    ko: '한 주 모임을 한눈에 봐요. 날짜를 누르면 그날로 넘어가요.',
    en: 'The whole week at a glance. Tap a day to jump to it.',
  },
  monthView: { ko: '월', en: 'Month' },
  weekView: { ko: '주', en: 'Week' },
  failed: { ko: '달력을 불러오지 못했어요.', en: 'Couldn’t load the calendar.' },
  prev: { ko: '이전', en: 'Previous' },
  next: { ko: '다음', en: 'Next' },
  today: { ko: '오늘', en: 'Today' },
  monthLabel: { ko: '{y}년 {m}월', en: '{mon} {y}' },
  weekLabel: { ko: '{from} – {to}', en: '{from} – {to}' },
  emptyMonth: { ko: '이 달에는 아직 모임이 없어요.', en: 'No meetups this month yet.' },
  emptyWeek: { ko: '이 주에는 아직 모임이 없어요.', en: 'No meetups this week yet.' },
  emptyDay: { ko: '이 날에는 모임이 없어요.', en: 'Nothing on this day.' },
  monthCount: { ko: '이 달 모임 {n}개', en: '{n} meetups this month' },
  weekCount: { ko: '이 주 모임 {n}개', en: '{n} meetups this week' },
  people: { ko: '{n}명', en: '{n} joined' },
  peopleCap: { ko: '{n}/{cap}명', en: '{n}/{cap}' },
  joined: { ko: '참가 중', en: 'Joined' },
  privateTag: { ko: '비공개', en: 'Private' },
  past: { ko: '지난 모임', en: 'Ended' },
};

const WEEKDAY_HEAD = {
  ko: ['일', '월', '화', '수', '목', '금', '토'],
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
};
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 그 날짜가 속한 주의 일요일 */
function weekStart(date: string): string {
  return addDays(date, -weekdayOf(date));
}

/** 그 달의 마지막 날 (다음 달 0일 = 이번 달 말일) */
function monthEnd(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return `${date.slice(0, 7)}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
}

/** 격자에 그릴 기간 — 월 보기는 첫 주·마지막 주를 채우는 앞뒤 달 날짜까지 포함한다 */
function rangeOf(view: View, anchor: string): { from: string; to: string } {
  if (view === 'week') {
    const from = weekStart(anchor);
    return { from, to: addDays(from, 6) };
  }
  return { from: weekStart(`${anchor.slice(0, 7)}-01`), to: addDays(weekStart(monthEnd(anchor)), 6) };
}

/**
 * 날짜별 모임 달력 — 월 보기와 주 보기.
 *
 * 월 보기는 격자에서 고른 하루만 아래에 펼친다.
 * 주 보기는 7일치를 통째로 나열한다 — 한 주쯤은 눌러보지 않고 한 번에 읽는 게 낫다.
 */
export default function CalendarClient({ today }: { today: string }) {
  // 기본은 주 보기 — 대부분 "이번 주에 뭐 있지?"를 보러 온다
  const [view, setView] = useState<View>('week');
  /** 지금 보고 있는 기간 안의 아무 날짜 — 달/주를 이 날짜에서 계산한다 */
  const [anchor, setAnchor] = useState(today);
  const [meetups, setMeetups] = useState<CalendarMeetup[]>([]);
  const [selected, setSelected] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const t = useT();
  const locale = useLocale();

  const { from, to } = useMemo(() => rangeOf(view, anchor), [view, anchor]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/calendar?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (!alive) return;
        setMeetups(data.meetups ?? []);
        setError(false);
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [from, to]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarMeetup[]>();
    for (const m of meetups) {
      if (!map.has(m.date)) map.set(m.date, []);
      map.get(m.date)!.push(m);
    }
    return map;
  }, [meetups]);

  const cells = useMemo(() => {
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
    return Array.from({ length: days }, (_, i) => addDays(from, i));
  }, [from, to]);

  /** 격자를 채우려고 물고 온 앞뒤 달 날짜인지 — 주 보기에서는 7칸 모두 이번 주다 */
  const isOutside = (date: string) => view === 'month' && !date.startsWith(anchor.slice(0, 7));

  /** 기간에 실제로 속한 모임 (월 보기 격자는 앞뒤 달까지 물고 있다) */
  const inPeriod = useMemo(
    () => (view === 'week' ? meetups : meetups.filter((m) => m.date.startsWith(anchor.slice(0, 7)))),
    [meetups, view, anchor]
  );

  function shift(n: number) {
    if (view === 'week') {
      setAnchor(addDays(anchor, n * 7));
      return;
    }
    // 달은 1일 기준으로 옮긴다 — 31일에서 옮기면 없는 날짜가 나온다
    const [y, m] = anchor.split('-').map(Number);
    const total = y * 12 + (m - 1) + n;
    setAnchor(`${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}-01`);
  }

  /** 보기를 바꿔도 보고 있던 날짜를 놓치지 않게 고른 날짜를 기준으로 삼는다 */
  function changeView(next: View) {
    if (next === view) return;
    setAnchor(selected);
    setView(next);
  }

  const periodTitle =
    view === 'week'
      ? t(T.weekLabel, { from: dateLabel(from, locale), to: dateLabel(to, locale) })
      : t(T.monthLabel, {
          y: anchor.slice(0, 4),
          m: Number(anchor.slice(5, 7)),
          mon: MONTHS_EN[Number(anchor.slice(5, 7)) - 1],
        });

  const showToday = view === 'week' ? today < from || today > to : !today.startsWith(anchor.slice(0, 7));
  const dayList = byDate.get(selected) ?? [];
  // 주 보기는 7일치를 통째로 — 모임이 있는 날만 묶어서 아래에 그린다
  const weekDays = cells.filter((d) => (byDate.get(d) ?? []).length > 0);

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(view === 'week' ? T.subtitleWeek : T.subtitle)}</p>

      {error && <div className="msg err">{t(T.failed)}</div>}

      <div className="segbar cal-views">
        <button className={view === 'week' ? 'on' : ''} onClick={() => changeView('week')}>
          {t(T.weekView)}
        </button>
        <button className={view === 'month' ? 'on' : ''} onClick={() => changeView('month')}>
          {t(T.monthView)}
        </button>
      </div>

      <div className="cal-head">
        <button className="cal-nav" aria-label={t(T.prev)} onClick={() => shift(-1)}>
          ‹
        </button>
        <strong className={`cal-month${view === 'week' ? ' week' : ''}`}>{periodTitle}</strong>
        <button className="cal-nav" aria-label={t(T.next)} onClick={() => shift(1)}>
          ›
        </button>
        {showToday && (
          <button
            className="link-btn cal-today"
            onClick={() => {
              setAnchor(today);
              setSelected(today);
            }}
          >
            {t(T.today)}
          </button>
        )}
      </div>

      <div className={`cal-grid${loading ? ' loading' : ''}${view === 'week' ? ' week' : ''}`}>
        {WEEKDAY_HEAD[locale].map((w, i) => (
          <div key={i} className="cal-wd">
            {w}
          </div>
        ))}
        {cells.map((date) => {
          const list = byDate.get(date) ?? [];
          const outside = isOutside(date);
          return (
            <button
              key={date}
              className={`cal-day${outside ? ' out' : ''}${date === today ? ' today' : ''}${date === selected ? ' on' : ''}`}
              aria-current={date === today ? 'date' : undefined}
              aria-pressed={date === selected}
              onClick={() => {
                setSelected(date);
                // 앞뒤 달의 날짜를 누르면 그 달로 넘어간다 — 아니면 그날 모임이 없는 것처럼 보인다
                if (outside) setAnchor(date);
                // 주 보기의 목록은 한 주 전체라, 누른 날짜가 화면 밖에 있을 수 있다.
                // behavior: 'smooth'는 환경에 따라 아무 일도 안 일어나서 기본(즉시)으로 둔다.
                if (view === 'week') {
                  document.getElementById(`cal-d-${date}`)?.scrollIntoView({ block: 'start' });
                }
              }}
            >
              <span className="cal-n">{Number(date.slice(8, 10))}</span>
              <span className="cal-dots">
                {/* 점 3개까지만 — 그보다 많으면 "+n"으로 접는다 */}
                {list.slice(0, 3).map((m) => (
                  <i
                    key={m.id}
                    className={m.isPast ? 'past' : ''}
                    style={{ background: getCategory(m.category)?.color ?? 'var(--text-dim)' }}
                  />
                ))}
                {list.length > 3 && <b>+{list.length - 3}</b>}
              </span>
            </button>
          );
        })}
      </div>

      {!loading && !error && (
        <p className="hint cal-empty">
          {inPeriod.length > 0
            ? t(view === 'week' ? T.weekCount : T.monthCount, { n: inPeriod.length })
            : t(view === 'week' ? T.emptyWeek : T.emptyMonth)}
        </p>
      )}

      {view === 'week' ? (
        weekDays.map((date) => (
          <section key={date} id={`cal-d-${date}`} className="cal-list-day">
            <h2 className={`cal-daytitle${date === today ? ' today' : ''}`}>{dateLabel(date, locale)}</h2>
            <MeetupList list={byDate.get(date) ?? []} t={t} locale={locale} />
          </section>
        ))
      ) : (
        <>
          <h2 className={`cal-daytitle${selected === today ? ' today' : ''}`}>{dateLabel(selected, locale)}</h2>
          {dayList.length === 0 ? <p className="hint">{t(T.emptyDay)}</p> : <MeetupList list={dayList} t={t} locale={locale} />}
        </>
      )}
    </>
  );
}

/** 하루치 모임 카드 목록 — 월 보기(고른 날)와 주 보기(요일마다)가 함께 쓴다 */
function MeetupList({
  list,
  t,
  locale,
}: {
  list: CalendarMeetup[];
  t: ReturnType<typeof useT>;
  locale: ReturnType<typeof useLocale>;
}) {
  return (
    <div className="cal-list">
      {list.map((m) => {
        const cat = getCategory(m.category);
        return (
          <Link key={m.id} href={`/p/${m.id}`} className={`cal-item${m.isPast ? ' past' : ''}`}>
            <span className="cal-bar" style={{ background: cat?.color ?? 'var(--text-dim)' }} aria-hidden />
            <span className="cal-body">
              <span className="cal-when">
                {timeLabel(m.startTime, locale)}
                <span className="cal-cat">{cat ? t(cat.name) : m.category}</span>
                {m.private && <span className="cal-tag">{t(T.privateTag)}</span>}
                {m.joined && <span className="cal-tag on">{t(T.joined)}</span>}
                {m.isPast && <span className="cal-tag">{t(T.past)}</span>}
              </span>
              <span className="cal-what">{m.title || m.location}</span>
              <span className="cal-meta">
                {m.title ? `${m.location} · ` : ''}
                {m.capacity ? t(T.peopleCap, { n: m.count, cap: m.capacity }) : t(T.people, { n: m.count })}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
