'use client';

import { useEffect, useState } from 'react';
import { Showtime, Format } from '@/lib/types';

const FORMATS: Format[] = ['IMAX with Laser', 'Dolby Cinema', 'PRIME', 'Laser'];
const SLUG: Record<Format, string> = {
  'IMAX with Laser': 'imax',
  'Dolby Cinema': 'dolby',
  PRIME: 'prime',
  Laser: 'laser',
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [schedule, setSchedule] = useState<Showtime[]>([]);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [isKakaoAdmin, setIsKakaoAdmin] = useState(false);

  // 새 회차 입력 폼
  const [nDate, setNDate] = useState('');
  const [nTime, setNTime] = useState('');
  const [nFormat, setNFormat] = useState<Format>('IMAX with Laser');

  useEffect(() => {
    fetch('/api/schedule')
      .then((r) => r.json())
      .then((data) => setSchedule(data.schedule ?? []));
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => setIsKakaoAdmin(Boolean(auth.isAdmin)));
  }, []);

  async function clearAllSelections() {
    if (!window.confirm('정말 모든 사람의 선택을 삭제할까요? 되돌릴 수 없어요.')) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/selections', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '삭제 실패');
      setMsg({ type: 'ok', text: '모든 선택을 삭제했어요.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '삭제 실패' });
    } finally {
      setBusy(false);
    }
  }

  function addShowtime() {
    if (!nDate || !nTime) {
      setMsg({ type: 'err', text: '날짜와 시간을 입력해주세요.' });
      return;
    }
    const id = `${nDate}_${nTime}_${SLUG[nFormat]}`;
    if (schedule.some((s) => s.id === id)) {
      setMsg({ type: 'err', text: '이미 있는 회차예요.' });
      return;
    }
    setSchedule(
      [...schedule, { id, date: nDate, time: nTime, format: nFormat }].sort((a, b) =>
        (a.date + a.time).localeCompare(b.date + b.time)
      )
    );
    setMsg(null);
  }

  function removeShowtime(id: string) {
    setSchedule(schedule.filter((s) => s.id !== id));
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ schedule }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '저장 실패');
      setMsg({ type: 'ok', text: `저장 완료 (${data.count}개 회차)` });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '저장 실패' });
    } finally {
      setBusy(false);
    }
  }

  async function refreshFromAmc() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/refresh', {
        method: 'POST',
        headers: { 'x-admin-key': adminKey },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'AMC 새로고침 실패');
      setMsg({ type: 'ok', text: `AMC API에서 ${data.count}개 회차를 가져왔어요.` });
      const refreshed = await fetch('/api/schedule').then((r) => r.json());
      setSchedule(refreshed.schedule ?? []);
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : 'AMC 새로고침 실패' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>관리자 — 스케줄 편집</h1>
      <p className="subtitle">
        회차를 추가/삭제한 뒤 반드시 &quot;저장&quot;을 눌러야 반영돼요. AMC Vendor Key가 설정되어 있다면
        &quot;AMC에서 새로고침&quot;으로 실시간 스케줄을 가져올 수 있어요.
      </p>

      <div className="card">
        <div className="field-row">
          <input
            type="password"
            placeholder="관리자 키 (ADMIN_KEY)"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button className="secondary" disabled={busy || !adminKey} onClick={refreshFromAmc}>
            🔄 AMC에서 새로고침
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>회차 추가</h2>
        <div className="field-row">
          <input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} style={{ maxWidth: 170 }} />
          <input type="time" value={nTime} onChange={(e) => setNTime(e.target.value)} style={{ maxWidth: 140 }} />
          <select value={nFormat} onChange={(e) => setNFormat(e.target.value as Format)} style={{ maxWidth: 200 }}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <button className="secondary" onClick={addShowtime}>추가</button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>전체 회차 ({schedule.length})</h2>
        <table>
          <thead>
            <tr>
              <th>날짜</th>
              <th>시간</th>
              <th>포맷</th>
              <th>비고</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {schedule.map((s) => (
              <tr key={s.id}>
                <td>{s.date}</td>
                <td>{s.time}</td>
                <td>{s.format}</td>
                <td>{s.note ?? ''}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="danger" onClick={() => removeShowtime(s.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isKakaoAdmin && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>선택 데이터 관리</h2>
          <p className="subtitle" style={{ marginBottom: 14 }}>
            카카오 관리자 계정으로 로그인되어 있어요. 모든 사람의 회차 선택을 삭제할 수 있어요.
          </p>
          <button className="danger" disabled={busy} onClick={clearAllSelections}>
            🗑 모든 선택 삭제
          </button>
        </div>
      )}

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <button disabled={busy || !adminKey} onClick={save}>
        {busy ? '처리 중…' : '저장'}
      </button>
    </>
  );
}
