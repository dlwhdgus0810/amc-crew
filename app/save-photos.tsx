'use client';

import { useState } from 'react';
import { useT } from './i18n';
import {
  canShareFiles,
  downloadFiles,
  fetchFiles,
  shareFiles,
  ShareNotAllowedError,
} from '@/lib/download-client';

/**
 * 사진 여러 장을 한 번에 저장하는 버튼의 속.
 *
 * 모임 화면과 모아보기 두 곳이 같이 쓴다. 처음에는 모임 화면에만 있었는데, 정작
 * 사진을 보러 오는 곳이 모아보기라 거기서 먼저 찾게 된다.
 *
 * ZIP으로 묶지 않는다 — 폰에서 ZIP은 사진 앱에 안 들어간다. 받아서 공유 시트로 넘기면
 * 「n장의 이미지 저장」이 되어 사진 앱으로 바로 간다 (lib/download-client.ts).
 */

const T = {
  save: { ko: '{n}장 전부 받기', en: 'Download all {n}', es: 'Descargar las {n}' },
  busy: { ko: '{done}/{total} 받는 중…', en: 'Getting {done}/{total}…', es: 'Descargando {done}/{total}…' },
  /* 다 받아 놓고 시트만 못 연 상태 — 한 번 더 누르면 열린다 */
  ready: { ko: '{n}장 저장하기', en: 'Save {n} photos', es: 'Guardar {n} fotos' },
  failed: { ko: '받지 못했어요. 다시 눌러주세요.', en: 'Couldn’t download. Try again.', es: 'No se pudo descargar. Inténtalo otra vez.' },
};

export function useSavePhotos(onError?: (msg: string) => void) {
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [ready, setReady] = useState<File[] | null>(null);
  const t = useT();

  /**
   * urls를 받아 저장한다.
   *
   * 두 번 눌러야 할 때가 있다. 공유 시트는 **누른 직후에만** 열리는데 여러 장 받아 오는
   * 동안 그 자격이 풀리기 때문이다. 그때는 받아 둔 것을 들고 「n장 저장하기」로 바뀌고,
   * 그 두 번째 누름이 시트를 연다.
   */
  async function run(urls: () => Promise<string[]> | string[]) {
    // 이미 받아 뒀으면 곧바로 시트로 — 이 누름은 갓 누른 것이라 열린다
    if (ready) {
      try {
        await shareFiles(ready);
      } catch {
        downloadFiles(ready);
      }
      setReady(null);
      return;
    }

    setBusy({ done: 0, total: 0 });
    try {
      const list = await urls();
      setBusy({ done: 0, total: list.length });
      const files = await fetchFiles(
        list,
        (i) => `photo-${i + 1}.jpg`,
        (done, total) => setBusy({ done, total })
      );

      if (!canShareFiles(files)) return downloadFiles(files); // 데스크톱 — 한 장씩 받아진다
      try {
        await shareFiles(files);
      } catch (e) {
        // 시트를 못 열었을 뿐이다. 받아 둔 것은 그대로 들고 한 번 더 누르게 한다
        if (e instanceof ShareNotAllowedError) return setReady(files);
        throw e;
      }
    } catch {
      onError?.(t(T.failed));
    } finally {
      setBusy(null);
    }
  }

  /** 버튼에 적을 글자 — 상태에 따라 갈린다 */
  function label(n: number): string {
    if (busy) return t(T.busy, { done: busy.done, total: busy.total });
    if (ready) return t(T.ready, { n: ready.length });
    return t(T.save, { n });
  }

  return { run, label, busy: Boolean(busy) };
}
