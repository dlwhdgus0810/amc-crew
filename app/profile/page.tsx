'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CATEGORIES, catDisplayName, getCategory } from '@/lib/categories';
import { useLocale, useT } from '../i18n';
import { PROFILE_UPDATED } from '../nav';
import { LOCALES, LOCALE_NAMES, Locale } from '@/lib/i18n';
import PushToggle from '../push-toggle';

/** 저장할 사진 한 변의 길이 (px) */
const AVATAR_PX = 256;

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  title: { ko: '프로필', en: 'Profile' },
  subtitle: {
    ko: '사진, 기본 정보, 언어, 구독을 관리해요.',
    en: 'Manage your photo, basic info, language and subscriptions.',
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
  nameTitle: { ko: '이름', en: 'Name' },
  nameHint: {
    ko: '카카오톡 이름을 그대로 써요. 카카오톡에서 이름을 바꾸면 다음 로그인 때 따라 바뀌어요.',
    en: 'Your Kakao name is used as-is. Change it in KakaoTalk and it follows on your next login.',
  },
  venmo: { ko: 'Venmo 아이디', en: 'Venmo username' },
  venmoDesc: {
    ko: '모임 정산에서 다른 사람이 바로 보낼 수 있게 해줘요. 돈은 앱을 거치지 않고 Venmo에서 직접 오갑니다.',
    en: 'Lets people pay you in one tap when a meetup is settled. Money never passes through this app.',
  },
  venmoPh: { ko: '@ 없이 입력', en: 'without the @' },
  venmoNone: { ko: '등록 안 함', en: 'Not set' },
  venmoSaved: { ko: 'Venmo 아이디를 저장했어요.', en: 'Venmo username saved.' },
  pay: { ko: '받을 계좌', en: 'How you get paid' },
  payDesc: {
    ko: '모임 정산에서 다른 사람이 나에게 보낼 때 씁니다. 돈은 앱을 거치지 않고 Venmo·Zelle에서 직접 오가요.',
    en: 'Used when a meetup is settled. Money never passes through this app — it moves in Venmo or Zelle.',
  },
  zelle: { ko: 'Zelle', en: 'Zelle' },
  zellePh: { ko: '전화번호 또는 이메일', en: 'Phone number or email' },
  zelleSaved: { ko: 'Zelle 정보를 저장했어요.', en: 'Zelle details saved.' },
  zelleHint: {
    ko: 'Zelle은 앱에서 바로 보내는 링크를 만들 수 없어서, 상대에게 이 값을 복사해 보여줍니다.',
    en: 'Zelle has no link to open, so this is shown for people to copy into their bank app.',
  },
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
  failed: { ko: '저장하지 못했어요.', en: 'Couldn’t save.' },
  news: { ko: '새 소식', en: 'What’s new' },
  newsDesc: {
    ko: '앱에 무엇이 바뀌었는지 모아 뒀어요.',
    en: 'Everything that’s changed in the app.',
  },
  newsGo: { ko: '새 소식 보기 →', en: 'See what’s new →' },
  // 카톡·앱 푸시 어느 쪽으로 갈지는 각자 켜 둔 것에 달렸다 — 채널 이름을 넣지 않는다
  newsAlertsOn: { ko: '새 소식 알림 받는 중', en: 'Getting update alerts' },
  newsAlertsOff: { ko: '새 소식 알림 꺼짐', en: 'Update alerts off' },
  newsAlertsEnable: { ko: '알림 켜기', en: 'Turn on' },
  newsAlertsDisable: { ko: '알림 끄기', en: 'Turn off' },
  favOrder: { ko: '즐겨찾기 순서', en: 'Favourite order' },
  favOrderDesc: {
    ko: '홈에 뜨는 차례예요. 홈에서 카드를 끌어 옮겨도 되고, 여기서 위아래로 옮겨도 돼요.',
    en: 'The order they appear on the home screen. Drag the cards there, or move them here.',
  },
  favOrderEmpty: {
    ko: '★를 눌러 즐겨찾기한 카테고리가 여기 순서대로 나와요.',
    en: 'Categories you star with ★ show up here in order.',
  },
  moveUp: { ko: '위로', en: 'Move up' },
  moveDown: { ko: '아래로', en: 'Move down' },
  favOrderSaved: { ko: '즐겨찾기 순서를 저장했어요.', en: 'Favourite order saved.' },
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
  admin: { ko: '관리자', en: 'Admin' },
  adminDesc: {
    ko: '카테고리 제안·건의함 처리, AMC 상영표 새로고침, 접속 현황을 볼 수 있어요.',
    en: 'Category requests and tickets, AMC showtimes refresh, and who’s been around.',
  },
  adminGo: { ko: '관리자 화면 열기 →', en: 'Open admin →' },
  testNotify: { ko: '테스트 알림 보내기', en: 'Send a test alert' },
  testSending: { ko: '보내는 중…', en: 'Sending…' },
  testNotifyDesc: {
    ko: '관리자에게만 갑니다. 인앱·카카오톡·앱 푸시를 한 번에 태워 어디가 막혔는지 확인하는 용도예요.',
    en: 'Goes to admins only — fires the in-app, KakaoTalk and push channels at once so you can see which one arrives.',
  },
  testSent: {
    ko: '보냈어요 ({time}) — 관리자 {admins}명 · 푸시 기기 {devices}대',
    en: 'Sent ({time}) — {admins} admin(s), {devices} push device(s)',
  },
  testNoPush: {
    ko: '보냈어요 ({time}) — 관리자 {admins}명. 푸시를 켠 기기가 없어 앱 알림은 가지 않았어요.',
    en: 'Sent ({time}) — {admins} admin(s). No device has push on, so nothing went out that way.',
  },
  tickets: { ko: '건의함', en: 'Suggestion box' },
  ticketsDesc: {
    ko: '사소한 기능 개선부터 원하시는 모든 기능을 넣어드려요. 티켓을 남기면 처리 상태를 알림으로 알려드려요.',
    en: 'Anything from a tiny tweak to a whole new feature. Leave a ticket and we’ll tell you when it moves.',
  },
  ticketsGo: { ko: '건의함 열기 →', en: 'Open the suggestion box →' },
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
  const [isAdmin, setIsAdmin] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [subs, setSubs] = useState<Set<string>>(new Set());
  // 즐겨찾기는 순서가 의미를 가지므로 Set이 아니라 배열로 들고 있는다
  const [favs, setFavs] = useState<string[]>([]);
  const [newsAlerts, setNewsAlerts] = useState(false);
  const [newsBusy, setNewsBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [venmo, setVenmo] = useState('');
  const [editingVenmo, setEditingVenmo] = useState(false);
  const [zelle, setZelle] = useState('');
  const [editingZelle, setEditingZelle] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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
      fetch('/api/favorites').then((r) => r.json()),
      fetch('/api/news-alerts').then((r) => r.json()),
    ])
      .then(([auth, sub, fav, news]) => {
        setUser(auth.user ?? null);
        setIsAdmin(Boolean(auth.isAdmin));        setAvatar(auth.avatar ?? null);        setBirthday(auth.birthday ?? '');
        setGender(auth.gender ?? '');
        setTalkMessage(auth.kakaoTalkMessage ?? null);
        setSubs(new Set(sub.subscriptions ?? []));
        setFavs(fav.favorites ?? []);
        setNewsAlerts(Boolean(news.newsAlerts));
        setVenmo(auth.venmo ?? '');
        setZelle(auth.zelle ?? '');
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
      setUser((u) => (u ? { ...u, name: data.name } : u));      if (data.avatar !== undefined) setAvatar(data.avatar);
      if (data.venmo !== undefined) setVenmo(data.venmo ?? '');
      if (data.zelle !== undefined) setZelle(data.zelle ?? '');
      setEditingVenmo(false);
      setEditingZelle(false);
      setBirthday(data.birthday ?? '');
      setGender(data.gender ?? '');
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
    } catch (e) {
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setNewsBusy(false);
    }
  }

  /** 즐겨찾기 순서 바꾸기 — 화면을 먼저 옮기고 저장한다 (실패하면 서버 값으로 되돌린다) */
  async function moveFav(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= favs.length) return;
    const next = [...favs];
    [next[index], next[to]] = [next[to], next[index]];
    setFavs(next);
    setFavBusy(true);
    try {
      const res = await fetch('/api/favorites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t(T.failed));
      setFavs(data.favorites ?? next);
      setMsg({ type: 'ok', text: t(T.favOrderSaved) });
    } catch (e) {
      setFavs(favs);
      setMsg({ type: 'err', text: e instanceof Error ? e.message : t(T.failed) });
    } finally {
      setFavBusy(false);
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

      <h2>{t(T.nameTitle)}</h2>
      <div className="card">
        {/* 실명제라 고칠 수 없다 — 카카오톡 이름을 그대로 쓴다 */}
        <div className="field-row" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 17 }}>{user.name}</span>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>{t(T.nameHint)}</p>
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

      <h2>{t(T.favOrder)}</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
          {t(T.favOrderDesc)}
        </p>
        {favs.length === 0 ? (
          <p className="hint">{t(T.favOrderEmpty)}</p>
        ) : (
          <ol className="fav-order">
            {favs.map((slug, i) => {
              const cat = getCategory(slug);
              return (
                <li key={slug}>
                  <span className="fav-dot" style={{ background: cat?.color ?? 'var(--text-dim)' }} aria-hidden />
                  <span className="fav-name">{cat ? t(catDisplayName(cat.slug)) : slug}</span>
                  <button
                    className="fav-move"
                    aria-label={t(T.moveUp)}
                    disabled={favBusy || i === 0}
                    onClick={() => moveFav(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="fav-move"
                    aria-label={t(T.moveDown)}
                    disabled={favBusy || i === favs.length - 1}
                    onClick={() => moveFav(i, 1)}
                  >
                    ↓
                  </button>
                </li>
              );
            })}
          </ol>
        )}
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

      <PushToggle />

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
