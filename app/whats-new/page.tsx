'use client';

import { useEffect } from 'react';
import { changelogFor, latestAt } from '@/lib/changelog';
import { entryLabel } from '@/lib/datefmt';
import { useLocale, useT } from '../i18n';
import { useRegion } from '../region-context';
import { WHATS_NEW_SEEN } from '../whats-new-card';

const T = {
  title: { ko: '새 소식', en: 'What’s new', es: 'Novedades' },
  subtitle: {
    ko: '앱에 무엇이 바뀌었는지 모아 둔 곳이에요. 바라는 게 있으면 건의함에 남겨주세요.',
    en: 'Everything that’s changed in the app. Want something? Leave it in the suggestion box.',
    es: 'Todo lo que ha cambiado en la app. ¿Quieres algo? Déjalo en el buzón de sugerencias.',
  },
  empty: { ko: '아직 소식이 없어요.', en: 'Nothing yet.', es: 'Todavía nada.' },
};

/**
 * 업데이트 소식 목록.
 *
 * 이 화면을 열면 홈의 "새 소식" 카드는 사라진다 — 이미 봤으니까.
 */
export default function WhatsNewPage() {
  const t = useT();
  const locale = useLocale();
  // 문을 연 날 이후의 소식만 — 펜에서 캔자스 이야기를 읽을 이유가 없다 (lib/changelog.ts)
  const region = useRegion();
  const entries = changelogFor(region);

  useEffect(() => {
    // 여기까지 왔으면 전부 본 것으로 친다 (홈 카드와 같은 기준이어야 한다)
    const latest = latestAt(region);
    if (latest) {
      try {
        localStorage.setItem(WHATS_NEW_SEEN, latest);
      } catch {
        // 사파리 사생활 보호 모드 등 — 카드가 한 번 더 보이는 것뿐이라 넘어간다
      }
    }
  }, [region]);

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

      {entries.length === 0 ? (
        <p className="hint">{t(T.empty)}</p>
      ) : (
        entries.map((entry) => (
          <section key={entry.at} id={entry.at} className="news-entry">
            <div className="news-date">{entryLabel(entry.at, locale)}</div>
            <h2 className="news-title">{t(entry.title)}</h2>
            <ul className="news-items">
              {entry.items.map((item, i) => (
                <li key={i}>{t(item)}</li>
              ))}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
