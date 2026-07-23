'use client';

import {useEffect, useMemo, useState} from 'react';
import {Format, Selections, Showtime} from '@/lib/types';

interface SessionUser {
  id: string;
  name: string;
}

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

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.78c.51.06 1.03.1 1.56.1 5.52 0 10-3.54 10-7.88C22 6.54 17.52 3 12 3z"
      />
    </svg>
  );
}

export default function PickPage() {
  const [schedule, setSchedule] = useState<Showtime[]>([]);
  const [selections, setSelections] = useState<Selections>({});
  const [user, setUser] = useState<SessionUser | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [openTip, setOpenTip] = useState<string | null>(null);

  // 툴팁 열린 상태에서 다른 곳을 탭하면 닫기
  useEffect(() => {
    if (!openTip) return;
    const close = () => setOpenTip(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openTip]);

  // 카카오 로그인 실패 시 콜백에서 넘어온 에러 표시
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('login_error');
    if (err) {
      setMsg({ type: 'err', text: err });
      window.history.replaceState(null, '', '/');
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/schedule').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json()),
    ])
      .then(([data, auth]) => {
        setSchedule(data.schedule ?? []);
        setSelections(data.selections ?? {});
        setUser(auth.user ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  // 로그인한 사용자의 기존 선택 불러오기
  useEffect(() => {
    if (!user) return;
    const existing = selections[user.id];
    if (existing) setPicked(new Set(existing.showtimeIds));
  }, [user, selections]);

  const byDate = useMemo(() => {
    const map = new Map<string, Showtime[]>();
    for (const s of schedule) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [schedule]);

  const membersFor = useMemo(() => {
    const members: Record<string, string[]> = {};
    for (const sel of Object.values(selections)) {
      for (const id of sel.showtimeIds) (members[id] ??= []).push(sel.name);
    }
    for (const names of Object.values(members)) names.sort((a, b) => a.localeCompare(b, 'ko'));
    return members;
  }, [selections]);

  function toggle(id: string) {
    if (!user) {
      setMsg({ type: 'err', text: '카카오 로그인 후 회차를 선택할 수 있어요.' });
      return;
    }
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
        body: JSON.stringify({ showtimeIds: [...picked] }),
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

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setPicked(new Set());
    setMsg(null);
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
        {user ? (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700 }}>
              👋 {user.name}님
              <span style={{ color: 'var(--text-dim)', fontSize: 13.5, fontWeight: 600, marginLeft: 10 }}>
                {picked.size > 0 ? `${picked.size}개 회차 선택됨` : '가능한 회차를 골라주세요'}
              </span>
            </span>
            <button className="secondary" onClick={logout}>로그아웃</button>
          </div>
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 600 }}>
              카카오 로그인 후 가능한 회차를 선택할 수 있어요.
            </span>
            <a className="kakao-btn" href="/api/auth/login">
              <KakaoIcon />
              카카오 로그인
            </a>
          </div>
        )}
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
                      const members = membersFor[s.id] ?? [];
                      const selected = picked.has(s.id);
                      return (
                        <div
                          key={s.id}
                          className={`time-chip ${selected ? 'selected' : ''}`}
                          onClick={() => toggle(s.id)}
                        >
                          <span>{to12h(s.time)}</span>
                          {selected && <span style={{ fontWeight: 800 }}>✓</span>}
                          {members.length > 0 && (
                            <span
                              className="count"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenTip((cur) => (cur === s.id ? null : s.id));
                              }}
                            >
                              🙋{members.length}
                            </span>
                          )}
                          {s.note && <span className="note">{s.note}</span>}
                          {members.length > 0 && (
                            <div className={`chip-tip ${openTip === s.id ? 'open' : ''}`}>
                              {members.map((m) => (
                                <span key={m} className="chip-tip-name">{m}</span>
                              ))}
                            </div>
                          )}
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

      {user ? (
        <button style={{ width: '100%' }} onClick={submit} disabled={saving || picked.size === 0}>
          {saving
            ? '저장 중…'
            : picked.size > 0
              ? `내 스케줄 저장하기 · ${picked.size}개 선택됨`
              : '내 스케줄 저장하기'}
        </button>
      ) : (
        <a className="kakao-btn" href="/api/auth/login" style={{ width: '100%' }}>
          <KakaoIcon />
          카카오 로그인하고 시작하기
        </a>
      )}
    </>
  );
}
