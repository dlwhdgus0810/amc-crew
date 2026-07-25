'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES } from '@/lib/categories';

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

const GENDER_LABEL: Record<string, string> = { male: '남성', female: '여성' };

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [kakaoName, setKakaoName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editingInfo, setEditingInfo] = useState(false);
  const [bInput, setBInput] = useState('');
  const [gInput, setGInput] = useState<'male' | 'female' | ''>('');
  const [saving, setSaving] = useState(false);

  // 카카오톡 알림 동의: true=받는 중, false=받지 않음, null=확인 안 됨
  const [talkMessage, setTalkMessage] = useState<boolean | null>(null);
  const [talkBusy, setTalkBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
    ])
      .then(([auth, sub]) => {
        setUser(auth.user ?? null);
        setNickname(auth.nickname ?? null);
        setKakaoName(auth.kakaoName ?? '');
        setBirthday(auth.birthday ?? '');
        setGender(auth.gender ?? '');
        setTalkMessage(auth.kakaoTalkMessage ?? null);
        setSubs(new Set(sub.subscriptions ?? []));
      })
      .finally(() => setLoading(false));
  }, []);

  // 카카오 재동의에서 돌아왔을 때 결과 안내 (?kakao_talk=) 후 URL 정리
  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get('kakao_talk');
    if (!flag) return;
    const results: Record<string, { type: 'ok' | 'err'; text: string }> = {
      on: { type: 'ok', text: '카카오톡 알림을 켰어요.' },
      off: {
        type: 'err',
        text: '카카오톡 메시지 전송에 동의하지 않아서 알림을 켜지 못했어요. 동의 화면이 뜨지 않았다면 카카오톡 → 더보기 → 설정 → 개인/보안 → 카카오 계정 → 연결된 서비스 관리에서 동의 항목을 정리한 뒤 다시 시도해주세요.',
      },
      denied: { type: 'err', text: '카카오 화면에서 취소했어요. 언제든 다시 켤 수 있어요.' },
      unknown: { type: 'err', text: '동의 상태를 확인하지 못했어요. 아래 "상태 확인"을 눌러주세요.' },
    };
    const result = results[flag];
    if (result) setMsg(result);
    window.history.replaceState(null, '', '/profile');
  }, []);

  async function saveProfile(body: Record<string, unknown>, okText: string) {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '저장 실패');
      setUser((u) => (u ? { ...u, name: data.name } : u));
      setNickname(data.nickname ?? null);
      setKakaoName(data.kakaoName ?? '');
      setBirthday(data.birthday ?? '');
      setGender(data.gender ?? '');
      setEditingName(false);
      setEditingInfo(false);
      setMsg({ type: 'ok', text: okText });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '저장 실패' });
    } finally {
      setSaving(false);
    }
  }

  async function toggleSub(category: string) {
    const next = !subs.has(category);
    setSubs((prev) => {
      const s = new Set(prev);
      if (next) s.add(category);
      else s.delete(category);
      return s;
    });
    const res = await fetch('/api/subscriptions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, subscribed: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setSubs(new Set(data.subscriptions ?? []));
    }
  }

  /** 카카오에 실제 동의 상태를 물어 화면을 정정한다 */
  async function verifyTalk() {
    setTalkBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile/kakao-talk?verify=1');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '상태 확인 실패');
      setTalkMessage(data.status === 'on' ? true : data.status === 'off' ? false : null);
      setMsg(
        data.status === 'unknown'
          ? { type: 'err', text: '동의 상태를 확인하지 못했어요. 카카오 로그인을 다시 하면 복구돼요.' }
          : { type: 'ok', text: data.status === 'on' ? '카카오톡 알림을 받는 중이에요.' : '카카오톡 알림을 받지 않고 있어요.' }
      );
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '상태 확인 실패' });
    } finally {
      setTalkBusy(false);
    }
  }

  /** 카카오에서 talk_message 동의를 철회한다 (다시 켜려면 카카오 동의를 새로 받아야 함) */
  async function disableTalk() {
    if (!confirm('카카오톡 알림을 끌까요? 다시 켜려면 카카오 동의를 새로 받아야 해요.')) return;
    setTalkBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile/kakao-talk', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '알림 끄기 실패');
      setTalkMessage(false);
      setMsg({ type: 'ok', text: '카카오톡 알림을 껐어요. 앱 안 알림은 계속 받아요.' });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : '알림 끄기 실패' });
    } finally {
      setTalkBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  if (!user) {
    return (
      <>
        <h1>프로필</h1>
        <div className="card">
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 500 }}>
              카카오 로그인 후 프로필을 관리할 수 있어요.
            </span>
            <a className="kakao-btn" href="/api/auth/login">
              <KakaoIcon />
              카카오 로그인
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>프로필</h1>
      <p className="subtitle">닉네임, 기본 정보, 구독을 관리해요.</p>

      <h2>닉네임</h2>
      <div className="card">
        {editingName ? (
          <div>
            <div className="field-row">
              <input
                type="text"
                placeholder="닉네임"
                value={nameInput}
                maxLength={20}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !saving && saveProfile({ nickname: nameInput }, '닉네임을 저장했어요.')}
                autoFocus
              />
              <button className="secondary" disabled={saving} onClick={() => saveProfile({ nickname: nameInput }, '닉네임을 저장했어요.')}>
                {saving ? '저장 중…' : '저장'}
              </button>
              <button className="secondary" disabled={saving} onClick={() => setEditingName(false)}>
                취소
              </button>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, margin: '10px 2px 0' }}>
              비워두고 저장하면 카카오 닉네임({kakaoName})을 사용해요.
            </p>
          </div>
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 17 }}>
              {user.name}
              <span style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, marginLeft: 10 }}>
                카카오: {kakaoName}
              </span>
            </span>
            <button
              className="secondary"
              onClick={() => {
                setNameInput(nickname ?? '');
                setEditingName(true);
              }}
            >
              수정
            </button>
          </div>
        )}
      </div>

      <h2>기본 정보</h2>
      <div className="card">
        {editingInfo ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div className="field-label">생년월일</div>
              <input
                type="date"
                value={bInput}
                min="1900-01-01"
                onChange={(e) => setBInput(e.target.value)}
                style={{ maxWidth: 220 }}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <div className="field-label">성별</div>
              <div className="seg-group">
                <button className={`seg ${gInput === 'male' ? 'on' : ''}`} onClick={() => setGInput('male')}>
                  남성
                </button>
                <button className={`seg ${gInput === 'female' ? 'on' : ''}`} onClick={() => setGInput('female')}>
                  여성
                </button>
              </div>
            </div>
            <div className="field-row">
              <button
                className="secondary"
                disabled={saving || !bInput || !gInput}
                onClick={() => saveProfile({ birthday: bInput, gender: gInput }, '기본 정보를 저장했어요.')}
              >
                {saving ? '저장 중…' : '저장'}
              </button>
              <button className="secondary" disabled={saving} onClick={() => setEditingInfo(false)}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500 }}>
              {birthday || '미입력'}
              <span style={{ marginLeft: 16, color: 'var(--text-dim)' }}>{GENDER_LABEL[gender] ?? ''}</span>
            </span>
            <button
              className="secondary"
              onClick={() => {
                setBInput(birthday);
                setGInput(gender);
                setEditingInfo(true);
              }}
            >
              수정
            </button>
          </div>
        )}
      </div>

      <h2>구독 중인 취미</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
          구독한 취미에 새 모임이 올라오면 알림을 받아요.
        </p>
        <div className="field-row">
          {CATEGORIES.filter((c) => c.kind === 'posts').map((c) => (
            <button
              key={c.slug}
              className={`seg ${subs.has(c.slug) ? 'on' : ''}`}
              style={subs.has(c.slug) ? { background: c.color, borderColor: c.color, color: c.fg } : undefined}
              onClick={() => toggleSub(c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <h2>카카오톡 알림</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
          구독한 취미의 새 모임·변경·취소·댓글 알림을 카카오톡 &quot;나와의 채팅&quot;으로도 받아요.
        </p>
        <div className="field-row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500, color: talkMessage ? undefined : 'var(--text-dim)' }}>
            {talkMessage === true ? '받는 중' : talkMessage === false ? '받지 않음' : '확인 안 됨'}
          </span>
          <span className="field-row">
            {talkMessage !== true && (
              <a className="kakao-btn" href="/api/auth/login?consent=talk_message&next=/profile">
                <KakaoIcon />
                카카오톡 알림 켜기
              </a>
            )}
            {talkMessage !== false && (
              <button className="secondary" disabled={talkBusy} onClick={verifyTalk}>
                {talkBusy ? '확인 중…' : '상태 확인'}
              </button>
            )}
            {talkMessage === true && (
              <button className="danger" disabled={talkBusy} onClick={disableTalk}>
                알림 끄기
              </button>
            )}
          </span>
        </div>
        {talkMessage === null && (
          <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, margin: '12px 2px 0' }}>
            카카오톡 알림 동의 여부를 아직 확인하지 못했어요. 켜기를 누르거나 상태를 확인해주세요.
          </p>
        )}
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div style={{ marginTop: 28 }}>
        <button className="danger" onClick={logout}>
          로그아웃
        </button>
      </div>
    </>
  );
}
