'use client';

import { useEffect, useState } from 'react';
import { Showtime, Format } from '@/lib/types';
import { useT } from '../i18n';
import type { Msg } from '@/lib/i18n';

const FORMATS: Format[] = ['IMAX with Laser', 'Dolby Cinema', 'PRIME', 'Laser'];
const SLUG: Record<Format, string> = {
  'IMAX with Laser': 'imax',
  'Dolby Cinema': 'dolby',
  PRIME: 'prime',
  Laser: 'laser',
};

interface CategoryRequest {
  id: string;
  userName: string;
  name: string;
  color: string;
  description: string;
  featureRequest: string | null;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string | null;
}

const REQ_STATUS_LABEL: Record<CategoryRequest['status'], Msg> = {
  pending: { ko: '검토 중', en: 'In review' },
  approved: { ko: '승인됨', en: 'Approved' },
  rejected: { ko: '반려됨', en: 'Declined' },
};

const T = {
  reqTitle: { ko: '카테고리 제안', en: 'Category suggestions' },
  reqDesc: {
    ko: '사용자들이 보낸 새 카테고리 제안이에요. 승인하면 제안자에게 알림이 가고, 실제 추가는',
    en: 'Suggestions from members. Approving notifies the requester; the category goes live once you add it to',
  },
  reqDescTail: { ko: '에 항목을 넣어 배포해야 반영됩니다.', en: ' and deploy.' },
  reqEmpty: { ko: '아직 들어온 제안이 없어요.', en: 'No suggestions yet.' },
  feature: { ko: '원하는 기능', en: 'Feature request' },
  reply: { ko: '답변: {text}', en: 'Reply: {text}' },
  replyPh: { ko: '답변 (선택) — 제안자에게 함께 전달돼요', en: 'Reply (optional) — sent to the requester' },
  approve: { ko: '승인', en: 'Approve' },
  reject: { ko: '반려', en: 'Decline' },
  reviewFailed: { ko: '처리 실패', en: 'Couldn’t process' },
  approved: { ko: '승인했어요. 제안자에게 알림이 갔어요.', en: 'Approved — the requester has been notified.' },
  rejected: { ko: '반려했어요.', en: 'Declined.' },
  clearConfirm: {
    ko: '정말 모든 사람의 선택을 삭제할까요? 되돌릴 수 없어요.',
    en: 'Delete everyone’s showtime picks? This can’t be undone.',
  },
  clearFailed: { ko: '삭제 실패', en: 'Couldn’t delete' },
  cleared: { ko: '모든 선택을 삭제했어요.', en: 'All picks deleted.' },
  needDateTime: { ko: '날짜와 시간을 입력해주세요.', en: 'Enter a date and time.' },
  duplicate: { ko: '이미 있는 회차예요.', en: 'That showtime already exists.' },
  saveFailed: { ko: '저장 실패', en: 'Couldn’t save' },
  saved: { ko: '저장 완료 ({n}개 회차)', en: 'Saved ({n} showtimes)' },
  amcFailed: { ko: 'AMC 새로고침 실패', en: 'AMC refresh failed' },
  amcOk: { ko: 'AMC API에서 {n}개 회차를 가져왔어요.', en: 'Fetched {n} showtimes from the AMC API.' },
  scheduleTitle: { ko: '관리자 — 스케줄 편집', en: 'Admin — edit showtimes' },
  scheduleDesc: {
    ko: '회차를 추가/삭제한 뒤 반드시 "저장"을 눌러야 반영돼요. AMC Vendor Key가 설정되어 있다면 "AMC에서 새로고침"으로 실시간 스케줄을 가져올 수 있어요.',
    en: 'Add or remove showtimes, then press “Save” to apply. With an AMC Vendor Key set, “Refresh from AMC” pulls the live schedule.',
  },
  adminKeyPh: { ko: '관리자 키 (ADMIN_KEY)', en: 'Admin key (ADMIN_KEY)' },
  amcRefresh: { ko: '🔄 AMC에서 새로고침', en: '🔄 Refresh from AMC' },
  addShowtime: { ko: '회차 추가', en: 'Add showtime' },
  add: { ko: '추가', en: 'Add' },
  allShowtimes: { ko: '전체 회차 ({n})', en: 'All showtimes ({n})' },
  colDate: { ko: '날짜', en: 'Date' },
  colTime: { ko: '시간', en: 'Time' },
  colFormat: { ko: '포맷', en: 'Format' },
  colNote: { ko: '비고', en: 'Note' },
  del: { ko: '삭제', en: 'Delete' },
  dataTitle: { ko: '선택 데이터 관리', en: 'Pick data' },
  dataDesc: {
    ko: '카카오 관리자 계정으로 로그인되어 있어요. 모든 사람의 회차 선택을 삭제할 수 있어요.',
    en: 'You’re signed in as a Kakao admin. You can delete everyone’s showtime picks.',
  },
  clearAll: { ko: '🗑 모든 선택 삭제', en: '🗑 Delete all picks' },
  processing: { ko: '처리 중…', en: 'Working…' },
  save: { ko: '저장', en: 'Save' },
};

export default function AdminPage() {
  const [adminKey, setAdminKey] = useState('');
  const [requests, setRequests] = useState<CategoryRequest[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [schedule, setSchedule] = useState<Showtime[]>([]);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [isKakaoAdmin, setIsKakaoAdmin] = useState(false);
  const t = useT();

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
      .then((auth) => {
        setIsKakaoAdmin(Boolean(auth.isAdmin));
        if (auth.isAdmin) loadRequests();
      });
  }, []);

  async function loadRequests() {
    const res = await fetch('/api/category-requests');
    if (res.ok) setRequests((await res.json()).requests ?? []);
  }

  /** 제안 승인/반려 — 제안자에게 알림이 나간다 */
  async function review(id: string, status: 'approved' | 'rejected') {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/category-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, adminNote: notes[id] ?? '' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.reviewFailed));
      setMsg({ type: 'ok', text: status === 'approved' ? t(T.approved) : t(T.rejected) });
      await loadRequests();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.reviewFailed) });
    } finally {
      setBusy(false);
    }
  }

  async function clearAllSelections() {
    if (!window.confirm(t(T.clearConfirm))) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/selections', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.clearFailed));
      setMsg({ type: 'ok', text: t(T.cleared) });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.clearFailed) });
    } finally {
      setBusy(false);
    }
  }

  function addShowtime() {
    if (!nDate || !nTime) {
      setMsg({ type: 'err', text: t(T.needDateTime) });
      return;
    }
    const id = `${nDate}_${nTime}_${SLUG[nFormat]}`;
    if (schedule.some((s) => s.id === id)) {
      setMsg({ type: 'err', text: t(T.duplicate) });
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
      if (!res.ok) throw new Error(data.error ?? t(T.saveFailed));
      setMsg({ type: 'ok', text: t(T.saved, { n: data.count }) });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.saveFailed) });
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
      if (!res.ok) throw new Error(data.error ?? t(T.amcFailed));
      setMsg({ type: 'ok', text: t(T.amcOk, { n: data.count }) });
      const refreshed = await fetch('/api/schedule').then((r) => r.json());
      setSchedule(refreshed.schedule ?? []);
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.amcFailed) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {isKakaoAdmin && (
        <>
          <h1>{t(T.reqTitle)}</h1>
          <p className="subtitle">
            {t(T.reqDesc)}
            <code> lib/categories.ts</code>
            {t(T.reqDescTail)}
          </p>
          {requests.length === 0 ? (
            <div className="card" style={{ color: 'var(--text-dim)' }}>{t(T.reqEmpty)}</div>
          ) : (
            requests.map((r) => (
              <div key={r.id} className="card">
                <div className="field-row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 12, fontWeight: 600 }}>
                    <span className="feed-dot" style={{ background: r.color }} />
                    {r.name}
                    <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>
                      {r.description} · {r.color} · {r.userName}
                    </span>
                  </span>
                  <span className={`req-status ${r.status}`}>{t(REQ_STATUS_LABEL[r.status])}</span>
                </div>
                {r.featureRequest && (
                  <div style={{ marginTop: 10, fontSize: 14 }}>
                    <strong>{t(T.feature)}</strong>
                    <div style={{ color: 'var(--text-dim)', whiteSpace: 'pre-wrap' }}>{r.featureRequest}</div>
                  </div>
                )}
                {r.adminNote && (
                  <div style={{ marginTop: 10, fontSize: 14 }}>{t(T.reply, { text: r.adminNote })}</div>
                )}
                {r.status === 'pending' && (
                  <div className="field-row" style={{ marginTop: 14 }}>
                    <input
                      type="text"
                      placeholder={t(T.replyPh)}
                      value={notes[r.id] ?? ''}
                      maxLength={500}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      style={{ maxWidth: 420 }}
                    />
                    <button disabled={busy} onClick={() => review(r.id, 'approved')}>{t(T.approve)}</button>
                    <button className="danger" disabled={busy} onClick={() => review(r.id, 'rejected')}>
                      {t(T.reject)}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}

      <h1 style={{ marginTop: isKakaoAdmin ? 80 : 0 }}>{t(T.scheduleTitle)}</h1>
      <p className="subtitle">
        {t(T.scheduleDesc)}
      </p>

      <div className="card">
        <div className="field-row">
          <input
            type="password"
            placeholder={t(T.adminKeyPh)}
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            style={{ maxWidth: 260 }}
          />
          <button className="secondary" disabled={busy || !adminKey} onClick={refreshFromAmc}>
            {t(T.amcRefresh)}
          </button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t(T.addShowtime)}</h2>
        <div className="field-row">
          <input type="date" value={nDate} onChange={(e) => setNDate(e.target.value)} style={{ maxWidth: 170 }} />
          <input type="time" value={nTime} onChange={(e) => setNTime(e.target.value)} style={{ maxWidth: 140 }} />
          <select value={nFormat} onChange={(e) => setNFormat(e.target.value as Format)} style={{ maxWidth: 200 }}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
          <button className="secondary" onClick={addShowtime}>{t(T.add)}</button>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0 }}>{t(T.allShowtimes, { n: schedule.length })}</h2>
        <table>
          <thead>
            <tr>
              <th>{t(T.colDate)}</th>
              <th>{t(T.colTime)}</th>
              <th>{t(T.colFormat)}</th>
              <th>{t(T.colNote)}</th>
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
                  <button className="danger" onClick={() => removeShowtime(s.id)}>{t(T.del)}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isKakaoAdmin && (
        <div className="card">
          <h2 style={{ marginTop: 0 }}>{t(T.dataTitle)}</h2>
          <p className="subtitle" style={{ marginBottom: 14 }}>
            {t(T.dataDesc)}
          </p>
          <button className="danger" disabled={busy} onClick={clearAllSelections}>
            {t(T.clearAll)}
          </button>
        </div>
      )}

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <button disabled={busy || !adminKey} onClick={save}>
        {busy ? t(T.processing) : t(T.save)}
      </button>
    </>
  );
}
