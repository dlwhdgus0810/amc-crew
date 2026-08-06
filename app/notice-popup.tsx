'use client';

import { useEffect, useState } from 'react';
import { useT } from './i18n';
import { useViewer } from './session';

/**
 * 공지 알림창 — 관리자가 올린 말 하나를 앱을 열 때 화면 가운데에 한 번 보여준다.
 *
 * 새 소식 카드(app/whats-new-card.tsx)와 일부러 다르게 만들었다. 저건 본문 안의 한 줄이라
 * 스크롤로 지나칠 수 있다 — 그래도 되는 소식이니까. 공지는 「이렇게 해주세요」라서
 * 지나칠 수 있으면 안 하느니만 못하다. 그래서 이건 화면을 막고, 닫아야 없어진다.
 *
 * 대신 한 번 닫으면 그 공지는 다시 안 뜬다. 매번 뜨는 알림창은 두 번째부터 안 읽고 닫는다.
 *
 * 읽음 표시는 이 기기의 localStorage에만 남는다 — 사람 × 공지로 표를 만들 만한 일이 아니다.
 * 기기를 바꾸면 한 번 더 보는 정도는 감수한다 (새 소식 카드도 같은 방식이다).
 */

const SEEN_KEY = 'kk-notice-seen';
/** 닫은 기록은 최근 것만 남긴다 — 공지가 쌓여도 저장소가 늘어나지 않게 */
const SEEN_MAX = 20;

const T = {
  label: { ko: '공지', en: 'Notice' },
  ok: { ko: '알겠어요', en: 'Got it' },
};

interface Notice {
  id: string;
  titleKo: string;
  titleEn: string | null;
  bodyKo: string | null;
  bodyEn: string | null;
  updatedAt: string;
}

/**
 * 읽는 사람의 언어로. 한쪽만 적혀 있으면 양쪽 다 그것을 쓴다.
 *
 * 번역이 없다고 공지를 통째로 감추면 그 언어로 보는 사람만 이 말을 못 듣는다.
 * 안 읽히는 것보다 다른 언어로라도 읽히는 편이 낫다.
 */
function msg(ko: string | null, en: string | null) {
  return { ko: ko || en || '', en: en || ko || '' };
}

/** 이 공지를 이미 닫았는지 가리는 열쇠 — 내용을 고치면 달라져서 다시 뜬다 */
function keyOf(n: Notice): string {
  return `${n.id}@${n.updatedAt}`;
}

function seenList(): string[] {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((v) => typeof v === 'string') : [];
  } catch {
    // 저장소를 못 읽으면 안 본 것으로 친다 — 안 보여주는 것보다 낫다
    return [];
  }
}

export default function NoticePopup() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const viewer = useViewer();
  const t = useT();

  // 로그인한 회원에게만. 정지 가리개나 온보딩이 떠 있을 때는 그 위에 또 얹지 않는다.
  const eligible = Boolean(viewer.user) && !viewer.ban && !viewer.needsOnboarding;

  useEffect(() => {
    if (!eligible) return;
    let alive = true;
    fetch('/api/notices')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const n: Notice | null = d?.notice ?? null;
        if (!alive || !n) return;
        if (seenList().includes(keyOf(n))) return;
        setNotice(n);
      })
      .catch(() => {
        // 못 받아오면 그냥 안 뜬다 — 공지 하나 때문에 화면이 막히면 안 된다
      });
    return () => {
      alive = false;
    };
  }, [eligible]);

  // 떠 있는 동안 뒤 화면이 따라 스크롤되지 않게 막고, Esc로도 닫는다
  useEffect(() => {
    if (!notice) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

  function close() {
    if (notice) {
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...seenList(), keyOf(notice)].slice(-SEEN_MAX)));
      } catch {
        // 못 적으면 다음에 또 뜬다 — 그뿐이다
      }
    }
    setNotice(null);
  }

  if (!notice) return null;

  return (
    /*
     * 배경을 눌러도 닫히지 않는다. 사진 확대(poster-zoom)와 여기서 갈린다 —
     * 거기서는 잘못 닫아도 다시 누르면 그만이지만, 공지는 다시 열 수가 없다.
     */
    <div className="notice-pop" role="dialog" aria-modal="true" aria-labelledby="notice-title">
      <div className="notice-box">
        <span className="notice-tag">{t(T.label)}</span>
        <h2 id="notice-title" className="notice-title">
          {t(msg(notice.titleKo, notice.titleEn))}
        </h2>
        {(notice.bodyKo || notice.bodyEn) && (
          <p className="notice-body">{t(msg(notice.bodyKo, notice.bodyEn))}</p>
        )}
        <button className="notice-ok" onClick={close} autoFocus>
          {t(T.ok)}
        </button>
      </div>
    </div>
  );
}
