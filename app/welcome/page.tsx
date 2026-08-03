'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from '../i18n';
import { LOCALES, LOCALE_NAMES, Locale, Msg, pick } from '@/lib/i18n';

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  welcome: { ko: '환영해요, {name}님! 👋', en: 'Welcome, {name}! 👋' },
  subtitle: {
    ko: '시작하기 전에 몇 가지만 알려주세요. 프로필에서 언제든 수정할 수 있어요.',
    en: 'Just a few things before you start. You can change any of these later in your profile.',
  },
  language: { ko: '언어', en: 'Language' },
  birthday: { ko: '생년월일', en: 'Date of birth' },
  gender: { ko: '성별', en: 'Gender' },
  male: { ko: '남성', en: 'Male' },
  female: { ko: '여성', en: 'Female' },
  start: { ko: '시작하기', en: 'Get started' },
  saving: { ko: '저장 중…', en: 'Saving…' },
  saveFailed: { ko: '저장 실패', en: 'Couldn’t save' },
};

/** 온보딩 완료 후 복귀할 경로 (?next=, 사이트 내 경로만) — 공유 링크로 유입된 신규 사용자용 */
function nextPath(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/';
}

export default function WelcomePage() {
  const router = useRouter();
  const [kakaoName, setKakaoName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /*
   * 언어는 저장하기 전에도 이 화면에 바로 반영한다.
   * 고르자마자 서버에 넣고 새로고침하면 적어둔 생년월일이 날아가므로,
   * 화면은 여기서 바꾸고 서버에는 「시작하기」에서 나머지와 함께 보낸다.
   */
  const initialLocale = useLocale();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const t = (msg: Msg, vars?: Record<string, string | number>) => pick(locale, msg, vars);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => {
        if (!auth.user || !auth.needsOnboarding) {
          router.replace(nextPath());
          return;
        }
        setKakaoName(auth.kakaoName || auth.user.name);
        setBirthday(auth.birthday ?? '');
        setGender(auth.gender ?? '');
        if (auth.locale) setLocale(auth.locale);
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
        body: JSON.stringify({ birthday, gender, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.saveFailed));
      /*
       * 언어를 바꿨으면 통째로 다시 연다. 상단 바와 제목은 서버가 쿠키를 보고 그리는데,
       * 화면만 갈아끼우면 그것들이 이전 언어로 남는다.
       */
      if (locale !== initialLocale) window.location.replace(nextPath());
      else router.replace(nextPath());
    } catch (e) {
      setErr(e instanceof Error ? e.message : t(T.saveFailed));
      setSaving(false);
    }
  }

  if (loading) return <p className="subtitle">{t(T.loading)}</p>;

  return (
    <>
      <h1>{t(T.welcome, { name: kakaoName })}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

      <div className="card">
        <div style={{ marginBottom: 18 }}>
          <div className="field-label">{t(T.language)}</div>
          <div className="seg-group">
            {LOCALES.map((l) => (
              <button key={l} className={`seg ${locale === l ? 'on' : ''}`} onClick={() => setLocale(l)}>
                {LOCALE_NAMES[l]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div className="field-label">{t(T.birthday)}</div>
          <input
            type="date"
            value={birthday}
            min="1900-01-01"
            onChange={(e) => setBirthday(e.target.value)}
            style={{ maxWidth: 220 }}
          />
        </div>

        <div>
          <div className="field-label">{t(T.gender)}</div>
          <div className="seg-group">
            <button className={`seg ${gender === 'male' ? 'on' : ''}`} onClick={() => setGender('male')}>
              {t(T.male)}
            </button>
            <button className={`seg ${gender === 'female' ? 'on' : ''}`} onClick={() => setGender('female')}>
              {t(T.female)}
            </button>
          </div>
        </div>
      </div>

      {err && <div className="msg err">{err}</div>}

      <button style={{ width: '100%' }} disabled={saving || !birthday || !gender} onClick={submit}>
        {saving ? t(T.saving) : t(T.start)}
      </button>
    </>
  );
}
