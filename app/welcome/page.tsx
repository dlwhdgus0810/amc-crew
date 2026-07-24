'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function WelcomePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => {
        if (!auth.user || !auth.needsOnboarding) {
          router.replace('/');
          return;
        }
        setName(auth.user.name);
        setBirthday(auth.birthday ?? '');
        setGender(auth.gender ?? '');
        setLoading(false);
      });
  }, [router]);

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthday, gender }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? '저장 실패');
      router.replace('/');
    } catch (e) {
      setErr(e instanceof Error ? e.message : '저장 실패');
      setSaving(false);
    }
  }

  if (loading) return <p className="subtitle">불러오는 중…</p>;

  return (
    <>
      <h1>환영해요, {name}님! 👋</h1>
      <p className="subtitle">시작하기 전에 생년월일과 성별을 알려주세요. 프로필에서 언제든 수정할 수 있어요.</p>

      <div className="card">
        <div style={{ marginBottom: 18 }}>
          <div className="field-label">생년월일</div>
          <input
            type="date"
            value={birthday}
            min="1900-01-01"
            onChange={(e) => setBirthday(e.target.value)}
            style={{ maxWidth: 220 }}
          />
        </div>
        <div>
          <div className="field-label">성별</div>
          <div className="seg-group">
            <button className={`seg ${gender === 'male' ? 'on' : ''}`} onClick={() => setGender('male')}>
              남성
            </button>
            <button className={`seg ${gender === 'female' ? 'on' : ''}`} onClick={() => setGender('female')}>
              여성
            </button>
          </div>
        </div>
      </div>

      {err && <div className="msg err">{err}</div>}

      <button style={{ width: '100%' }} disabled={saving || !birthday || !gender} onClick={submit}>
        {saving ? '저장 중…' : '시작하기'}
      </button>
    </>
  );
}
