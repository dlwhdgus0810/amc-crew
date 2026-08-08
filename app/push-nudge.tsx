'use client';

import { useEffect, useState } from 'react';
import { useT } from './i18n';
import { useViewer } from './session';

/**
 * 푸시 알림을 아직 켜지 않은 회원에게 한 번 띄우는 안내.
 *
 * 기기마다 켜는 길이 달라서 문구를 나눈다:
 *  - 아이폰은 홈 화면에 추가해야만 켤 수 있다 (사파리 탭에서는 아예 불가능하다)
 *  - 안드로이드·데스크톱 크롬은 탭에서 바로 켜진다
 *
 * 설치 안내 배너(app/install-prompt.tsx)와 겹칠 수 있지만, 이건 화면을 덮는 창이라
 * 뒤에 가려서 같이 보이지는 않는다.
 */

const T = {
  // 아이폰 · 아직 홈 화면에 없음
  iosTitle: { ko: '알림을 받으려면 두 단계만', en: 'Two steps to get alerts', es: 'Dos pasos para recibir avisos' },
  iosWhy: {
    ko: '아이폰은 홈 화면에 추가한 앱에서만 알림을 켤 수 있어요. 사파리 탭에서는 켤 수 없어요.',
    en: 'On iPhone, alerts only work from the app on your home screen — a Safari tab can’t turn them on.',
    es: 'En iPhone los avisos solo funcionan desde la app de la pantalla de inicio: una pestaña de Safari no puede activarlos.',
  },
  iosStep1: {
    ko: '화면 아래 *공유* 버튼(⬆︎) → *홈 화면에 추가* → *추가*',
    en: '*Share* (⬆︎) at the bottom → *Add to Home Screen* → *Add*',
    es: '*Compartir* (⬆︎) abajo → *Añadir a inicio* → *Añadir*',
  },
  iosStep2: {
    ko: '홈 화면에 생긴 아이콘으로 다시 열고, *프로필 → 앱 푸시 알림* 에서 켜주세요.',
    en: 'Open it again from the new home-screen icon, then turn it on in *Profile → App push notifications*.',
    es: 'Ábrela de nuevo desde el icono de inicio y actívalo en *Perfil → Notificaciones de la app*.',
  },
  iosChromeStep1: { ko: '오른쪽 아래 *⋯* → *홈 화면에 추가* → *추가*', en: 'Tap *⋯* bottom right → *Add to Home Screen* → *Add*', es: 'Toca *⋯* abajo a la derecha → *Añadir a inicio* → *Añadir*' },

  // 안드로이드 · 데스크톱 — 여기서 바로 켤 수 있다
  nowTitle: { ko: '알림 받으시겠어요?', en: 'Want alerts?', es: '¿Quieres avisos?' },
  nowWhy: {
    ko: '새 모임과 내 모임 소식을 앱으로 바로 받아요. 카카오톡 알림과 별개라, 둘 다 받아도 되고 하나만 받아도 돼요.',
    en: 'Get new meetups and updates straight from the app. Separate from KakaoTalk — keep both, or just one.',
    es: 'Recibe quedadas nuevas y novedades desde la app. Aparte de KakaoTalk: quédate con los dos o con uno.',
  },
  androidTip: {
    ko: '홈 화면에 추가해 두면 앱 아이콘에 안 읽은 개수도 붙어요.',
    en: 'Add it to your home screen and the icon carries an unread badge too.',
    es: 'Si la añades a la pantalla de inicio, el icono también muestra los sin leer.',
  },

  // 홈 화면 앱에서 열었는데 아직 안 켠 경우
  installedTitle: { ko: '알림이 꺼져 있어요', en: 'Alerts are off', es: 'Avisos desactivados' },

  enable: { ko: '알림 켜기', en: 'Turn on alerts', es: 'Activar avisos' },
  working: { ko: '켜는 중…', en: 'Turning on…', es: 'Activando…' },
  later: { ko: '나중에', en: 'Not now', es: 'Ahora no' },
  done: { ko: '켰어요! 이제 앱으로 알림이 와요.', en: 'Done — alerts will come straight to the app.', es: 'Listo: los avisos llegarán directos a la app.' },
  denied: {
    ko: '알림이 차단돼 있어요. iOS는 설정 → 알림, 안드로이드는 브라우저 사이트 설정에서 허용해주세요.',
    en: 'Notifications are blocked. Allow them in iOS Settings → Notifications, or your browser’s site settings.',
    es: 'Las notificaciones están bloqueadas. Permítelas en Ajustes → Notificaciones (iOS) o en los ajustes del sitio en tu navegador.',
  },
  failed: { ko: '켜지 못했어요. 잠시 후 다시 시도해주세요.', en: 'Couldn’t turn it on. Try again shortly.', es: 'No se pudo activar. Inténtalo de nuevo en un momento.' },
};

/** 며칠 뒤에 다시 물어볼지 — 한 번 닫았다고 영영 안 띄우면 켤 기회가 사라진다 */
const SNOOZE_DAYS = 7;
const SNOOZE_KEY = 'kk-push-nudge-snoozed';

type Mode = 'ios-safari' | 'ios-chrome' | 'installed' | 'now' | null;

/** base64url(VAPID 공개 키) → 브라우저가 요구하는 바이트 배열 */
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** *별표* 사이를 굵게 — 눌러야 할 버튼 이름을 문장에서 찾기 쉽게 */
function withBold(text: string) {
  return text.split(/\*(.+?)\*/g).map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

export default function PushNudge() {
  const t = useT();
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  // 세션은 레이아웃이 서버에서 읽어 둔 것 — 예전에는 여기서 /api/auth/me를 부르고
  // 그 답을 기다려 다시 /api/push/subscribe를 물었다(줄줄이 두 번)
  const viewer = useViewer();
  const signedInReady = Boolean(viewer.user) && !viewer.needsOnboarding;

  useEffect(() => {
    if (!vapid) return;

    let snoozed = false;
    try {
      const at = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
      snoozed = Date.now() - at < SNOOZE_DAYS * 86_400_000;
    } catch {
      // 저장소를 못 읽으면 그냥 띄운다
    }
    if (snoozed) return;

    const ua = navigator.userAgent;
    // 카톡 인앱 브라우저에서는 설치도 알림도 안 된다 — 설치 안내 배너가 밖으로 빼내는 일을 맡는다
    if (/KAKAOTALK/i.test(ua)) return;

    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    // 아이폰은 홈 화면에 추가하기 전까지 지원 여부를 물어볼 수도 없다 — 그래서 따로 본다
    if (!supported && !isIOS) return;

    // 로그인한 회원에게만 — 아직 가입도 안 한 사람에게 알림부터 권할 이유가 없다
    if (!signedInReady) return;

    let alive = true;
    (async () => {
      const status = await fetch('/api/push/subscribe')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (!alive || !status?.enabled) return;
      // 이미 어느 기기에서든 켜 둔 사람은 건드리지 않는다
      if ((status.devices ?? 0) > 0) return;

      if (isIOS && !isStandalone()) {
        setMode(/CriOS/i.test(ua) ? 'ios-chrome' : 'ios-safari');
        return;
      }
      if (!supported) return;
      if (Notification.permission === 'denied') return; // 이미 막아둔 사람에게 다시 묻지 않는다
      setMode(isStandalone() ? 'installed' : 'now');
    })();

    return () => {
      alive = false;
    };
  }, [vapid, signedInReady]);

  function snooze() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      // 못 적으면 다음에 또 뜬다 — 그뿐이다
    }
    setMode(null);
  }

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      // 권한 요청은 반드시 클릭 직후에 — 미루면 iOS가 무시한다
      if ((await Notification.requestPermission()) !== 'granted') {
        setMsg(t(T.denied));
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid!),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error('save failed');
      setMsg(t(T.done));
      // 켜자마자 창이 사라지면 켜진 게 맞는지 알 수 없다 — 확인 문구를 잠깐 보여준다
      setTimeout(snooze, 1600);
    } catch (e) {
      console.error('[push-nudge] 구독 실패:', e);
      setMsg(t(T.failed));
    } finally {
      setBusy(false);
    }
  }

  if (!mode) return null;

  const iosMode = mode === 'ios-safari' || mode === 'ios-chrome';
  const title = iosMode ? t(T.iosTitle) : mode === 'installed' ? t(T.installedTitle) : t(T.nowTitle);
  const why = iosMode ? t(T.iosWhy) : t(T.nowWhy);
  const steps = iosMode ? [mode === 'ios-chrome' ? T.iosChromeStep1 : T.iosStep1, T.iosStep2] : [];

  return (
    <div className="nudge-back" role="dialog" aria-modal="true" aria-label={title}>
      <div className="nudge">
        <h2 className="nudge-title">🔔 {title}</h2>
        <p className="nudge-why">{why}</p>

        {steps.length > 0 && (
          <ol className="nudge-steps">
            {steps.map((s, i) => (
              <li key={i}>{withBold(t(s))}</li>
            ))}
          </ol>
        )}
        {mode === 'now' && <p className="nudge-tip">{t(T.androidTip)}</p>}

        {msg && <p className="nudge-msg">{msg}</p>}

        <div className="nudge-actions">
          {!iosMode && (
            <button className="big-cta" disabled={busy} onClick={enable}>
              {busy ? t(T.working) : t(T.enable)}
            </button>
          )}
          <button className="link-btn" onClick={snooze}>
            {t(T.later)}
          </button>
        </div>
      </div>
    </div>
  );
}
