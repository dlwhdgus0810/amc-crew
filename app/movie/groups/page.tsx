'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Showtime, Selections } from '@/lib/types';
import { useLocale, useT } from '../../i18n';
import { dateLabelShort, timeLabel } from '@/lib/datefmt';
import { Locale } from '@/lib/i18n';

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  title: { ko: '그룹', en: 'Groups' },
  subtitle: {
    ko: '같은 회차를 고른 사람들 — 참여 {n}명. 인원이 많은 순서예요.',
    en: 'People who picked the same showtime — {n} participating, largest groups first.',
  },
  empty: {
    ko: '아직 아무도 선택하지 않았어요. 먼저 "시간 고르기"에서 스케줄을 저장해보세요.',
    en: 'Nobody has picked yet. Save your picks in “Showtimes” first.',
  },
  matched: { ko: 'Matched — 매칭된 그룹 ({n})', en: 'Matched — groups ({n})' },
  solo: { ko: 'Solo — 아직 혼자인 회차', en: 'Solo — nobody else yet' },
  hurry: { ko: '{note} — 예매를 서두르세요', en: '{note} — book soon' },
  participants: { ko: '참여자', en: 'Participants' },
  colName: { ko: '이름', en: 'Name' },
  colCount: { ko: '선택 회차 수', en: 'Showtimes picked' },
  count: { ko: '{n}개', en: '{n}' },
  me: { ko: ' (나)', en: ' (you)' },
  close: { ko: '닫기', en: 'Close' },
  editPicks: { ko: '회차 수정', en: 'Edit picks' },
  delMine: { ko: '내 선택 삭제', en: 'Delete my picks' },
  del: { ko: '삭제', en: 'Delete' },
  editHeading: { ko: '{name}님의 가능 회차 ({n}개 선택됨)', en: '{name}’s showtimes ({n} selected)' },
  save: { ko: '저장', en: 'Save' },
  saving: { ko: '저장 중…', en: 'Saving…' },
  cancel: { ko: '취소', en: 'Cancel' },
  saveFailed: { ko: '저장 실패', en: 'Couldn’t save' },
  confirmDeleteMine: { ko: '{name}님의 선택을 삭제할까요?', en: 'Delete {name}’s picks?' },
  confirmClearAll: {
    ko: '회차를 모두 해제하면 이 참여자가 목록에서 삭제돼요. 계속할까요?',
    en: 'Clearing every showtime removes this participant from the list. Continue?',
  },
};

function describe(s: Showtime, locale: Locale): string {
  return `${s.movieName} · ${dateLabelShort(s.date, locale)} ${timeLabel(s.time, locale)} — ${s.format}`;
}

export default function GroupsPage() {
  const [selections, setSelections] = useState<Selections>({});
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPicked, setEditPicked] = useState<Set<string>>(new Set());
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const t = useT();
  const locale = useLocale();

  async function load() {
    const data = await fetch('/api/schedule').then((r) => r.json());
    setSelections(data.selections ?? {});
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => {
        setMe(auth.user ?? null);
        setIsAdmin(Boolean(auth.isAdmin));
      });
  }, []);

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

  if (loading) return <p className="subtitle">{t(T.loading)}</p>;

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle, { n: participants.length })}</p>

      {participants.length === 0 && (
        <div className="card">{t(T.empty)}</div>
      )}

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
