'use client';

import { useEffect } from 'react';

/**
 * 서비스 워커 등록. 개발 중에는 HMR과 충돌하므로 프로덕션 빌드에서만 등록하고,
 * 개발 서버에서는 이전에 남아 있던 워커를 정리한다.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
      return;
    }

    navigator.serviceWorker
      .register('/sw.js')
      .catch((e) => console.error('[sw] 등록 실패:', e));
  }, []);

  return null;
}
