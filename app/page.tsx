'use client';

import {useEffect, useMemo, useState} from 'react';
import {Format, Selections, Showtime} from '@/lib/types';

const FORMAT_ORDER: Format[] = ['IMAX with Laser', 'Dolby Cinema', 'PRIME', 'Laser'];
const FORMAT_CLASS: Record<Format, string> = {
  'IMAX with Laser': 'f-imax',
  'Dolby Cinema': 'f-dolby',
  PRIME: 'f-prime',
  Laser: 'f-laser',
};

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatDateHeading(date: string): { label: string; weekday: string; short: string; wd: string } {
  const [y, m, d] = date.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  return { label: `${m}월 ${d}일`, weekday: `${wd}요일`, short: `${m}/${d}`, wd };
}

function to12h(time: string): string {
  const [h, min] = time.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${ampm} ${h12}:${String(min).padStart(2, '0')}`;
}

export default function PickPage() {
  const [schedule, setSchedule] = useState<Showtime[]>([]);
  const [selections, setSelections] = useState<Selections>({});
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/schedule')
      .then((r) => r.json())
      .then((data) => {
        setSchedule(data.schedule ?? []);
        setSelections(data.selections ?? {});
      })
      .finally(() => setLoading(false));
  }, []);

  // 이름 입력 시 기존 선택 불러오기
  useEffect(() => {
    const existing = selections[name.trim()];
    if (existing) setPicked(new Set(existing));
  }, [name, selections]);

  const byDate = useMemo(() => {
    const map = new Map<string, Showtime[]>();
    for (const s of schedule) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [schedule]);

  const countFor = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ids of Object.values(selections)) {
      for (const id of ids) counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [selections]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    setMsg(null);
    setSaving(true);
    try {
      const res = await fetch('/api/selections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), showtimeIds: [...picked] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '저장 실패');
      setMsg({ type: 'ok', text: '저장됐어요! "그룹 보기"에서 누구랑 겹치는지 확인해보세요.' });
      const refreshed = await fetch('/api/schedule').then((r) => r.json());
      setSelections(refreshed.selections ?? {});
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '저장 실패' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="subtitle">스케줄 불러오는 중…</p>;

  return (
    <>
      <h1>The Odyssey, 언제 볼 수 있어?</h1>
      <p className="subtitle">
        AMC Town Center 20 · 2시간 52분 · R등급 — 가능한 회차를 전부 선택하고 저장하세요.
        같은 회차를 고른 사람들끼리 자동으로 그룹이 만들어져요.
      </p>

      <div className="card">
        <div className="field-row">
          <input
            type="text"
            placeholder="이름 (예: 홍길동)"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
          />
          <span style={{ color: 'var(--text-dim)', fontSize: 13.5, fontWeight: 600 }}>
            {picked.size > 0 ? `${picked.size}개 회차 선택됨` : '가능한 회차를 골라주세요'}
          </span>
        </div>
      </div>

      {byDate.map(([date, shows]) => {
        const { label, weekday, short, wd } = formatDateHeading(date);
        return (
          <section key={date} className="card date-section">
            <div className="date-heading">
              <span className="date-badge">
                {short}
                <small>{wd}</small>
              </span>
              {label} <span className="weekday">{weekday}</span>
            </div>
            {FORMAT_ORDER.map((fmt) => {
              const times = shows.filter((s) => s.format === fmt).sort((a, b) => a.time.localeCompare(b.time));
              if (times.length === 0) return null;
              return (
                <div key={fmt} className="format-row">
                  <div className={`format-label ${FORMAT_CLASS[fmt]}`}>{fmt.toUpperCase()}</div>
                  <div className="times">
                    {times.map((s) => {
                      const n = countFor[s.id] ?? 0;
                      const selected = picked.has(s.id);
                      return (
                        <div
                          key={s.id}
                          className={`time-chip ${selected ? 'selected' : ''}`}
                          onClick={() => toggle(s.id)}
                        >
                          <span>{to12h(s.time)}</span>
                          {selected && <span style={{ fontWeight: 800 }}>✓</span>}
                          {n > 0 && <span className="count">🙋{n}</span>}
                          {s.note && <span className="note">{s.note}</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <button style={{ width: '100%' }} onClick={submit} disabled={saving || !name.trim() || picked.size === 0}>
        {saving
          ? '저장 중…'
          : picked.size > 0
            ? `내 스케줄 저장하기 · ${picked.size}개 선택됨`
            : '내 스케줄 저장하기'}
      </button>
    </>
  );
}
