'use client';

import {useEffect, useMemo, useState} from 'react';
import {Format, Selections, Showtime} from '@/lib/types';
import { useLocale, useT } from '../i18n';
import { timeLabel as fmtTime, weekdayLabel as fmtWeekday } from '@/lib/datefmt';
import { Locale } from '@/lib/i18n';

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

const T = {
  loading: { ko: '스케줄 불러오는 중…', en: 'Loading showtimes…' },
  intro: {
    ko: 'AMC Town Center 20 — 2시간 52분 · R등급. 가능한 회차를 모두 고르세요. 같은 회차끼리 그룹이 만들어져요.',
    en: 'AMC Town Center 20 — 2h52m · Rated R. Pick every showtime that works; people who pick the same one get grouped.',
  },
  loginToPick: { ko: '카카오 로그인 후 회차를 선택할 수 있어요.', en: 'Log in with Kakao to pick showtimes.' },
  saveFailed: { ko: '저장 실패', en: 'Couldn’t save' },
  saved: {
    ko: '저장됐어요! "그룹"에서 누구랑 겹치는지 확인해보세요.',
    en: 'Saved — check “Groups” to see who overlaps with you.',
  },
  nicknameFailed: { ko: '닉네임 저장 실패', en: 'Couldn’t save the nickname' },
  nickname: { ko: '닉네임', en: 'Nickname' },
  nicknameHint: {
    ko: '비워두고 저장하면 카카오 닉네임({name})을 사용해요.',
    en: 'Leave it empty to use your Kakao nickname ({name}).',
  },
  save: { ko: '저장', en: 'Save' },
  saving: { ko: '저장 중…', en: 'Saving…' },
  cancel: { ko: '취소', en: 'Cancel' },
  picked: { ko: '{n}개 회차 선택됨', en: '{n} showtimes picked' },
  pickPrompt: { ko: '가능한 회차를 골라주세요', en: 'Pick the showtimes that work' },
  logout: { ko: '로그아웃', en: 'Log out' },
  loginPrompt: {
    ko: '카카오 로그인 후 가능한 회차를 선택할 수 있어요.',
    en: 'Log in with Kakao to pick your showtimes.',
  },
  kakaoLogin: { ko: '카카오 로그인', en: 'Log in with Kakao' },
  saveMine: { ko: '내 스케줄 저장하기 · {n}개 선택됨', en: 'Save my picks · {n} selected' },
  loginAndStart: { ko: '카카오 로그인하고 시작하기', en: 'Log in with Kakao to start' },
  dayLabel: { ko: '{m}월 {d}일', en: '{mon} {d}' },
  weekdayLabel: { ko: '{wd}요일', en: '{wd}' },
};

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDateHeading(
  date: string,
  locale: Locale
): { label: string; weekday: string; short: string; wd: string } {
  const [, m, d] = date.split('-').map(Number);
  const wd = fmtWeekday(date, locale);
  return {
    label: locale === 'en' ? `${MONTHS_EN[m - 1]} ${d}` : `${m}월 ${d}일`,
    weekday: locale === 'en' ? wd : `${wd}요일`,
    short: `${m}/${d}`,
    wd,
  };
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

  const [nickname, setNickname] = useState<string | null>(null);
  const [kakaoName, setKakaoName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const t = useT();
  const locale = useLocale();
  const to12h = (time: string) => fmtTime(time, locale);

  useEffect(() => {
    if (!openTip) return;
    const close = () => setOpenTip(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openTip]);

  useEffect(() => {
    Promise.all([
      fetch('/api/schedule').then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json()),
    ])
      .then(([data, auth]) => {
        setSchedule(data.schedule ?? []);
        setSelections(data.selections ?? {});
        setUser(auth.user ?? null);
        setNickname(auth.nickname ?? null);
        setKakaoName(auth.kakaoName ?? '');
      })
      .finally(() => setLoading(false));
  }, []);

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
      setMsg({ type: 'err', text: t(T.loginToPick) });
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
      if (!res.ok) throw new Error(data.error ?? t(T.saveFailed));
      setMsg({ type: 'ok', text: t(T.saved) });
      const refreshed = await fetch('/api/schedule').then((r) => r.json());
      setSelections(refreshed.selections ?? {});
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.saveFailed) });
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

  async function saveNickname() {
    setSavingName(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nameInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.nicknameFailed));
      setUser((u) => (u ? { ...u, name: data.name } : u));
      setNickname(data.nickname ?? null);
      setKakaoName(data.kakaoName ?? '');
      setEditingName(false);
      const refreshed = await fetch('/api/schedule').then((r) => r.json());
      setSelections(refreshed.selections ?? {});
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.nicknameFailed) });
    } finally {
      setSavingName(false);
    }
  }

  if (loading) return <p className="subtitle">{t(T.loading)}</p>;

  return (
    <>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", color: 'var(--accent)', fontWeight: 700 }}>
        The Odyssey
      </h1>
      <p className="subtitle">
        {t(T.intro)}
      </p>

      <div className="card">
        {user ? (
          editingName ? (
            <div>
              <div className="field-row">
                <input
                  type="text"
                  placeholder={t(T.nickname)}
                  value={nameInput}
                  maxLength={20}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !savingName && saveNickname()}
                  autoFocus
                />
                <button className="secondary" disabled={savingName} onClick={saveNickname}>
                  {savingName ? t(T.saving) : t(T.save)}
                </button>
                <button className="secondary" disabled={savingName} onClick={() => setEditingName(false)}>
                  {t(T.cancel)}
                </button>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, margin: '10px 2px 0' }}>
                {t(T.nicknameHint, { name: kakaoName })}
              </p>
            </div>
          ) : (
            <div className="field-row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'baseline', gap: 14 }}>
                {user.name}
                <button
                  className="secondary"
                  style={{ fontSize: 12.5 }}
                  onClick={() => {
                    setNameInput(nickname ?? '');
                    setEditingName(true);
                  }}
                >
                  {t(T.nickname)}
                </button>
                <span style={{ color: 'var(--text-dim)', fontSize: 13.5, fontWeight: 500 }}>
                  {picked.size > 0 ? t(T.picked, { n: picked.size }) : t(T.pickPrompt)}
                </span>
              </span>
              <button className="secondary" onClick={logout}>{t(T.logout)}</button>
            </div>
          )
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 500 }}>
              {t(T.loginPrompt)}
            </span>
            <a className="kakao-btn" href="/api/auth/login">
              <KakaoIcon />
              {t(T.kakaoLogin)}
            </a>
          </div>
        )}
      </div>

      {byDate.map(([date, shows]) => {
        const { label, weekday, short } = formatDateHeading(date, locale);
        return (
          <section key={date} className="date-section">
            <div className="date-heading">
              <span className="date-badge">
                {short}
                <small>{label} {weekday}</small>
              </span>
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
                          {members.length > 0 && (
                            <span
                              className="count"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenTip((cur) => (cur === s.id ? null : s.id));
                              }}
                            >
                              {members.length}
                            </span>
                          )}
                          {s.note && <span className="note">{s.note}</span>}
                          {members.length > 0 && (
                            <div className={`chip-tip ${openTip === s.id ? 'open' : ''}`}>
                              {members.map((m, i) => (
                                <span key={i} className="chip-tip-name">{m}</span>
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

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 36, marginTop: 0 }}>
        {user ? (
          <button className="big-cta" onClick={submit} disabled={saving || picked.size === 0}>
            {saving
              ? t(T.saving)
              : picked.size > 0
                ? t(T.saveMine, { n: picked.size })
                : t(T.pickPrompt)}
            <span className="arrow">→</span>
          </button>
        ) : (
          <a className="kakao-btn" href="/api/auth/login">
            <KakaoIcon />
            {t(T.loginAndStart)}
          </a>
        )}
      </div>
    </>
  );
}
