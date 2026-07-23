'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Showtime, Selections } from '@/lib/types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function describe(s: Showtime): string {
  const [y, m, d] = s.date.split('-').map(Number);
  const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
  const [h, min] = s.time.split(':').map(Number);
  const ampm = h < 12 ? '오전' : '오후';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${m}/${d} (${wd}) ${ampm} ${h12}:${String(min).padStart(2, '0')} · ${s.format}`;
}

export default function GroupsPage() {
  const [schedule, setSchedule] = useState<Showtime[]>([]);
  const [selections, setSelections] = useState<Selections>({});
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState(false);

  // 관리자 편집 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPicked, setEditPicked] = useState<Set<string>>(new Set());
  const [savingEdit, setSavingEdit] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);

  async function load() {
    const data = await fetch('/api/schedule').then((r) => r.json());
    setSchedule(data.schedule ?? []);
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

  const groups = useMemo(() => {
    const byId = new Map(schedule.map((s) => [s.id, s]));
    const map = new Map<string, string[]>();
    for (const sel of Object.values(selections)) {
      for (const id of sel.showtimeIds) {
        if (!byId.has(id)) continue;
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(sel.name);
      }
    }
    return [...map.entries()]
      .map(([id, members]) => ({ showtime: byId.get(id)!, members: members.sort((a, b) => a.localeCompare(b, 'ko')) }))
      .sort((a, b) => {
        // 인원 많은 순 → 날짜/시간 순
        if (b.members.length !== a.members.length) return b.members.length - a.members.length;
        return (a.showtime.date + a.showtime.time).localeCompare(b.showtime.date + b.showtime.time);
      });
  }, [schedule, selections]);

  const matched = groups.filter((g) => g.members.length >= 2);
  const solo = groups.filter((g) => g.members.length === 1);
  const participants = Object.entries(selections)
    .map(([id, sel]) => ({ id, name: sel.name, count: sel.showtimeIds.length }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  async function removeMine() {
    if (!me) return;
    if (!confirm(`${me.name}님의 선택을 삭제할까요?`)) return;
    setRemoving(true);
    await fetch('/api/selections', { method: 'DELETE' });
    await load();
    setRemoving(false);
  }

  function startEdit(userId: string) {
    setEditMsg(null);
    setEditingId(userId);
    setEditPicked(new Set(selections[userId]?.showtimeIds ?? []));
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
    if (editPicked.size === 0 && !confirm('회차를 모두 해제하면 이 참여자가 목록에서 삭제돼요. 계속할까요?')) return;
    setSavingEdit(true);
    setEditMsg(null);
    try {
      const res = await fetch('/api/admin/selections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: editingId, showtimeIds: [...editPicked] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '저장 실패');
      setEditingId(null);
      await load();
    } catch (e) {
      setEditMsg(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeParticipant(userId: string, name: string) {
    if (!confirm(`${name}님의 선택을 삭제할까요?`)) return;
    setRemoving(true);
    await fetch(`/api/admin/selections?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
    if (editingId === userId) setEditingId(null);
    await load();
    setRemoving(false);
  }

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  return (
    <>
      <h1>그룹 매칭 결과</h1>
      <p className="subtitle">
        참여 {participants.length}명 — 같은 회차를 고른 사람들끼리 그룹으로 묶었어요. 인원이 많은 순서예요.
      </p>

      {participants.length === 0 && (
        <div className="card">아직 아무도 선택하지 않았어요. 먼저 &quot;시간 고르기&quot;에서 카카오 로그인 후 스케줄을 저장해보세요!</div>
      )}

      {matched.length > 0 && <h2>✅ 매칭된 그룹 ({matched.length})</h2>}
      {matched.map((g) => (
        <div key={g.showtime.id} className="card group-card matched">
          <div className="group-title">
            {describe(g.showtime)}
            <span className="badge match">🙋{g.members.length}명 가능</span>
          </div>
          {g.showtime.note && <div className="group-sub">⚠️ {g.showtime.note} — 예매를 서두르세요!</div>}
          <div className="member-chips">
            {g.members.map((m, i) => (
              <span key={i} className="member-chip">{m}</span>
            ))}
          </div>
        </div>
      ))}

      {solo.length > 0 && <h2>🙋 아직 혼자인 회차</h2>}
      {solo.map((g) => (
        <div key={g.showtime.id} className="card group-card">
          <div className="group-title">
            {describe(g.showtime)}
            <span className="badge solo">1명</span>
          </div>
          <div className="member-chips">
            {g.members.map((m, i) => (
              <span key={i} className="member-chip">{m}</span>
            ))}
          </div>
        </div>
      ))}

      {participants.length > 0 && (
        <>
          <h2>참여자</h2>
          <div className="card">
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>선택 회차 수</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {participants.map((p) => (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td>{p.name}{me?.id === p.id && ' (나)'}</td>
                      <td>{p.count}개</td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ display: 'inline-flex', gap: 6 }}>
                          {isAdmin && (
                            <button
                              className="secondary"
                              style={{ padding: '6px 15px', fontSize: 13 }}
                              disabled={removing || savingEdit}
                              onClick={() => (editingId === p.id ? setEditingId(null) : startEdit(p.id))}
                            >
                              {editingId === p.id ? '닫기' : '회차 수정'}
                            </button>
                          )}
                          {(me?.id === p.id || isAdmin) && (
                            <button
                              className="danger"
                              disabled={removing || savingEdit}
                              onClick={() => (me?.id === p.id ? removeMine() : removeParticipant(p.id, p.name))}
                            >
                              {me?.id === p.id ? '내 선택 삭제' : '삭제'}
                            </button>
                          )}
                        </span>
                      </td>
                    </tr>
                    {isAdmin && editingId === p.id && (
                      <tr>
                        <td colSpan={3} style={{ background: 'var(--surface-2)', borderRadius: 12 }}>
                          <div style={{ padding: '6px 2px' }}>
                            <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 10 }}>
                              {p.name}님의 가능 회차 ({editPicked.size}개 선택됨)
                            </div>
                            <div className="member-chips" style={{ marginTop: 0 }}>
                              {schedule.map((s) => {
                                const on = editPicked.has(s.id);
                                return (
                                  <span
                                    key={s.id}
                                    className="member-chip"
                                    style={{
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                      background: on ? 'var(--accent)' : '#fff',
                                      color: on ? '#fff' : 'var(--text)',
                                    }}
                                    onClick={() => toggleEditPick(s.id)}
                                  >
                                    {on && '✓ '}{describe(s)}
                                  </span>
                                );
                              })}
                            </div>
                            {editMsg && <div className="msg err" style={{ marginBottom: 0 }}>{editMsg}</div>}
                            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                              <button className="secondary" disabled={savingEdit} onClick={saveEdit}>
                                {savingEdit ? '저장 중…' : '저장'}
                              </button>
                              <button
                                className="secondary"
                                style={{ background: '#fff' }}
                                disabled={savingEdit}
                                onClick={() => setEditingId(null)}
                              >
                                취소
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
