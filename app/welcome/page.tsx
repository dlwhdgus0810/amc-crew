'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useViewer } from '../session';
import { useLocale } from '../i18n';
import { setLocaleCookie } from '../lang-pick';
import { LOCALES, LOCALE_NAMES, Locale, Msg, pick } from '@/lib/i18n';

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…', es: 'Cargando…' },
  welcome: { ko: '환영해요, {name}님! 👋', en: 'Welcome, {name}! 👋', es: '¡Bienvenido, {name}! 👋' },
  subtitle: {
    ko: '시작하기 전에 몇 가지만 알려주세요. 프로필에서 언제든 수정할 수 있어요.',
    en: 'Just a few things before you start. You can change any of these later in your profile.',
    es: 'Solo un par de cosas antes de empezar. Podrás cambiarlas luego en tu perfil.',
  },
  language: { ko: '언어', en: 'Language', es: 'Idioma' },
  nickname: { ko: '닉네임', en: 'Nickname', es: 'Apodo' },
  nicknameHint: {
    ko: '비워두면 카카오톡 닉네임({name})을 그대로 써요.',
    en: 'Leave it empty to use your Kakao nickname ({name}).',
    es: 'Déjalo vacío para usar tu apodo de Kakao ({name}).',
  },
  birthday: { ko: '생년월일', en: 'Date of birth', es: 'Fecha de nacimiento' },
  gender: { ko: '성별', en: 'Gender', es: 'Género' },
  male: { ko: '남성', en: 'Male', es: 'Hombre' },
  female: { ko: '여성', en: 'Female', es: 'Mujer' },
  start: { ko: '시작하기', en: 'Get started', es: 'Empezar' },
  saving: { ko: '저장 중…', en: 'Saving…', es: 'Guardando…' },
  saveFailed: { ko: '저장 실패', en: 'Couldn’t save', es: 'No se pudo guardar' },
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
  const [nickname, setNickname] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /*
   * 언어는 저장하기 전에도 이 화면에 바로 반영한다.
   * 고르자마자 서버에 넣고 새로고침하면 적어둔 생년월일이 날아가므로,
   * 화면은 여기서 바꾸고 서버에는 「시작하기」에서 나머지와 함께 보낸다.
   *
   * 다만 탭바·상단 바는 서버가 쿠키를 보고 그린다. 그래서 고르는 순간 쿠키에도 적고
   * router.refresh()로 서버 쪽만 다시 그린다 — 이 화면의 입력값은 그대로 남는다.
   * 로그인 전 홈에서 고른 언어(app/lang-pick.tsx)도 같은 쿠키라 여기 첫 값이 된다.
   */
  const initialLocale = useLocale();
  const [locale, setLocale] = useState<Locale>(initialLocale);
  function pickLocale(next: Locale) {
    setLocale(next);
    setLocaleCookie(next);
    router.refresh();
  }
  const t = (msg: Msg, vars?: Record<string, string | number>) => pick(locale, msg, vars);

  /*
   * 폼의 첫 값은 레이아웃이 서버에서 읽어 둔 세션에서 가져온다 —
   * 물어보고 답을 기다리는 동안 빈 화면을 보여주지 않는다.
   */
  const viewer = useViewer();
  /*
   * 폼은 **처음 한 번만** 채운다. 언어를 고르면 router.refresh()로 서버가 세션을 다시
   * 읽어 viewer가 새 객체로 오는데, 그때마다 여기서 다시 채우면 적어 둔 닉네임·생일이
   * 빈 값으로 돌아간다 (실제로 그랬다). 되돌아갈지는 매번 보고, 값은 한 번만 넣는다.
   */
  const seeded = useRef(false);
  useEffect(() => {
    if (!viewer.user || !viewer.needsOnboarding) {
      router.replace(nextPath());
      return;
    }
    if (seeded.current) return;
    seeded.current = true;
    setKakaoName(viewer.kakaoName || viewer.user.name);
    setNickname(viewer.nickname ?? '');
    setBirthday(viewer.birthday ?? '');
    setGender((viewer.gender as '' | 'male' | 'female') ?? '');
    if (viewer.locale) setLocale(viewer.locale as Locale);
    setLoading(false);
  }, [viewer, router]);

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // 닉네임은 비워서 보내도 된다 — 서버가 빈 값을 「카카오톡 닉네임 쓰기」로 받는다
        body: JSON.stringify({ birthday, gender, locale, nickname: nickname.trim() }),
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
      <h1>{t(T.welcome, { name: nickname.trim() || kakaoName })}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

      <div className="card">
        <div style={{ marginBottom: 18 }}>
          <div className="field-label">{t(T.language)}</div>
          <div className="seg-group">
            {LOCALES.map((l) => (
              <button key={l} className={`seg ${locale === l ? 'on' : ''}`} onClick={() => pickLocale(l)}>
                {LOCALE_NAMES[l]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <div className="field-label">{t(T.nickname)}</div>
          <input
            type="text"
            value={nickname}
            maxLength={20}
            placeholder={kakaoName}
            onChange={(e) => setNickname(e.target.value)}
          />
          <p className="subtitle" style={{ marginTop: 6, fontSize: 13 }}>
            {t(T.nicknameHint, { name: kakaoName })}
          </p>
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
