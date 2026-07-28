'use client';

import {useEffect, useMemo, useState} from 'react';
import {DaySchedule, Format, Selections, Showtime} from '@/lib/types';
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
    ko: 'AMC Town Center 20 — 날짜를 고르고, 보고 싶은 영화의 회차를 모두 선택하세요. 같은 회차를 고른 사람끼리 그룹이 만들어져요.',
    en: 'AMC Town Center 20 — pick a date, then every showtime that works. People who pick the same one get grouped.',
  },
  noMovies: { ko: '이 날짜에는 상영표가 없어요.', en: 'No showtimes for this date.' },
  amcDown: {
    ko: 'AMC 상영표를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    en: 'Couldn’t load showtimes from AMC. Please try again shortly.',
  },
  manualNotice: {
    ko: '이 날짜 상영표는 AMC 사이트를 보고 직접 옮겨 적은 거예요. 예매 전에 AMC에서 시간을 한 번 더 확인해주세요.',
    en: 'These showtimes were copied by hand from the AMC site. Double-check the time on AMC before you buy.',
  },
  sampleNotice: {
    ko: '⚠️ 아래 상영표는 예시예요. AMC에서 발급한 키가 목요일에 활성화되면 실제 상영표로 바뀝니다.',
    en: '⚠️ These showtimes are samples. They switch to the real AMC listings once our API key goes live on Thursday.',
  },
  runtimeRating: { ko: '{runtime}분 · {rating}', en: '{runtime} min · {rating}' },
  pickedElsewhere: { ko: '다른 날짜 포함 {n}개 선택됨', en: '{n} picked across all dates' },
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
  const [movies, setMovies] = useState<DaySchedule['movies']>([]);
  const [date, setDate] = useState('');
  const [dates, setDates] = useState<string[]>([]);
  const [amcError, setAmcError] = useState<string | null>(null);
  const [sample, setSample] = useState(false);
  const [manual, setManual] = useState(false);
  const [loadingDay, setLoadingDay] = useState(false);
  const [selections, setSelections] = useState<Selections>({});
  const [user, setUser] = useState<SessionUser | null>(null);
  // 고른 회차는 스냅샷째로 들고 있는다 — 저장할 때 영화·시간 정보를 함께 보내야 한다
  const [picked, setPicked] = useState<Map<string, Showtime>>(new Map());
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

  /** 하루치 상영표를 받아온다 (선택 현황도 같이 갱신) */
  async function loadDay(target?: string) {
    const data = await fetch(`/api/schedule${target ? `?date=${target}` : ''}`).then((r) => r.json());
    setDate(data.date);
    setDates(data.dates ?? []);
    setMovies(data.movies ?? []);
    setSelections(data.selections ?? {});
    setSample(Boolean(data.sample));
    setManual(Boolean(data.manual));
    setAmcError(data.error ?? null);
  }

  useEffect(() => {
    Promise.all([loadDay(), fetch('/api/auth/me').then((r) => r.json())])
      .then(([, auth]) => {
        setUser(auth.user ?? null);
        setNickname(auth.nickname ?? null);
        setKakaoName(auth.kakaoName ?? '');
      })
      .finally(() => setLoading(false));
  }, []);

  async function pickDate(next: string) {
    if (next === date) return;
    setLoadingDay(true);
    await loadDay(next);
    setLoadingDay(false);
  }

  useEffect(() => {
    if (!user) return;
    const existing = selections[user.id];
    if (existing) setPicked(new Map(existing.picks.map((p) => [p.id, p])));
  }, [user, selections]);

  const membersFor = useMemo(() => {
    const members: Record<string, string[]> = {};
    for (const sel of Object.values(selections)) {
      for (const p of sel.picks) (members[p.id] ??= []).push(sel.name);
    }
    for (const names of Object.values(members)) names.sort((a, b) => a.localeCompare(b, 'ko'));
    return members;
  }, [selections]);

  function toggle(showtime: Showtime) {
    if (!user) {
      setMsg({ type: 'err', text: t(T.loginToPick) });
      return;
    }
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(showtime.id)) next.delete(showtime.id);
      else next.set(showtime.id, showtime);
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
        body: JSON.stringify({ picks: [...picked.values()] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.saveFailed));
      setMsg({ type: 'ok', text: t(T.saved) });
      await loadDay(date);
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.saveFailed) });
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setPicked(new Map());
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
      await loadDay(date);
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
        AMC
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
                  {picked.size > 0 ? t(T.pickedElsewhere, { n: picked.size }) : t(T.pickPrompt)}
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

      {/* 날짜 고르기 */}
      <div className="date-strip">
        {dates.map((d) => {
          const { short, wd } = formatDateHeading(d, locale);
          return (
            <button
              key={d}
              className={`date-pill ${d === date ? 'on' : ''}`}
              onClick={() => pickDate(d)}
              disabled={loadingDay}
            >
              {short}
              <small>{wd}</small>
            </button>
          );
        })}
      </div>

      {sample && <div className="msg err">{t(T.sampleNotice)}</div>}
      {manual && <div className="msg">{t(T.manualNotice)}</div>}
      {amcError && !sample && <div className="msg err">{t(T.amcDown)}</div>}

      {loadingDay ? (
        <p className="subtitle">{t(T.loading)}</p>
      ) : movies.length === 0 ? (
        <div className="card" style={{ color: 'var(--text-dim)' }}>{t(T.noMovies)}</div>
      ) : (
        movies.map(({ movie, showtimes }) => (
          <section key={movie.id} className="date-section">
            <div className="movie-head">
              <span className="movie-name">{movie.name}</span>
              {(movie.runtime || movie.rating) && (
                <span className="movie-meta">
                  {[movie.runtime ? t(T.runtimeRating, { runtime: movie.runtime, rating: movie.rating ?? '' }) : movie.rating]
                    .filter(Boolean)
                    .join('')}
                </span>
              )}
            </div>
            {FORMAT_ORDER.map((fmt) => {
              const times = showtimes.filter((s) => s.format === fmt);
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
                          onClick={() => toggle(s)}
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
        ))
      )}

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
