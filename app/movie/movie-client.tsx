'use client';

import {useEffect, useMemo, useState} from 'react';
import {DaySchedule, Format, Selections, Showtime} from '@/lib/types';
import { useLocale, useT } from '../i18n';
import { useAmcName } from '../region-context';
import LoginButtons, { useLoginMsg } from '../login-buttons';
import { useRefreshSession, useViewer } from '../session';
import { usePosterZoom } from '../poster-zoom';
import type { ScheduleDay } from '@/lib/schedule-day';
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
  loading: { ko: '스케줄 불러오는 중…', en: 'Loading showtimes…', es: 'Cargando funciones…' },
  /* 극장 이름은 지역마다 다르다 — {theatre}에 들어간다 (lib/amc.ts의 theatreName) */
  intro: {
    ko: '{theatre} — 날짜를 고르고, 보고 싶은 영화의 회차를 모두 선택하세요. 같은 회차를 고른 사람끼리 그룹이 만들어져요.',
    en: '{theatre} — pick a date, then every showtime that works. People who pick the same one get grouped.',
    es: '{theatre}: elige un día y todas las funciones que te vengan bien. Quien elija la misma acaba en tu grupo.',
  },
  noMovies: { ko: '이 날짜에는 상영표가 없어요.', en: 'No showtimes for this date.', es: 'No hay funciones ese día.' },
  amcDown: {
    ko: 'AMC 상영표를 불러오지 못했어요. 잠시 후 다시 시도해주세요.',
    en: 'Couldn’t load showtimes from AMC. Please try again shortly.',
    es: 'No se pudieron cargar las funciones de AMC. Inténtalo de nuevo en un momento.',
  },
  sampleNotice: {
    ko: '⚠️ AMC 상영표를 불러오지 못해 예시를 띄우고 있어요. 잠시 후 새로고침해주세요.',
    en: '⚠️ Couldn’t reach AMC, so these are sample showtimes. Try refreshing in a moment.',
    es: '⚠️ No se pudo contactar con AMC, así que estas funciones son de ejemplo. Prueba a actualizar en un momento.',
  },
  runtimeRating: { ko: '{runtime}분 · {rating}', en: '{runtime} min · {rating}', es: '{runtime} min · {rating}' },
  director: { ko: '감독 {name}', en: 'Dir. {name}', es: 'Dir. {name}' },
  cast: { ko: '출연 {names}', en: 'Cast {names}', es: 'Reparto {names}' },
  zoomPoster: { ko: '{name} 포스터 크게 보기', en: 'View the {name} poster larger', es: 'Ver el cartel de {name} más grande' },
  pickedElsewhere: { ko: '다른 날짜 포함 {n}개 선택됨', en: '{n} picked across all dates', es: '{n} elegidas en total' },
  loginToPick: { ko: '카카오 로그인 후 회차를 선택할 수 있어요.', en: 'Log in with Kakao to pick showtimes.', es: 'Entra con Kakao para elegir funciones.' },
  saveFailed: { ko: '저장 실패', en: 'Couldn’t save', es: 'No se pudo guardar' },
  saved: {
    ko: '저장됐어요! "그룹"에서 누구랑 겹치는지 확인해보세요.',
    en: 'Saved — check “Groups” to see who overlaps with you.',
    es: 'Guardado: mira «Grupos» para ver con quién coincides.',
  },
  nicknameFailed: { ko: '닉네임 저장 실패', en: 'Couldn’t save the nickname', es: 'No se pudo guardar el apodo' },
  nickname: { ko: '닉네임', en: 'Nickname', es: 'Apodo' },
  nicknameHint: {
    ko: '비워두고 저장하면 카카오 닉네임({name})을 사용해요.',
    en: 'Leave it empty to use your Kakao nickname ({name}).',
    es: 'Déjalo vacío para usar tu apodo de Kakao ({name}).',
  },
  nicknameHintGoogle: {
    ko: '비워두고 저장하면 Google 계정 이름({name})을 사용해요.',
    en: 'Leave it empty to use your Google account name ({name}).',
    es: 'Déjalo vacío para usar el nombre de tu cuenta de Google ({name}).',
  },
  save: { ko: '저장', en: 'Save', es: 'Guardar' },
  saving: { ko: '저장 중…', en: 'Saving…', es: 'Guardando…' },
  cancel: { ko: '취소', en: 'Cancel', es: 'Cancelar' },
  picked: { ko: '{n}개 회차 선택됨', en: '{n} showtimes picked', es: '{n} funciones elegidas' },
  pickPrompt: { ko: '가능한 회차를 골라주세요', en: 'Pick the showtimes that work', es: 'Elige las funciones que te vengan bien' },
  logout: { ko: '로그아웃', en: 'Log out', es: 'Cerrar sesión' },
  loginPrompt: {
    ko: '카카오 로그인 후 가능한 회차를 선택할 수 있어요.',
    en: 'Log in with Kakao to pick your showtimes.',
    es: 'Entra con Kakao para elegir tus funciones.',
  },
  /* 로그인 문이 둘인 도메인(펜)용 — 어느 문인지 안 적는다 */
  loginPromptAny: {
    ko: '로그인 후 가능한 회차를 선택할 수 있어요.',
    en: 'Log in to pick your showtimes.',
    es: 'Inicia sesión para elegir tus funciones.',
  },
  saveMine: { ko: '내 스케줄 저장하기 · {n}개 선택됨', en: 'Save my picks · {n} selected', es: 'Guardar mi elección · {n} elegidas' },
  loginAndStart: { ko: '카카오 로그인하고 시작하기', en: 'Log in with Kakao to start', es: 'Entra con Kakao para empezar' },
  loginAndStartGoogle: { ko: 'Google로 로그인하고 시작하기', en: 'Sign in with Google to start', es: 'Entra con Google para empezar' },
  dayLabel: { ko: '{m}월 {d}일', en: '{mon} {d}', es: '{d} {mon}' },
  weekdayLabel: { ko: '{wd}요일', en: '{wd}', es: '{wd}' },
};

const MONTHS: Record<Locale, string[]> = {
  ko: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
};

function formatDateHeading(
  date: string,
  locale: Locale
): { label: string; weekday: string; short: string; wd: string } {
  const [, m, d] = date.split('-').map(Number);
  const wd = fmtWeekday(date, locale);
  return {
    // 한국어만 「8월 2일」 꼴이고 나머지 언어는 「Aug 2」 차례를 쓴다 (fmtWeekday가 이름을 맞춰 준다)
    label: locale === 'ko' ? `${m}월 ${d}일` : `${MONTHS[locale][m - 1]} ${d}`,
    weekday: locale === 'ko' ? `${wd}요일` : wd,
    short: `${m}/${d}`,
    wd,
  };
}

export default function PickPage({ initial }: { initial: ScheduleDay }) {
  const [movies, setMovies] = useState<DaySchedule['movies']>(initial.movies);
  const [date, setDate] = useState(initial.date);
  const [dates, setDates] = useState<string[]>(initial.dates);
  const [amcError, setAmcError] = useState<string | null>(initial.error ?? null);
  const [sample, setSample] = useState(Boolean(initial.sample));
  const [loadingDay, setLoadingDay] = useState(false);
  const [selections, setSelections] = useState<Selections>(initial.selections);
  // 고른 회차는 스냅샷째로 들고 있는다 — 저장할 때 영화·시간 정보를 함께 보내야 한다
  const [picked, setPicked] = useState<Map<string, Showtime>>(new Map());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [openTip, setOpenTip] = useState<string | null>(null);
  // 크게 보고 있는 포스터 (null이면 닫힘)

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const amcName = useAmcName();
  const loginMsg = useLoginMsg();
  const t = useT();
  const locale = useLocale();
  const to12h = (time: string) => fmtTime(time, locale);

  useEffect(() => {
    if (!openTip) return;
    const close = () => setOpenTip(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openTip]);

  /**
   * 하루치 상영표를 받아온다 (선택 현황도 같이 갱신).
   *
   * 둘로 나눠 부른다 — 상영표는 브라우저가 5분 들고 있어서 날짜를 앞뒤로 넘길 때
   * 두 번째부터는 아예 나가지 않고, 선택 현황만 매번 새로 받는다.
   */
  async function loadDay(target?: string) {
    const q = target ? `?date=${target}` : '';
    const [day, picks] = await Promise.all([
      fetch(`/api/schedule/movies${q}`).then((r) => r.json()),
      fetch(`/api/schedule${q}`, { cache: 'no-store' }).then((r) => r.json()),
    ]);
    setDate(day.date);
    setDates(day.dates ?? []);
    setMovies(day.movies ?? []);
    setSelections(picks.selections ?? {});
    setSample(Boolean(day.sample));
    setAmcError(day.error ?? null);
  }

  // 세션은 레이아웃이 서버에서 읽어 둔 것 — 상영표만 받으면 된다
  const zoom = usePosterZoom();
  const viewer = useViewer();
  const refresh = useRefreshSession();
  const user = viewer.user;
  const nickname = viewer.nickname;
  const kakaoName = viewer.kakaoName;

  // 서버가 다시 그려 새 prop이 오면 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다)
  useEffect(() => {
    setMovies(initial.movies);
    setDate(initial.date);
    setDates(initial.dates);
    setSelections(initial.selections);
    setSample(Boolean(initial.sample));
    setAmcError(initial.error ?? null);
  }, [initial]);

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
    setPicked(new Map());
    setMsg(null);
    // 세션은 서버가 들고 있다 — 다시 그리게 해서 로그아웃된 화면을 받는다
    refresh();
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
      setEditingName(false);
      // 이름·닉네임은 서버가 읽어 주는 값이라 다시 그려야 바뀐다
      refresh();
      await loadDay(date);
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.nicknameFailed) });
    } finally {
      setSavingName(false);
    }
  }

  return (
    <>
      <h1 style={{ fontFamily: "var(--font-grotesk), 'Space Grotesk', sans-serif", color: 'var(--accent)', fontWeight: 700 }}>
        AMC
      </h1>
      <p className="subtitle">
        {t(T.intro, { theatre: amcName ?? 'AMC' })}
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
                {t(viewer.provider === 'google' ? T.nicknameHintGoogle : T.nicknameHint, { name: kakaoName })}
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
              {t(loginMsg(T.loginPrompt, T.loginPromptAny))}
            </span>
            <LoginButtons />
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
      {amcError && !sample && <div className="msg err">{t(T.amcDown)}</div>}

      {loadingDay ? (
        <p className="subtitle">{t(T.loading)}</p>
      ) : movies.length === 0 ? (
        <div className="card" style={{ color: 'var(--text-dim)' }}>{t(T.noMovies)}</div>
      ) : (
        movies.map(({ movie, showtimes }) => (
          <section key={movie.id} className="date-section">
            <div className="movie-head">
              {movie.posterUrl &&
                zoom.trigger(
                  movie.posterLargeUrl ?? movie.posterUrl,
                  movie.name,
                  /* 16장 다 합쳐 300KB대라 lazy로 미룰 이득이 없다 (미루면 첫 화면이 빈 칸으로 뜬다) */
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="movie-poster" src={movie.posterUrl} alt="" decoding="async" />
                )}
              <div className="movie-title-block">
                <span className="movie-name">{movie.name}</span>
                {(movie.runtime || movie.rating || movie.score) && (
                  <span className="movie-meta">
                    {[
                      movie.score ? `★ ${movie.score.toFixed(1)}` : null,
                      movie.runtime
                        ? t(T.runtimeRating, { runtime: movie.runtime, rating: movie.rating ?? '' })
                        : movie.rating,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
                {(movie.director || movie.cast?.length) && (
                  <span className="movie-credits">
                    {[
                      movie.director ? t(T.director, { name: movie.director }) : null,
                      movie.cast?.length ? t(T.cast, { names: movie.cast.join(', ') }) : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </div>
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
          <LoginButtons kakaoLabel={T.loginAndStart} googleLabel={T.loginAndStartGoogle} />
        )}
      </div>

      {zoom.overlay}
    </>
  );
}
