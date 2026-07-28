'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIES } from '@/lib/categories';
import { useLocale, useT } from '../i18n';
import { PROFILE_UPDATED } from '../nav';
import { LOCALES, LOCALE_NAMES, Locale } from '@/lib/i18n';

/** 저장할 사진 한 변의 길이 (px) */
const AVATAR_PX = 256;

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  title: { ko: '프로필', en: 'Profile' },
  subtitle: {
    ko: '사진, 닉네임, 기본 정보, 언어, 구독을 관리해요.',
    en: 'Manage your photo, nickname, basic info, language and subscriptions.',
  },
  loginPrompt: {
    ko: '카카오 로그인 후 프로필을 관리할 수 있어요.',
    en: 'Log in with Kakao to manage your profile.',
  },
  kakaoLogin: { ko: '카카오 로그인', en: 'Log in with Kakao' },
  photo: { ko: '프로필 사진', en: 'Profile photo' },
  photoPick: { ko: '사진 고르기', en: 'Choose a photo' },
  photoChange: { ko: '사진 바꾸기', en: 'Change photo' },
  photoRemove: { ko: '사진 지우기', en: 'Remove photo' },
  photoHint: {
    ko: '정사각형으로 잘라 256px로 줄여서 저장해요. 지우면 이름 첫 글자가 보여요.',
    en: 'Cropped square and stored at 256px. Remove it to fall back to your initial.',
  },
  photoSaved: { ko: '프로필 사진을 저장했어요.', en: 'Profile photo saved.' },
  photoRemoved: { ko: '프로필 사진을 지웠어요.', en: 'Profile photo removed.' },
  photoBad: { ko: '이미지 파일만 올릴 수 있어요.', en: 'Only image files can be uploaded.' },
  nickname: { ko: '닉네임', en: 'Nickname' },
  nicknamePh: { ko: '닉네임', en: 'Nickname' },
  nicknameSaved: { ko: '닉네임을 저장했어요.', en: 'Nickname saved.' },
  nicknameHint: {
    ko: '비워두고 저장하면 카카오 닉네임({name})을 사용해요.',
    en: 'Leave it empty to use your Kakao nickname ({name}).',
  },
  kakaoNamePrefix: { ko: '카카오: {name}', en: 'Kakao: {name}' },
  basicInfo: { ko: '기본 정보', en: 'Basic info' },
  basicInfoSaved: { ko: '기본 정보를 저장했어요.', en: 'Basic info saved.' },
  birthday: { ko: '생년월일', en: 'Date of birth' },
  gender: { ko: '성별', en: 'Gender' },
  male: { ko: '남성', en: 'Male' },
  female: { ko: '여성', en: 'Female' },
  notEntered: { ko: '미입력', en: 'Not set' },
  language: { ko: '언어', en: 'Language' },
  languageDesc: {
    ko: '앱 화면과 알림 문구에 쓰이는 언어예요.',
    en: 'Used for the app interface and notification messages.',
  },
  languageSaved: { ko: '언어를 바꿨어요.', en: 'Language updated.' },
  subs: { ko: '구독 중인 취미', en: 'Subscribed hobbies' },
  subsDesc: {
    ko: '구독한 취미에 새 모임이 올라오면 알림을 받아요.',
    en: 'Get notified when a new meetup is posted in these hobbies.',
  },
  kakaoTalk: { ko: '카카오톡 알림', en: 'KakaoTalk alerts' },
  kakaoTalkDesc: {
    ko: '구독한 취미의 새 모임·변경·취소·댓글 알림을 카카오톡 "나와의 채팅"으로도 받아요.',
    en: 'Also receive new/updated/cancelled meetup and comment alerts in your KakaoTalk chat with yourself.',
  },
  talkOn: { ko: '받는 중', en: 'On' },
  talkOff: { ko: '받지 않음', en: 'Off' },
  talkUnknown: { ko: '확인 안 됨', en: 'Unknown' },
  talkEnable: { ko: '카카오톡 알림 켜기', en: 'Turn on KakaoTalk alerts' },
  talkCheck: { ko: '상태 확인', en: 'Check status' },
  talkChecking: { ko: '확인 중…', en: 'Checking…' },
  talkDisable: { ko: '알림 끄기', en: 'Turn off' },
  talkUnknownHint: {
    ko: '카카오톡 알림 동의 여부를 아직 확인하지 못했어요. 켜기를 누르거나 상태를 확인해주세요.',
    en: 'We haven’t confirmed your KakaoTalk consent yet. Turn it on or check the status.',
  },
  talkConfirmOff: {
    ko: '카카오톡 알림을 끌까요? 다시 켜려면 카카오 동의를 새로 받아야 해요.',
    en: 'Turn off KakaoTalk alerts? You’ll have to grant Kakao consent again to turn them back on.',
  },
  talkTurnedOff: {
    ko: '카카오톡 알림을 껐어요. 앱 안 알림은 계속 받아요.',
    en: 'KakaoTalk alerts are off. You’ll still get in-app alerts.',
  },
  talkOnMsg: { ko: '카카오톡 알림을 받는 중이에요.', en: 'KakaoTalk alerts are on.' },
  talkOffMsg: { ko: '카카오톡 알림을 받지 않고 있어요.', en: 'KakaoTalk alerts are off.' },
  talkCheckFailed: {
    ko: '동의 상태를 확인하지 못했어요. 카카오 로그인을 다시 하면 복구돼요.',
    en: 'Couldn’t confirm consent. Logging in with Kakao again will fix it.',
  },
  talkCheckError: { ko: '상태 확인 실패', en: 'Status check failed' },
  talkOffError: { ko: '알림 끄기 실패', en: 'Couldn’t turn alerts off' },
  resultOn: { ko: '카카오톡 알림을 켰어요.', en: 'KakaoTalk alerts are on.' },
  resultOff: {
    ko: '카카오톡 메시지 전송에 동의하지 않아서 알림을 켜지 못했어요. 동의 화면이 뜨지 않았다면 카카오톡 → 더보기 → 설정 → 개인/보안 → 카카오 계정 → 연결된 서비스 관리에서 동의 항목을 정리한 뒤 다시 시도해주세요.',
    en: 'You didn’t consent to KakaoTalk messages, so alerts stay off. If the consent screen never appeared, clear the app’s consent items in KakaoTalk → More → Settings → Privacy → Kakao Account → Linked Services, then try again.',
  },
  resultDenied: {
    ko: '카카오 화면에서 취소했어요. 언제든 다시 켤 수 있어요.',
    en: 'You cancelled on the Kakao screen. You can turn it on anytime.',
  },
  resultUnknown: {
    ko: '동의 상태를 확인하지 못했어요. 아래 "상태 확인"을 눌러주세요.',
    en: 'Couldn’t confirm consent. Tap “Check status” below.',
  },
  edit: { ko: '수정', en: 'Edit' },
  save: { ko: '저장', en: 'Save' },
  saving: { ko: '저장 중…', en: 'Saving…' },
  cancel: { ko: '취소', en: 'Cancel' },
  saveFailed: { ko: '저장 실패', en: 'Couldn’t save' },
  logout: { ko: '로그아웃', en: 'Log out' },
};

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

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [nickname, setNickname] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
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
  const t = useT();
  const locale = useLocale();
  const genderLabel = (g: string) => (g === 'male' ? t(T.male) : g === 'female' ? t(T.female) : '');

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
    ])
      .then(([auth, sub]) => {
        setUser(auth.user ?? null);
        setNickname(auth.nickname ?? null);
        setAvatar(auth.avatar ?? null);
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
      on: { type: 'ok', text: t(T.resultOn) },
      off: { type: 'err', text: t(T.resultOff) },
      denied: { type: 'err', text: t(T.resultDenied) },
      unknown: { type: 'err', text: t(T.resultUnknown) },
    };
    const result = results[flag];
    if (result) setMsg(result);
    window.history.replaceState(null, '', '/profile');
  }, []);

  /** 고른 사진을 정사각형으로 잘라 256px JPEG data URL로 줄인다 (원본을 그대로 담지 않기 위해) */
  function shrink(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const side = Math.min(img.width, img.height);
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = AVATAR_PX;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image'));
      };
      img.src = url;
    });
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setMsg({ type: 'err', text: t(T.photoBad) });
      return;
    }
    try {
      const dataUrl = await shrink(file);
      await saveProfile({ avatar: dataUrl }, t(T.photoSaved));
    } catch {
      setMsg({ type: 'err', text: t(T.photoBad) });
    }
  }

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
      if (!res.ok) throw new Error(data.error ?? t(T.saveFailed));
      setUser((u) => (u ? { ...u, name: data.name } : u));
      setNickname(data.nickname ?? null);
      if (data.avatar !== undefined) setAvatar(data.avatar);
      setKakaoName(data.kakaoName ?? '');
      setBirthday(data.birthday ?? '');
      setGender(data.gender ?? '');
      setEditingName(false);
      setEditingInfo(false);
      setMsg({ type: 'ok', text: okText });
      window.dispatchEvent(new Event(PROFILE_UPDATED)); // 탭바 아바타·이름 갱신
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.saveFailed) });
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
      if (!res.ok) throw new Error(data.error ?? t(T.talkCheckError));
      setTalkMessage(data.status === 'on' ? true : data.status === 'off' ? false : null);
      setMsg(
        data.status === 'unknown'
          ? { type: 'err', text: t(T.talkCheckFailed) }
          : { type: 'ok', text: data.status === 'on' ? t(T.talkOnMsg) : t(T.talkOffMsg) }
      );
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.talkCheckError) });
    } finally {
      setTalkBusy(false);
    }
  }

  /** 카카오에서 talk_message 동의를 철회한다 (다시 켜려면 카카오 동의를 새로 받아야 함) */
  async function disableTalk() {
    if (!confirm(t(T.talkConfirmOff))) return;
    setTalkBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile/kakao-talk', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.talkOffError));
      setTalkMessage(false);
      setMsg({ type: 'ok', text: t(T.talkTurnedOff) });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.talkOffError) });
    } finally {
      setTalkBusy(false);
    }
  }

  /** 언어 변경 — 서버 렌더(레이아웃·메타데이터)까지 새 언어로 그리려면 새로고침이 필요하다 */
  async function changeLocale(next: Locale) {
    if (next === locale || saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.saveFailed));
      window.location.reload();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.saveFailed) });
      setSaving(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  if (loading) return <p className="subtitle">{t(T.loading)}</p>;

  if (!user) {
    return (
      <>
        <h1>{t(T.title)}</h1>
        <div className="card">
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 500 }}>
              {t(T.loginPrompt)}
            </span>
            <a className="kakao-btn" href="/api/auth/login">
              <KakaoIcon />
              {t(T.kakaoLogin)}
            </a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

      <h2>{t(T.photo)}</h2>
      <div className="card">
        <div className="field-row" style={{ gap: 16 }}>
          <span className="avatar-lg">
            {avatar ? <img src={avatar} alt="" /> : (user.name.slice(0, 1) || '·')}
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="secondary photo-pick">
                {avatar ? t(T.photoChange) : t(T.photoPick)}
                <input
                  type="file"
                  accept="image/*"
                  disabled={saving}
                  onChange={(e) => {
                    pickPhoto(e.target.files?.[0]);
                    e.target.value = ''; // 같은 파일을 다시 골라도 반응하도록
                  }}
                />
              </label>
              {avatar && (
                <button className="danger" disabled={saving} onClick={() => saveProfile({ avatar: null }, t(T.photoRemoved))}>
                  {t(T.photoRemove)}
                </button>
              )}
            </span>
            <span className="hint">{t(T.photoHint)}</span>
          </span>
        </div>
      </div>

      <h2>{t(T.nickname)}</h2>
      <div className="card">
        {editingName ? (
          <div>
            <div className="field-row">
              <input
                type="text"
                placeholder={t(T.nicknamePh)}
                value={nameInput}
                maxLength={20}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !saving && saveProfile({ nickname: nameInput }, t(T.nicknameSaved))}
                autoFocus
              />
              <button className="secondary" disabled={saving} onClick={() => saveProfile({ nickname: nameInput }, t(T.nicknameSaved))}>
                {saving ? t(T.saving) : t(T.save)}
              </button>
              <button className="secondary" disabled={saving} onClick={() => setEditingName(false)}>
                {t(T.cancel)}
              </button>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, margin: '10px 2px 0' }}>
              {t(T.nicknameHint, { name: kakaoName })}
            </p>
          </div>
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 17 }}>
              {user.name}
              <span style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, marginLeft: 10 }}>
                {t(T.kakaoNamePrefix, { name: kakaoName })}
              </span>
            </span>
            <button
              className="secondary"
              onClick={() => {
                setNameInput(nickname ?? '');
                setEditingName(true);
              }}
            >
              {t(T.edit)}
            </button>
          </div>
        )}
      </div>

      <h2>{t(T.basicInfo)}</h2>
      <div className="card">
        {editingInfo ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div className="field-label">{t(T.birthday)}</div>
              <input
                type="date"
                value={bInput}
                min="1900-01-01"
                onChange={(e) => setBInput(e.target.value)}
                style={{ maxWidth: 220 }}
              />
            </div>
            <div style={{ marginBottom: 18 }}>
              <div className="field-label">{t(T.gender)}</div>
              <div className="seg-group">
                <button className={`seg ${gInput === 'male' ? 'on' : ''}`} onClick={() => setGInput('male')}>
                  {t(T.male)}
                </button>
                <button className={`seg ${gInput === 'female' ? 'on' : ''}`} onClick={() => setGInput('female')}>
                  {t(T.female)}
                </button>
              </div>
            </div>
            <div className="field-row">
              <button
                className="secondary"
                disabled={saving || !bInput || !gInput}
                onClick={() => saveProfile({ birthday: bInput, gender: gInput }, t(T.basicInfoSaved))}
              >
                {saving ? t(T.saving) : t(T.save)}
              </button>
              <button className="secondary" disabled={saving} onClick={() => setEditingInfo(false)}>
                {t(T.cancel)}
              </button>
            </div>
          </div>
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500 }}>
              {birthday || t(T.notEntered)}
              <span style={{ marginLeft: 16, color: 'var(--text-dim)' }}>{genderLabel(gender)}</span>
            </span>
            <button
              className="secondary"
              onClick={() => {
                setBInput(birthday);
                setGInput(gender);
                setEditingInfo(true);
              }}
            >
              {t(T.edit)}
            </button>
          </div>
        )}
      </div>

      <h2>{t(T.language)}</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
          {t(T.languageDesc)}
        </p>
        <div className="seg-group">
          {LOCALES.map((l) => (
            <button
              key={l}
              className={`seg ${locale === l ? 'on' : ''}`}
              disabled={saving}
              onClick={() => changeLocale(l)}
            >
              {LOCALE_NAMES[l]}
            </button>
          ))}
        </div>
      </div>

      <h2>{t(T.subs)}</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
          {t(T.subsDesc)}
        </p>
        <div className="field-row">
          {CATEGORIES.filter((c) => c.kind === 'posts').map((c) => (
            <button
              key={c.slug}
              className={`seg ${subs.has(c.slug) ? 'on' : ''}`}
              style={subs.has(c.slug) ? { background: c.color, borderColor: c.color, color: c.fg } : undefined}
              onClick={() => toggleSub(c.slug)}
            >
              {t(c.name)}
            </button>
          ))}
        </div>
      </div>

      <h2>{t(T.kakaoTalk)}</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
          {t(T.kakaoTalkDesc)}
        </p>
        <div className="field-row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500, color: talkMessage ? undefined : 'var(--text-dim)' }}>
            {talkMessage === true ? t(T.talkOn) : talkMessage === false ? t(T.talkOff) : t(T.talkUnknown)}
          </span>
          <span className="field-row">
            {talkMessage !== true && (
              <a className="kakao-btn" href="/api/auth/login?consent=talk_message&next=/profile">
                <KakaoIcon />
                {t(T.talkEnable)}
              </a>
            )}
            {talkMessage !== false && (
              <button className="secondary" disabled={talkBusy} onClick={verifyTalk}>
                {talkBusy ? t(T.talkChecking) : t(T.talkCheck)}
              </button>
            )}
            {talkMessage === true && (
              <button className="danger" disabled={talkBusy} onClick={disableTalk}>
                {t(T.talkDisable)}
              </button>
            )}
          </span>
        </div>
        {talkMessage === null && (
          <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, margin: '12px 2px 0' }}>
            {t(T.talkUnknownHint)}
          </p>
        )}
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div style={{ marginTop: 28 }}>
        <button className="danger" onClick={logout}>
          {t(T.logout)}
        </button>
      </div>
    </>
  );
}
