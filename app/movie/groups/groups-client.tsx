'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Showtime, Selections } from '@/lib/types';
import { useLocale, useT } from '../../i18n';
import { useRefreshSession, useViewer } from '../../session';
import { dateLabelShort, timeLabel } from '@/lib/datefmt';
import { Locale } from '@/lib/i18n';

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…', es: 'Cargando…' },
  title: { ko: '그룹', en: 'Groups', es: 'Grupos' },
  subtitle: {
    ko: '같은 회차를 고른 사람들 — 참여 {n}명. 인원이 많은 순서예요.',
    en: 'People who picked the same showtime — {n} participating, largest groups first.',
    es: 'Gente que eligió la misma función: {n} participan, los grupos grandes primero.',
  },
  empty: {
    ko: '아직 아무도 선택하지 않았어요. 먼저 "시간 고르기"에서 스케줄을 저장해보세요.',
    en: 'Nobody has picked yet. Save your picks in “Showtimes” first.',
    es: 'Todavía nadie ha elegido. Guarda las tuyas en «Funciones».',
  },
  matched: { ko: 'Matched — 매칭된 그룹 ({n})', en: 'Matched — groups ({n})', es: 'Coincidencias — grupos ({n})' },
  makeMeetup: { ko: '이 회차로 모임 만들기 →', en: 'Turn into a meetup →', es: 'Convertir en quedada →' },
  openMeetup: { ko: '모임 보기 →', en: 'Open meetup →', es: 'Abrir la quedada →' },
  making: { ko: '만드는 중…', en: 'Creating…', es: 'Creando…' },
  madeMeetup: {
    ko: '모임을 만들었어요. 이 회차를 고른 {n}명이 참가자로 들어갔어요.',
    en: 'Meetup created — the {n} people who picked this showtime were added.',
    es: 'Quedada creada: se añadieron las {n} personas que eligieron esta función.',
  },
  makeFailed: { ko: '모임 만들기 실패', en: 'Couldn’t create the meetup', es: 'No se pudo crear la quedada' },
  solo: { ko: 'Solo — 아직 혼자인 회차', en: 'Solo — nobody else yet', es: 'Solo tú, de momento' },
  hurry: { ko: '{note} — 예매를 서두르세요', en: '{note} — book soon', es: '{note} — reserva pronto' },
  participants: { ko: '참여자', en: 'Participants', es: 'Participantes' },
  colName: { ko: '이름', en: 'Name', es: 'Nombre' },
  colCount: { ko: '선택 회차 수', en: 'Showtimes picked', es: 'Funciones elegidas' },
  count: { ko: '{n}개', en: '{n}', es: '{n}' },
  me: { ko: ' (나)', en: ' (you)', es: ' (tú)' },
  close: { ko: '닫기', en: 'Close', es: 'Cerrar' },
  editPicks: { ko: '회차 수정', en: 'Edit picks', es: 'Editar elección' },
  delMine: { ko: '내 선택 삭제', en: 'Delete my picks', es: 'Borrar mi elección' },
  del: { ko: '삭제', en: 'Delete', es: 'Borrar' },
  editHeading: { ko: '{name}님의 가능 회차 ({n}개 선택됨)', en: '{name}’s showtimes ({n} selected)', es: 'Funciones de {name} ({n} elegidas)' },
  save: { ko: '저장', en: 'Save', es: 'Guardar' },
  saving: { ko: '저장 중…', en: 'Saving…', es: 'Guardando…' },
  cancel: { ko: '취소', en: 'Cancel', es: 'Cancelar' },
  saveFailed: { ko: '저장 실패', en: 'Couldn’t save', es: 'No se pudo guardar' },
  confirmDeleteMine: { ko: '{name}님의 선택을 삭제할까요?', en: 'Delete {name}’s picks?', es: '¿Borrar la elección de {name}?' },
  confirmClearAll: {
    ko: '회차를 모두 해제하면 이 참여자가 목록에서 삭제돼요. 계속할까요?',
    en: 'Clearing every showtime removes this participant from the list. Continue?',
    es: 'Si quitas todas las funciones, esta persona sale de la lista. ¿Seguir?',
  },
};

function describe(s: Showtime, locale: Locale): string {
  return `${s.movieName} · ${dateLabelShort(s.date, locale)} ${timeLabel(s.time, locale)} — ${s.format}`;
}

/** 서버가 페이지를 그리면서 미리 읽어 둔 것 (page.tsx) */
export interface GroupsInitial {
  selections: Selections;
  /** 회차 id → 이미 만들어진 모임 id */
  meetups: Record<string, string>;
}

export default function GroupsPage({ initial }: { initial: GroupsInitial }) {
  const [selections, setSelections] = useState<Selections>(initial.selections);
  // 레이아웃이 서버에서 읽어 둔 세션
  const viewer = useViewer();
  const me = viewer.user;
  const isAdmin = viewer.isAdmin;
  const [removing, setRemoving] = useState(false);
  // 회차 id → 이미 만들어진 모임 id
  const [meetups, setMeetups] = useState<Record<string, string>>(initial.meetups);
  const [making, setMaking] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const router = useRouter();
  const refresh = useRefreshSession();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPicked, setEditPicked] = useState<Set<string>>(new Set());
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const t = useT();
  const locale = useLocale();

  /** 선택 현황은 서버가 읽어 준다 — 바꾼 뒤에는 서버 렌더를 다시 돌린다 */
  function load() {
    refresh();
  }

  // 서버가 다시 그려 새 prop이 오면 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다)
  useEffect(() => {
    setSelections(initial.selections);
    setMeetups(initial.meetups);
  }, [initial]);

  /** 회차 그룹을 실제 모임으로 — 댓글·리마인더·캘린더가 그때부터 붙는다 */
  async function makeMeetup(showtimeId: string) {
    setMaking(showtimeId);
    setMsg(null);
    try {
      const res = await fetch('/api/movie/meetup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ showtimeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.makeFailed));
      if (!data.existed) setMsg({ type: 'ok', text: t(T.madeMeetup, { n: data.joined }) });
      router.push(`/p/${data.postId}`);
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.makeFailed) });
    } finally {
      setMaking(null);
    }
  }

  // 회차 정보는 각자의 선택에 스냅샷으로 들어 있어 상영표를 다시 부르지 않아도 된다
  const groups = useMemo(() => {
    const byId = new Map<string, Showtime>();
    const map = new Map<string, string[]>();
    for (const sel of Object.values(selections)) {
      for (const pick of sel.picks) {
        byId.set(pick.id, pick);
        if (!map.has(pick.id)) map.set(pick.id, []);
        map.get(pick.id)!.push(sel.name);
      }
    }
    return [...map.entries()]
      .map(([id, members]) => ({ showtime: byId.get(id)!, members: members.sort((a, b) => a.localeCompare(b, 'ko')) }))
      .sort((a, b) => {
        if (b.members.length !== a.members.length) return b.members.length - a.members.length;
        return (a.showtime.date + a.showtime.time).localeCompare(b.showtime.date + b.showtime.time);
      });
  }, [selections]);

  const matched = groups.filter((g) => g.members.length >= 2);
  const solo = groups.filter((g) => g.members.length === 1);
  const participants = Object.entries(selections)
    .map(([id, sel]) => ({ id, name: sel.name, count: sel.picks.length }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  async function removeMine() {
    if (!me) return;
    if (!confirm(t(T.confirmDeleteMine, { name: me.name }))) return;
    setRemoving(true);
    await fetch('/api/selections', { method: 'DELETE' });
    await load();
    setRemoving(false);
  }

  function startEdit(userId: string) {
    setEditMsg(null);
    setEditingId(userId);
    setEditPicked(new Set((selections[userId]?.picks ?? []).map((p) => p.id)));
  }

  function toggleEditPick(id: string) {
    setEditPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    if (editPicked.size === 0 && !confirm(t(T.confirmClearAll))) return;
    setSavingEdit(true);
    setEditMsg(null);
    try {
      const res = await fetch('/api/admin/selections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editingId, picks: [...editPicked] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.saveFailed));
      setEditingId(null);
      await load();
    } catch (e) {
      setEditMsg(e instanceof Error ? e.message : t(T.saveFailed));
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeParticipant(userId: string, name: string) {
    if (!confirm(t(T.confirmDeleteMine, { name }))) return;
    setRemoving(true);
    await fetch(`/api/admin/selections?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
    if (editingId === userId) setEditingId(null);
    await load();
    setRemoving(false);
  }

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle, { n: participants.length })}</p>

      {participants.length === 0 && (
        <div className="card">{t(T.empty)}</div>
      )}

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      {matched.length > 0 && <h2>{t(T.matched, { n: matched.length })}</h2>}
      {matched.map((g) => (
        <div key={g.showtime.id} className="card group-card">
          <span className="g-count">{g.members.length}</span>
          <div className="group-body">
            <div className="group-title">{describe(g.showtime, locale)}</div>
            {g.showtime.note && <div className="group-sub">{t(T.hurry, { note: g.showtime.note })}</div>}
            <div className="member-chips">
              {g.members.map((m, i) => (
                <span key={i} className="member-chip">{m}</span>
              ))}
            </div>
            <div className="group-actions">
              {meetups[g.showtime.id] ? (
                <Link href={`/p/${meetups[g.showtime.id]}`} className="profile-link">
                  {t(T.openMeetup)}
                </Link>
              ) : (
                me && (
                  <button
                    className="secondary"
                    disabled={making === g.showtime.id}
                    onClick={() => makeMeetup(g.showtime.id)}
                  >
                    {making === g.showtime.id ? t(T.making) : t(T.makeMeetup)}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      ))}

      {solo.length > 0 && <h2>{t(T.solo)}</h2>}
      {solo.map((g) => (
        <div key={g.showtime.id} className="card group-card solo-card">
          <span className="g-count">1</span>
          <div className="group-body">
            <div className="group-title" style={{ color: 'var(--text-dim)' }}>{describe(g.showtime, locale)}</div>
            <div className="member-chips">
              {g.members.map((m, i) => (
                <span key={i} className="member-chip">{m}</span>
              ))}
            </div>
          </div>
        </div>
      ))}

      {participants.length > 0 && (
        <>
          <h2>{t(T.participants)}</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>{t(T.colName)}</th>
                  <th>{t(T.colCount)}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td>{p.name}{me?.id === p.id && t(T.me)}</td>
                      <td>{t(T.count, { n: p.count })}</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', gap: 18 }}>
                          {isAdmin && (
                            <button
                              className="secondary"
                              style={{ fontSize: 13 }}
                              disabled={removing || savingEdit}
                              onClick={() => (editingId === p.id ? setEditingId(null) : startEdit(p.id))}
                            >
                              {editingId === p.id ? t(T.close) : t(T.editPicks)}
                            </button>
                          )}
                          {(me?.id === p.id || isAdmin) && (
                            <button
                              className="danger"
                              disabled={removing || savingEdit}
                              onClick={() => (me?.id === p.id ? removeMine() : removeParticipant(p.id, p.name))}
                            >
                              {me?.id === p.id ? t(T.delMine) : t(T.del)}
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                    {isAdmin && editingId === p.id && (
                      <tr>
                        <td colSpan={3} style={{ background: 'var(--surface-2)' }}>
                          <div style={{ padding: '6px 2px' }}>
                            <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 10 }}>
                              {t(T.editHeading, { name: p.name, n: editPicked.size })}
                            </div>
                            <div className="member-chips" style={{ marginTop: 0, gap: 8 }}>
                              {(selections[p.id]?.picks ?? []).map((s) => {
                                const on = editPicked.has(s.id);
                                return (
                                  <span
                                    key={s.id}
                                    className="member-chip"
                                    style={{
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                      borderBottom: on ? '1.5px solid var(--accent)' : '1px solid #c9c7be',
                                      color: on ? 'var(--accent)' : 'var(--text-dim)',
                                      fontWeight: on ? 600 : 500,
                                    }}
                                    onClick={() => toggleEditPick(s.id)}
                                  >
                                    {on && '✓ '}{describe(s, locale)}
                                  </span>
                                );
                              })}
                            </div>
                            {editMsg && <div className="msg err" style={{ marginBottom: 0 }}>{editMsg}</div>}
                            <div style={{ display: 'flex', gap: 18, marginTop: 14 }}>
                              <button className="secondary" disabled={savingEdit} onClick={saveEdit}>
                                {savingEdit ? t(T.saving) : t(T.save)}
                              </button>
                              <button className="secondary" disabled={savingEdit} onClick={() => setEditingId(null)}>
                                {t(T.cancel)}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
