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

const T = {
  title: { ko: '캘린더', en: 'Calendar' },
  subtitle: {
    ko: '모든 카테고리의 모임을 날짜별로 봐요. 날짜를 누르면 그날 모임이 아래에 나와요.',
    en: 'Every meetup by date. Tap a day to see what’s on.',
  },
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  failed: { ko: '달력을 불러오지 못했어요.', en: 'Couldn’t load the calendar.' },
  prev: { ko: '지난 달', en: 'Previous month' },
  next: { ko: '다음 달', en: 'Next month' },
  today: { ko: '오늘', en: 'Today' },
  monthLabel: { ko: '{y}년 {m}월', en: '{mon} {y}' },
  emptyMonth: { ko: '이 달에는 아직 모임이 없어요.', en: 'No meetups this month yet.' },
  emptyDay: { ko: '이 날에는 모임이 없어요.', en: 'Nothing on this day.' },
  monthCount: { ko: '이 달 모임 {n}개', en: '{n} meetups this month' },
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

/** YYYY-MM 을 n달 옮긴다 */
function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** 그 달의 마지막 날 (다음 달 0일 = 이번 달 말일) */
function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/**
 * 날짜별 모임 달력.
 * 카테고리마다 흩어져 있는 모임을 한 화면에서 날짜로 훑어보는 용도라, 지난 모임도 함께 그린다
 * (흐리게 표시). 칸을 누르면 그날 모임이 아래 목록으로 펼쳐진다.
 */
export default function CalendarPage() {
  const [month, setMonth] = useState<string | null>(null);
  const [today, setToday] = useState('');
  const [meetups, setMeetups] = useState<CalendarMeetup[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const t = useT();
  const locale = useLocale();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // 첫 로드는 month 없이 — 어느 달을 보여줄지는 앱 시간대를 아는 서버가 정한다
    fetch(`/api/calendar${month ? `?month=${month}` : ''}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((data) => {
        if (!alive) return;
        setToday(data.today);
        setMeetups(data.meetups ?? []);
        setError(false);
        if (!month) setMonth(data.month);
        // 앞뒤 달 칸을 눌러 넘어온 경우엔 그 날짜를 그대로 둔다.
        // 그 외에는 이번 달이면 오늘을, 다른 달이면 모임이 있는 첫날을 펼쳐 둔다.
        setSelected((prev) =>
          prev?.startsWith(data.month)
            ? prev
            : data.today.startsWith(data.month)
              ? data.today
              : ((data.meetups ?? [])[0]?.date ?? null)
        );
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [month]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarMeetup[]>();
    for (const m of meetups) {
      if (!map.has(m.date)) map.set(m.date, []);
      map.get(m.date)!.push(m);
    }
    return map;
  }, [meetups]);

  // 달력 격자 — 1일이 있는 주의 일요일부터, 마지막 날이 있는 주의 토요일까지
  const cells = useMemo(() => {
    if (!month) return [];
    const lead = weekdayOf(`${month}-01`);
    const total = Math.ceil((lead + daysInMonth(month)) / 7) * 7;
    return Array.from({ length: total }, (_, i) => addDays(`${month}-01`, i - lead));
  }, [month]);

  const monthTitle = month
    ? t(T.monthLabel, { y: month.slice(0, 4), m: Number(month.slice(5, 7)), mon: MONTHS_EN[Number(month.slice(5, 7)) - 1] })
    : '';
  const dayList = selected ? (byDate.get(selected) ?? []) : [];

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

      {error && <div className="msg err">{t(T.failed)}</div>}

      <div className="cal-head">
        <button className="cal-nav" aria-label={t(T.prev)} disabled={!month} onClick={() => month && setMonth(shiftMonth(month, -1))}>
          ‹
        </button>
        <strong className="cal-month">{monthTitle || t(T.loading)}</strong>
        <button className="cal-nav" aria-label={t(T.next)} disabled={!month} onClick={() => month && setMonth(shiftMonth(month, 1))}>
          ›
        </button>
        {today && month !== today.slice(0, 7) && (
          <button className="link-btn cal-today" onClick={() => setMonth(today.slice(0, 7))}>
            {t(T.today)}
          </button>
        )}
      </div>

      <div className={`cal-grid ${loading ? 'loading' : ''}`}>
        {WEEKDAY_HEAD[locale].map((w, i) => (
          <div key={i} className="cal-wd">
            {w}
          </div>
        ))}
        {cells.map((date) => {
          const list = byDate.get(date) ?? [];
          const outside = !date.startsWith(month ?? '');
          return (
            <button
              key={date}
              className={`cal-day${outside ? ' out' : ''}${date === today ? ' today' : ''}${date === selected ? ' on' : ''}`}
              aria-current={date === today ? 'date' : undefined}
              aria-pressed={date === selected}
              onClick={() => {
                setSelected(date);
                // 앞뒤 달의 날짜를 누르면 그 달로 넘어간다 — 아니면 그 날 모임이 없는 것처럼 보인다
                if (outside) setMonth(date.slice(0, 7));
              }}
            >
              <span className="cal-n">{Number(date.slice(8, 10))}</span>
              <span className="cal-dots">
                {/* 점 3개까지만 — 그 이상은 "+n"으로 접는다 */}
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

      {!loading && meetups.length === 0 && !error && <p className="hint cal-empty">{t(T.emptyMonth)}</p>}
      {meetups.length > 0 && <p className="hint cal-empty">{t(T.monthCount, { n: meetups.length })}</p>}

      {selected && (
        <>
          <h2 className="cal-daytitle">{dateLabel(selected, locale)}</h2>
          {dayList.length === 0 ? (
            <p className="hint">{t(T.emptyDay)}</p>
          ) : (
            <div className="cal-list">
              {dayList.map((m) => {
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
                        {m.capacity
                          ? t(T.peopleCap, { n: m.count, cap: m.capacity })
                          : t(T.people, { n: m.count })}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </>
  );
}
