'use client';

import {useEffect, useMemo, useState} from 'react';
import {Selections, Showtime} from '@/lib/types';

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
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState('');

  async function load() {
    const data = await fetch('/api/schedule').then((r) => r.json());
    setSchedule(data.schedule ?? []);
    setSelections(data.selections ?? {});
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => {
    const byId = new Map(schedule.map((s) => [s.id, s]));
    const map = new Map<string, string[]>();
    for (const [user, ids] of Object.entries(selections)) {
      for (const id of ids) {
        if (!byId.has(id)) continue;
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(user);
      }
    }
    return [...map.entries()]
      .map(([id, members]) => ({ showtime: byId.get(id)!, members: members.sort() }))
      .sort((a, b) => {
        // 인원 많은 순 → 날짜/시간 순
        if (b.members.length !== a.members.length) return b.members.length - a.members.length;
        return (a.showtime.date + a.showtime.time).localeCompare(b.showtime.date + b.showtime.time);
      });
  }, [schedule, selections]);

  const matched = groups.filter((g) => g.members.length >= 2);
  const solo = groups.filter((g) => g.members.length === 1);
  const participants = Object.keys(selections).sort();

  async function remove(user: string) {
    if (!confirm(`${user}님의 선택을 삭제할까요?`)) return;
    setRemoving(user);
    await fetch(`/api/selections?name=${encodeURIComponent(user)}`, { method: 'DELETE' });
    await load();
    setRemoving('');
  }

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  return (
    <>
      <h1>그룹 매칭 결과</h1>
      <p className="subtitle">
        참여 {participants.length}명 — 같은 회차를 고른 사람들끼리 그룹으로 묶었어요. 인원이 많은 순서예요.
      </p>

      {participants.length === 0 && (
        <div className="card">아직 아무도 선택하지 않았어요. 먼저 &quot;시간 고르기&quot;에서 스케줄을 저장해보세요!</div>
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
            {g.members.map((m) => (
              <span key={m} className="member-chip">{m}</span>
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
            {g.members.map((m) => (
              <span key={m} className="member-chip">{m}</span>
            ))}
          </div>
        </div>
      ))}

      {participants.length > 0 && (
        <>
          <h2>참여자 관리</h2>
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
                  <tr key={p}>
                    <td>{p}</td>
                    <td>{selections[p].length}개</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="danger" disabled={removing === p} onClick={() => remove(p)}>
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
