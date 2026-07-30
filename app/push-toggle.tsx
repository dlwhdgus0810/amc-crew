'use client';

import { useEffect, useState } from 'react';
import { useT } from './i18n';

const T = {
  title: { ko: '앱 푸시 알림', en: 'App push notifications' },
  desc: {
    ko: '카카오톡과 별개로, 홈 화면에 추가한 앱으로 바로 알림을 받아요. 앱 아이콘에 숫자도 붙어요.',
    en: 'Separate from KakaoTalk — get alerts straight from the app on your home screen, with a badge on the icon.',
  },
  on: { ko: '이 기기에서 받는 중', en: 'On for this device' },
  off: { ko: '꺼짐', en: 'Off' },
  enable: { ko: '알림 켜기', en: 'Turn on' },
  disable: { ko: '알림 끄기', en: 'Turn off' },
  working: { ko: '처리 중…', en: 'Working…' },
  otherDevices: { ko: '다른 기기 {n}대에서도 받는 중이에요.', en: 'Also on for {n} other device(s).' },
  unsupported: {
    ko: '이 브라우저는 앱 푸시 알림을 지원하지 않아요. 카카오톡 알림은 그대로 받을 수 있어요.',
    en: 'This browser doesn’t support push notifications. KakaoTalk alerts still work.',
  },
  noSw: {
    ko: '앱 준비가 아직 안 끝났어요. 새로고침한 뒤 다시 시도해주세요.',
    en: 'The app isn’t ready yet. Refresh the page and try again.',
  },
  needsInstall: {
    ko: '아이폰은 홈 화면에 추가한 뒤에야 푸시 알림을 켤 수 있어요. 공유 버튼 → "홈 화면에 추가"를 먼저 해주세요.',
    en: 'On iPhone, push notifications only work once the app is on your home screen. Share → “Add to Home Screen” first.',
  },
  denied: {
    ko: '알림이 차단돼 있어요. 브라우저(또는 iOS 설정 → 알림)에서 이 앱의 알림을 허용해주세요.',
    en: 'Notifications are blocked. Allow them for this app in your browser (or iOS Settings → Notifications).',
  },
  failed: { ko: '알림을 켜지 못했어요. 잠시 후 다시 시도해주세요.', en: 'Couldn’t turn on notifications. Try again shortly.' },
};

/**
 * base64url(VAPID 공개 키) → 브라우저가 요구하는 바이트 배열.
 * ArrayBuffer를 먼저 만들어 담는다 — Uint8Array.from은 SharedArrayBuffer도 가능한 타입이라
 * applicationServerKey가 받아주지 않는다.
 */
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/** 홈 화면에서 실행 중인지 (iOS는 이때만 푸시가 된다) */
function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS 사파리 전용 플래그 — 표준 display-mode보다 이쪽이 정확할 때가 있다
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

type State = 'loading' | 'unsupported' | 'needs-install' | 'no-sw' | 'off' | 'on';

/**
 * 서비스 워커가 준비되길 기다리되 영원히 기다리지는 않는다.
 * navigator.serviceWorker.ready는 등록된 워커가 없으면 거부되는 게 아니라 **영영 대기**한다 —
 * 개발 서버(워커를 일부러 해제한다)와 아직 설치 전인 첫 방문에서 화면이 멈춰버린다.
 */
async function swReady(timeoutMs = 3000): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

export default function PushToggle() {
  const t = useT();
  const [state, setState] = useState<State>('loading');
  const [busy, setBusy] = useState(false);
  const [devices, setDevices] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (!vapid) return; // 키가 없으면 아예 그리지 않는다
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    if (!supported) {
      // 아이폰에서 홈 화면에 추가하지 않으면 PushManager 자체가 없다 — 안내를 갈라준다
      setState(isIOS() && !isStandalone() ? 'needs-install' : 'unsupported');
      return;
    }
    if (isIOS() && !isStandalone()) {
      setState('needs-install');
      return;
    }
    swReady()
      .then(async (reg) => {
        if (!reg) return setState('no-sw');
        setState((await reg.pushManager.getSubscription()) ? 'on' : 'off');
      })
      .catch(() => setState('no-sw'));
    fetch('/api/push/subscribe')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setDevices(d.devices ?? 0))
      .catch(() => {});
  }, [vapid]);

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      // 권한 요청은 반드시 클릭 직후에 — 미루면 iOS가 무시한다
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setError(t(T.denied));
        return;
      }
      const reg = await swReady();
      if (!reg) {
        setState('no-sw');
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true, // 조용한 푸시는 금지 — 브라우저가 요구한다
        applicationServerKey: urlBase64ToUint8Array(vapid!),
      });
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error('save failed');
      setDevices((await res.json()).devices ?? 0);
      setState('on');
    } catch (e) {
      console.error('[push] 구독 실패:', e);
      setError(t(T.failed));
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setError(null);
    try {
      const reg = await swReady();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        // 서버에서 먼저 지운다 — 브라우저 구독만 끊고 서버에 남으면 죽은 주소로 계속 쏘게 된다
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {});
        await sub.unsubscribe();
      }
      setState('off');
      setDevices((n) => Math.max(0, n - 1));
    } finally {
      setBusy(false);
    }
  }

  if (!vapid || state === 'loading') return null;

  return (
    <>
      <h2>{t(T.title)}</h2>
      <div className="card">
        <p className="subtitle" style={{ marginBottom: 16, fontSize: 14 }}>
          {t(T.desc)}
        </p>

        {state === 'unsupported' || state === 'needs-install' || state === 'no-sw' ? (
          <p style={{ color: 'var(--text-dim)', fontSize: 13.5, fontWeight: 500, margin: 0 }}>
            {t(state === 'needs-install' ? T.needsInstall : state === 'no-sw' ? T.noSw : T.unsupported)}
          </p>
        ) : (
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 500, color: state === 'on' ? undefined : 'var(--text-dim)' }}>
              {t(state === 'on' ? T.on : T.off)}
            </span>
            {state === 'on' ? (
              <button className="danger" disabled={busy} onClick={disable}>
                {busy ? t(T.working) : t(T.disable)}
              </button>
            ) : (
              <button className="secondary" disabled={busy} onClick={enable}>
                {busy ? t(T.working) : t(T.enable)}
              </button>
            )}
          </div>
        )}

        {/* 이 기기 말고 다른 기기에서도 받고 있으면 알려준다 (끄러 왔다가 헷갈리지 않게) */}
        {state === 'on' && devices > 1 && (
          <p style={{ color: 'var(--text-dim)', fontSize: 12.5, fontWeight: 500, margin: '12px 2px 0' }}>
            {t(T.otherDevices, { n: devices - 1 })}
          </p>
        )}
        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 12.5, fontWeight: 500, margin: '12px 2px 0' }}>{error}</p>
        )}
      </div>
    </>
  );
}
