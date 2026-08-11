'use client';

import { useState } from 'react';
import { translatable } from '@/lib/lang';
import { useLocale, useT } from './i18n';
import { useViewer } from './session';

/**
 * 사람이 쓴 글 아래 붙는 「번역 보기」 한 줄.
 *
 * 원문을 덮지 않고 아래에 더한다. 기계 번역은 구어체 한국어를 자주 헛짚고(「가시죠 ㄱㄱ」),
 * 무엇보다 원문이 사라지면 옆 사람에게 물어볼 수도 없다. 눌러서 펼치고, 다시 눌러 접는다.
 *
 * 읽는 사람의 언어와 글의 글자가 같으면 이 줄 자체가 안 나온다 — 한국어로 보는 사람에게
 * 한국어 댓글마다 「번역 보기」가 붙어 있으면 그게 더 시끄럽다.
 */

const T = {
  show: { ko: '번역 보기', en: 'See translation', es: 'Ver traducción' },
  hide: { ko: '원문 보기', en: 'Show original', es: 'Ver original' },
  busy: { ko: '옮기는 중…', en: 'Translating…', es: 'Traduciendo…' },
  failed: { ko: '번역이 지금은 안 되네요', en: 'Couldn’t translate that', es: 'No se ha podido traducir' },
};

export default function TranslateLine({ text }: { text: string | null | undefined }) {
  const t = useT();
  const locale = useLocale();
  const viewer = useViewer();
  const [out, setOut] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // 키가 안 꽂혀 있으면 이 줄 자체가 없다 — 눌러도 안 되는 버튼을 두지 않는다
  if (!viewer.canTranslate || !translatable(text, locale)) return null;

  async function toggle() {
    if (out) {
      setOpen((v) => !v);
      return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error('failed');
      const data = await res.json();
      setOut(data.text as string);
      setOpen(true);
    } catch {
      // 다시 누르면 다시 해본다 — 잠깐 끊긴 것일 수 있다
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && out && <p className="translated">{out}</p>}
      <button type="button" className="translate-btn" onClick={toggle} disabled={busy}>
        {busy ? t(T.busy) : failed ? t(T.failed) : open ? t(T.hide) : t(T.show)}
      </button>
    </>
  );
}
