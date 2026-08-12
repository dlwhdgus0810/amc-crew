'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CATEGORIES, catDisplayName, getCategory } from '@/lib/categories';
import { useLocale, useT } from '../i18n';
import { PROFILE_UPDATED } from '../nav';
import { useRefreshSession, useViewer } from '../session';
import { LOCALES, LOCALE_NAMES, Locale } from '@/lib/i18n';
import PushToggle from '../push-toggle';

/** 저장할 사진 한 변의 길이 (px) */
const AVATAR_PX = 256;

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…', es: 'Cargando…' },
  title: { ko: '프로필', en: 'Profile', es: 'Perfil' },
  subtitle: {
    ko: '사진, 닉네임, 기본 정보, 언어, 구독을 관리해요.',
    en: 'Manage your photo, nickname, basic info, language and subscriptions.',
    es: 'Aquí cambias tu foto, tu apodo, tus datos, el idioma y tus suscripciones.',
  },
  loginPrompt: {
    ko: '카카오 로그인 후 프로필을 관리할 수 있어요.',
    en: 'Log in with Kakao to manage your profile.',
    es: 'Entra con Kakao para gestionar tu perfil.',
  },
  kakaoLogin: { ko: '카카오 로그인', en: 'Log in with Kakao', es: 'Entrar con Kakao' },
  photo: { ko: '프로필 사진', en: 'Profile photo', es: 'Foto de perfil' },
  photoPick: { ko: '사진 고르기', en: 'Choose a photo', es: 'Elegir foto' },
  photoChange: { ko: '사진 바꾸기', en: 'Change photo', es: 'Cambiar foto' },
  photoRemove: { ko: '사진 지우기', en: 'Remove photo', es: 'Quitar foto' },
  photoHint: {
    ko: '정사각형으로 잘라 256px로 줄여서 저장해요. 지우면 이름 첫 글자가 보여요.',
    en: 'Cropped square and stored at 256px. Remove it to fall back to your initial.',
    es: 'Se recorta cuadrada y se guarda a 256px. Si la quitas, se usa tu inicial.',
  },
  photoSaved: { ko: '프로필 사진을 저장했어요.', en: 'Profile photo saved.', es: 'Foto de perfil guardada.' },
  photoRemoved: { ko: '프로필 사진을 지웠어요.', en: 'Profile photo removed.', es: 'Foto de perfil quitada.' },
  photoBad: { ko: '이미지 파일만 올릴 수 있어요.', en: 'Only image files can be uploaded.', es: 'Solo se pueden subir imágenes.' },
  nickname: { ko: '닉네임', en: 'Nickname', es: 'Apodo' },
  nicknamePh: { ko: '닉네임', en: 'Nickname', es: 'Apodo' },
  nicknameSaved: { ko: '닉네임을 저장했어요.', en: 'Nickname saved.', es: 'Apodo guardado.' },
  nicknameHint: {
    ko: '비워두고 저장하면 카카오 닉네임({name})을 사용해요.',
    en: 'Leave it empty to use your Kakao nickname ({name}).',
    es: 'Déjalo vacío para usar tu apodo de Kakao ({name}).',
  },
  kakaoNamePrefix: { ko: '카카오: {name}', en: 'Kakao: {name}', es: 'Kakao: {name}' },
  nameEn: { ko: '영어 이름', en: 'English name', es: 'Nombre en inglés' },
  nameEnPh: { ko: 'English name', en: 'English name', es: 'English name' },
  nameEnSaved: { ko: '영어 이름을 저장했어요.', en: 'English name saved.', es: 'Nombre en inglés guardado.' },
  nameEnHint: {
    ko: '한국어가 아닌 언어로 보는 사람에게는 이 이름이 먼저 보여요. 비워두면 위 이름이 그대로 보여요.',
    en: 'Anyone reading the app in a language other than Korean sees this name first. Leave it empty to keep the name above.',
    es: 'Quien use la app en un idioma que no sea coreano verá este nombre primero. Déjalo vacío para mantener el de arriba.',
  },
  nameEnNone: { ko: '아직 없어요', en: 'Not set', es: 'Sin definir' },
  venmo: { ko: 'Venmo 아이디', en: 'Venmo username', es: 'Usuario de Venmo' },
  venmoDesc: {
    ko: '모임 정산에서 다른 사람이 바로 보낼 수 있게 해줘요. 돈은 앱을 거치지 않고 Venmo에서 직접 오갑니다.',
    en: 'Lets people pay you in one tap when a meetup is settled. Money never passes through this app.',
    es: 'Permite que te paguen con un toque cuando se divide una cuenta. El dinero nunca pasa por esta app.',
  },
  venmoPh: { ko: '@ 없이 입력', en: 'without the @', es: 'sin la @' },
  /**
   * Venmo를 안 쓰는 분이 이 칸에 「Zelle」이라고 적은 일이 있었다. 글자로는 멀쩡한
   * 아이디라 서버도 통과시켰고, 정산 링크가 @Zelle이라는 남의 계정으로 갔다.
   */
  venmoBlank: {
    ko: 'Venmo를 안 쓰시면 빈칸으로 두세요 — 여기에 「Zelle」처럼 적으면 그 아이디를 쓰는 다른 사람에게 링크가 걸립니다.',
    en: 'No Venmo? Leave it blank — typing something like “Zelle” here links to a stranger who owns that username.',
    es: '¿Sin Venmo? Déjalo vacío: escribir algo como «Zelle» enlaza a un desconocido con ese usuario.',
  },
  venmoNone: { ko: '등록 안 함', en: 'Not set', es: 'Sin definir' },
  venmoSaved: { ko: 'Venmo 아이디를 저장했어요.', en: 'Venmo username saved.', es: 'Usuario de Venmo guardado.' },
  pay: { ko: '받을 계좌', en: 'How you get paid', es: 'Dónde te pagan' },
  payDesc: {
    ko: '모임 정산에서 다른 사람이 나에게 보낼 때 씁니다. 돈은 앱을 거치지 않고 Venmo·Zelle에서 직접 오가요.',
    en: 'Used when a meetup is settled. Money never passes through this app — it moves in Venmo or Zelle.',
    es: 'Se usa al dividir una cuenta. El dinero nunca pasa por esta app: va por Venmo o Zelle.',
  },
  zelle: { ko: 'Zelle', en: 'Zelle', es: 'Zelle' },
  zellePh: { ko: '전화번호 또는 이메일', en: 'Phone number or email', es: 'Teléfono o correo' },
  zelleSaved: { ko: 'Zelle 정보를 저장했어요.', en: 'Zelle details saved.', es: 'Datos de Zelle guardados.' },
  zelleHint: {
    ko: 'Zelle은 앱에서 바로 보내는 링크를 만들 수 없어서, 상대에게 이 값을 복사해 보여줍니다.',
    en: 'Zelle has no link to open, so this is shown for people to copy into their bank app.',
    es: 'Zelle no tiene enlace que abrir, así que se muestra para copiarlo en la app del banco.',
  },
  basicInfo: { ko: '기본 정보', en: 'Basic info', es: 'Tus datos' },
  basicInfoSaved: { ko: '기본 정보를 저장했어요.', en: 'Basic info saved.', es: 'Datos guardados.' },
  birthday: { ko: '생년월일', en: 'Date of birth', es: 'Fecha de nacimiento' },
  gender: { ko: '성별', en: 'Gender', es: 'Género' },
  male: { ko: '남성', en: 'Male', es: 'Hombre' },
  female: { ko: '여성', en: 'Female', es: 'Mujer' },
  notEntered: { ko: '미입력', en: 'Not set', es: 'Sin definir' },
  language: { ko: '언어', en: 'Language', es: 'Idioma' },
  languageDesc: {
    ko: '앱 화면과 알림 문구에 쓰이는 언어예요.',
    en: 'Used for the app interface and notification messages.',
    // 스페인어는 아직 옮기는 중이라, 안 옮긴 화면은 영어로 보인다는 것을 여기서 알려준다
    es: 'Se usa en la app y en los avisos. El español está en camino — lo que falte se verá en inglés.',
  },
  languageSaved: { ko: '언어를 바꿨어요.', en: 'Language updated.', es: 'Idioma cambiado.' },
  failed: { ko: '저장하지 못했어요.', en: 'Couldn’t save.', es: 'No se pudo guardar.' },
  news: { ko: '새 소식', en: 'What’s new', es: 'Novedades' },
  newsDesc: {
    ko: '앱에 무엇이 바뀌었는지 모아 뒀어요.',
    en: 'Everything that’s changed in the app.',
    es: 'Todo lo que ha cambiado en la app.',
  },
  newsGo: { ko: '새 소식 보기 →', en: 'See what’s new →', es: 'Ver novedades →' },
  // 카톡·앱 푸시 어느 쪽으로 갈지는 각자 켜 둔 것에 달렸다 — 채널 이름을 넣지 않는다
  privacyTitle: { ko: '지난 비공개 모임', en: 'Past private meetups', es: 'Quedadas privadas pasadas' },
  privacyDesc: {
    ko: '비공개 모임은 끝나고 나면 캘린더와 지난 모임 목록에서 사라져요. 내가 만들었거나 참가했던 것도요. 켜면 다시 보여요.',
    en: 'Private meetups disappear from your calendar and past lists once they’re over — even ones you made or joined. Turn this on to keep seeing them.',
    es: 'Las quedadas privadas desaparecen del calendario y de las listas cuando terminan, incluso las tuyas. Actívalo para seguir viéndolas.',
  },
  privacyOn: { ko: '지난 비공개 모임 보임', en: 'Showing past private meetups', es: 'Se muestran las privadas pasadas' },
  privacyOff: { ko: '지난 비공개 모임 숨김', en: 'Past private meetups hidden', es: 'Privadas pasadas ocultas' },
  privacyShow: { ko: '보이기', en: 'Show', es: 'Mostrar' },
  privacyHide: { ko: '숨기기', en: 'Hide', es: 'Ocultar' },
  newsAlertsOn: { ko: '새 소식 알림 받는 중', en: 'Getting update alerts', es: 'Recibes avisos de novedades' },
  newsAlertsOff: { ko: '새 소식 알림 꺼짐', en: 'Update alerts off', es: 'Avisos de novedades desactivados' },
  newsAlertsEnable: { ko: '알림 켜기', en: 'Turn on', es: 'Activar' },
  newsAlertsDisable: { ko: '알림 끄기', en: 'Turn off', es: 'Desactivar' },
  subs: { ko: '구독 중인 취미', en: 'Subscribed hobbies', es: 'Aficiones suscritas' },
  subsDesc: {
    ko: '구독한 취미에 새 모임이 올라오면 알림을 받아요.',
    en: 'Get notified when a new meetup is posted in these hobbies.',
    es: 'Recibe aviso cuando se abra una quedada en estas aficiones.',
  },
  edit: { ko: '수정', en: 'Edit', es: 'Editar' },
  save: { ko: '저장', en: 'Save', es: 'Guardar' },
  saving: { ko: '저장 중…', en: 'Saving…', es: 'Guardando…' },
  cancel: { ko: '취소', en: 'Cancel', es: 'Cancelar' },
  saveFailed: { ko: '저장 실패', en: 'Couldn’t save', es: 'No se pudo guardar' },
  admin: { ko: '관리자', en: 'Admin', es: 'Admin' },
  adminDesc: {
    ko: '카테고리 제안·건의함 처리, AMC 상영표 새로고침, 접속 현황을 볼 수 있어요.',
    en: 'Category requests and tickets, AMC showtimes refresh, and who’s been around.',
    es: 'Propuestas de categoría y sugerencias, actualizar funciones de AMC, y quién ha pasado por aquí.',
  },
  adminGo: { ko: '관리자 화면 열기 →', en: 'Open admin →', es: 'Abrir admin →' },
  testNotify: { ko: '테스트 알림 보내기', en: 'Send a test alert', es: 'Enviar aviso de prueba' },
  testSending: { ko: '보내는 중…', en: 'Sending…', es: 'Enviando…' },
  testNotifyDesc: {
    ko: '관리자에게만 갑니다. 인앱 알림과 앱 푸시를 한 번에 태워 어디가 막혔는지 확인하는 용도예요.',
    en: 'Goes to admins only — fires the in-app and push channels at once so you can see which one arrives.',
    es: 'Va solo a administradores: dispara el aviso dentro de la app y el push a la vez para ver cuál llega.',
  },
  testSent: {
    ko: '보냈어요 ({time}) — 관리자 {admins}명 · 푸시 기기 {devices}대',
    en: 'Sent ({time}) — {admins} admin(s), {devices} push device(s)',
    es: 'Enviado ({time}) — {admins} admin(s), {devices} dispositivo(s) con push',
  },
  testNoPush: {
    ko: '보냈어요 ({time}) — 관리자 {admins}명. 푸시를 켠 기기가 없어 앱 알림은 가지 않았어요.',
    en: 'Sent ({time}) — {admins} admin(s). No device has push on, so nothing went out that way.',
    es: 'Enviado ({time}) — {admins} admin(s). Ningún dispositivo tiene push, así que por ahí no salió nada.',
  },
  tickets: { ko: '건의함', en: 'Suggestion box', es: 'Buzón de sugerencias' },
  ticketsDesc: {
    ko: '사소한 기능 개선부터 원하시는 모든 기능을 넣어드려요. 티켓을 남기면 처리 상태를 알림으로 알려드려요.',
    en: 'Anything from a tiny tweak to a whole new feature. Leave a ticket and we’ll tell you when it moves.',
    es: 'Desde un detalle mínimo hasta una función entera. Deja una sugerencia y te avisamos cuando avance.',
  },
  ticketsGo: { ko: '건의함 열기 →', en: 'Open the suggestion box →', es: 'Abrir el buzón →' },
  logout: { ko: '로그아웃', en: 'Log out', es: 'Cerrar sesión' },
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

/** 서버가 페이지를 그리면서 미리 읽어 둔 것 (page.tsx) */
export interface ProfileInitial {
  subs: string[];
  newsAlerts: boolean;
  showPastPrivate: boolean;
}

export default function ProfilePage({ initial }: { initial: ProfileInitial }) {
  const router = useRouter();
  /*
   * 프로필 화면의 첫 값은 레이아웃이 서버에서 읽어 둔 세션에서 가져온다 —
   * 예전에는 /api/auth/me를 다시 물어보고 답이 올 때까지 빈 화면이었다.
   * 여기서부터는 사람이 고치는 값이므로 상태로 들고 있는다.
   */
  const viewer = useViewer();
  const refresh = useRefreshSession();
  const [user, setUser] = useState<{ id: string; name: string } | null>(viewer.user);
  const isAdmin = viewer.isAdmin;
  const [nickname, setNickname] = useState<string | null>(viewer.nickname);
  const [nameEn, setNameEn] = useState<string | null>(viewer.nameEn);
  const [nameEnInput, setNameEnInput] = useState('');
  const [editingNameEn, setEditingNameEn] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(viewer.avatar);
  const [kakaoName, setKakaoName] = useState(viewer.kakaoName);
  const [birthday, setBirthday] = useState(viewer.birthday ?? '');
  const [gender, setGender] = useState<'male' | 'female' | ''>((viewer.gender as 'male' | 'female') ?? '');
  const [subs, setSubs] = useState<Set<string>>(() => new Set(initial.subs));
  // 즐겨찾기는 순서가 의미를 가지므로 Set이 아니라 배열로 들고 있는다
  const [newsAlerts, setNewsAlerts] = useState(initial.newsAlerts);
  const [pastPrivate, setPastPrivate] = useState(initial.showPastPrivate);
  const [pastPrivateBusy, setPastPrivateBusy] = useState(false);
  const [newsBusy, setNewsBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [venmo, setVenmo] = useState(viewer.venmo ?? '');
  const [editingVenmo, setEditingVenmo] = useState(false);
  const [zelle, setZelle] = useState(viewer.zelle ?? '');
  const [editingZelle, setEditingZelle] = useState(false);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [editingInfo, setEditingInfo] = useState(false);
  const [bInput, setBInput] = useState('');
  const [gInput, setGInput] = useState<'male' | 'female' | ''>('');
  const [saving, setSaving] = useState(false);

  const t = useT();
  const locale = useLocale();
  const genderLabel = (g: string) => (g === 'male' ? t(T.male) : g === 'female' ? t(T.female) : '');

  // 서버가 다시 그려 새 prop이 오면 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다)
  useEffect(() => {
    setSubs(new Set(initial.subs));
    setNewsAlerts(initial.newsAlerts);
    setPastPrivate(initial.showPastPrivate);
  }, [initial]);

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
      if (data.nameEn !== undefined) setNameEn(data.nameEn ?? null);
      setEditingNameEn(false);
      if (data.avatar !== undefined) setAvatar(data.avatar);
      if (data.venmo !== undefined) setVenmo(data.venmo ?? '');
      if (data.zelle !== undefined) setZelle(data.zelle ?? '');
      setEditingVenmo(false);
      setEditingZelle(false);
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

  /** 알림 경로 점검용 — 관리자에게만 간다 */
  async function sendTestNotify() {
    setTestBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/test-notify', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t(T.saveFailed));
      // 푸시 기기가 0대면 "보냈다"만 띄우는 게 오히려 헷갈린다 — 안 갔다고 분명히 말한다
      const template = data.pushDevices > 0 ? T.testSent : T.testNoPush;
      setMsg({
        type: 'ok',
        text: t(template, { time: data.time, admins: data.admins, devices: data.pushDevices }),
      });
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.saveFailed) });
    } finally {
      setTestBusy(false);
    }
  }

  async function toggleNewsAlerts() {
    const next = !newsAlerts;
    setNewsBusy(true);
    try {
      const res = await fetch('/api/news-alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: next }),
      });
      if (!res.ok) throw new Error(t(T.failed));
      setNewsAlerts(next);
      // 서버가 들고 있는 값이라, 다시 그려 두지 않으면 탭을 옮겼다 오면 옛 값이 온다
      refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setNewsBusy(false);
    }
  }

  async function togglePastPrivate() {
    const next = !pastPrivate;
    setPastPrivateBusy(true);
    try {
      const res = await fetch('/api/past-private', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: next }),
      });
      if (!res.ok) throw new Error(t(T.failed));
      setPastPrivate(next);
      refresh();
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setPastPrivateBusy(false);
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
      refresh();
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

      <h2>{t(T.nameEn)}</h2>
      <div className="card">
        {editingNameEn ? (
          <div>
            <div className="field-row">
              <input
                type="text"
                placeholder={t(T.nameEnPh)}
                value={nameEnInput}
                maxLength={30}
                onChange={(e) => setNameEnInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !saving && saveProfile({ nameEn: nameEnInput }, t(T.nameEnSaved))}
                autoFocus
              />
              <button className="secondary" disabled={saving} onClick={() => saveProfile({ nameEn: nameEnInput }, t(T.nameEnSaved))}>
                {saving ? t(T.saving) : t(T.save)}
              </button>
              <button className="secondary" disabled={saving} onClick={() => setEditingNameEn(false)}>
                {t(T.cancel)}
              </button>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, margin: '10px 2px 0' }}>
              {t(T.nameEnHint)}
            </p>
          </div>
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600, fontSize: 17, color: nameEn ? undefined : 'var(--text-dim)' }}>
              {nameEn ?? t(T.nameEnNone)}
            </span>
            <button
              className="secondary"
              onClick={() => {
                setNameEnInput(nameEn ?? '');
                setEditingNameEn(true);
              }}
            >
              {t(T.edit)}
            </button>
          </div>
        )}
      </div>

      <h2>{t(T.pay)}</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>{t(T.payDesc)}</p>
        <div className="pay-label">{t(T.venmo)}</div>
        {editingVenmo ? (
          <div className="field-row">
            <input
              type="text"
              placeholder={t(T.venmoPh)}
              value={venmo}
              maxLength={30}
              onChange={(e) => setVenmo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !saving && saveProfile({ venmo }, t(T.venmoSaved))}
              autoFocus
            />
            <button className="secondary" disabled={saving} onClick={() => saveProfile({ venmo }, t(T.venmoSaved))}>
              {saving ? t(T.saving) : t(T.save)}
            </button>
            <button className="secondary" disabled={saving} onClick={() => setEditingVenmo(false)}>
              {t(T.cancel)}
            </button>
            <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, flexBasis: '100%', margin: '2px 2px 0' }}>
              {t(T.venmoBlank)}
            </p>
          </div>
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500, color: venmo ? undefined : 'var(--text-dim)' }}>
              {venmo ? `@${venmo}` : t(T.venmoNone)}
            </span>
            <button className="secondary" onClick={() => setEditingVenmo(true)}>
              {t(T.edit)}
            </button>
          </div>
        )}

        <div className="pay-label" style={{ marginTop: 20 }}>{t(T.zelle)}</div>
        {editingZelle ? (
          <div className="field-row">
            <input
              type="text"
              placeholder={t(T.zellePh)}
              value={zelle}
              maxLength={60}
              onChange={(e) => setZelle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !saving && saveProfile({ zelle }, t(T.zelleSaved))}
              autoFocus
            />
            <button className="secondary" disabled={saving} onClick={() => saveProfile({ zelle }, t(T.zelleSaved))}>
              {saving ? t(T.saving) : t(T.save)}
            </button>
            <button className="secondary" disabled={saving} onClick={() => setEditingZelle(false)}>
              {t(T.cancel)}
            </button>
          </div>
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500, color: zelle ? undefined : 'var(--text-dim)' }}>
              {zelle || t(T.venmoNone)}
            </span>
            <button className="secondary" onClick={() => setEditingZelle(true)}>
              {t(T.edit)}
            </button>
          </div>
        )}
        <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, margin: '12px 2px 0' }}>
          {t(T.zelleHint)}
        </p>
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

      <PushToggle />

      <h2>{t(T.privacyTitle)}</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
          {t(T.privacyDesc)}
        </p>
        <div className="field-row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500, color: pastPrivate ? undefined : 'var(--text-dim)' }}>
            {pastPrivate ? t(T.privacyOn) : t(T.privacyOff)}
          </span>
          <button
            className={pastPrivate ? 'danger' : 'secondary'}
            disabled={pastPrivateBusy}
            onClick={togglePastPrivate}
          >
            {pastPrivate ? t(T.privacyHide) : t(T.privacyShow)}
          </button>
        </div>
      </div>

      <h2>{t(T.news)}</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
          {t(T.newsDesc)}
        </p>
        <div className="field-row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 500, color: newsAlerts ? undefined : 'var(--text-dim)' }}>
            {newsAlerts ? t(T.newsAlertsOn) : t(T.newsAlertsOff)}
          </span>
          <button
            className={newsAlerts ? 'danger' : 'secondary'}
            disabled={newsBusy}
            onClick={toggleNewsAlerts}
          >
            {newsAlerts ? t(T.newsAlertsDisable) : t(T.newsAlertsEnable)}
          </button>
        </div>
        <Link className="link-btn strong" href="/whats-new" style={{ marginTop: 14 }}>
          {t(T.newsGo)}
        </Link>
      </div>

      <h2>{t(T.tickets)}</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
          {t(T.ticketsDesc)}
        </p>
        <Link className="link-btn strong" href="/tickets">
          {t(T.ticketsGo)}
        </Link>
      </div>

      {/* 관리자 도구는 맨 아래 — 평소에 쓰는 것이 아니라 찾아서 쓰는 것이다 */}
      {isAdmin && (
        <>
          <h2>{t(T.admin)}</h2>
          <div className="card">
            <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
              {t(T.adminDesc)}
            </p>
            <div className="field-row" style={{ justifyContent: 'space-between' }}>
              <Link className="link-btn strong" href="/admin">
                {t(T.adminGo)}
              </Link>
              <button className="secondary" disabled={testBusy} onClick={sendTestNotify}>
                {testBusy ? t(T.testSending) : t(T.testNotify)}
              </button>
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, margin: '12px 2px 0' }}>
              {t(T.testNotifyDesc)}
            </p>
          </div>
        </>
      )}

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div style={{ marginTop: 28 }}>
        <button className="danger" onClick={logout}>
          {t(T.logout)}
        </button>
      </div>
    </>
  );
}
