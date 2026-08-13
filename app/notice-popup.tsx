'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
 * 「알겠어요」는 서버에 한 줄 남긴다. 올린 쪽이 「다들 봤나」를 알아야 해서고, 덤으로
 * 읽음 표시가 사람에게 붙어 폰에서 닫은 것을 노트북도 안다.
 *
 * localStorage에도 함께 적는다. 그게 없으면 서버에 알리는 데 실패했을 때(지하철·기내)
 * 같은 공지가 그 자리에서 다시 뜬다. 어느 한쪽에만 있어도 안 뜨고, 서버 쪽이 기준이다.
 */

const SEEN_KEY = 'kk-notice-seen';
/** 닫은 기록은 최근 것만 남긴다 — 공지가 쌓여도 저장소가 늘어나지 않게 */
const SEEN_MAX = 20;

const T = {
  label: { ko: '공지', en: 'Notice', es: 'Aviso' },
  ok: { ko: '알겠어요', en: 'Got it', es: 'Entendido' },
  go: { ko: '보러 가기', en: 'Take me there', es: 'Ir a verlo' },
};

interface Notice {
  id: string;
  titleKo: string;
  titleEn: string | null;
  titleEs: string | null;
  bodyKo: string | null;
  bodyEn: string | null;
  bodyEs: string | null;
  /** 있으면 「보러 가기」가 붙는다 — 앱 안의 경로만 온다 (서버가 거른다) */
  linkPath: string | null;
  updatedAt: string;
}

/**
 * 읽는 사람의 언어로. 안 적힌 언어는 적혀 있는 다른 언어로 채운다.
 *
 * 번역이 없다고 공지를 통째로 감추면 그 언어로 보는 사람만 이 말을 못 듣는다.
 * 안 읽히는 것보다 다른 언어로라도 읽히는 편이 낫다.
 *
 * 빈 자리를 메우는 순서는 언어마다 다르다 — 스페인어 자리에는 한국어보다 영어가 먼저다.
 * 읽는 사람이 알아볼 확률이 그쪽이 높다.
 */
function msg(ko: string | null, en: string | null, es: string | null) {
  return {
    ko: ko || en || es || '',
    en: en || ko || es || '',
    es: es || en || ko || '',
  };
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
  const router = useRouter();
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
        // 못 적으면 서버 쪽 기록이 받아 준다
      }
      // 답을 기다리지 않는다 — 창은 이미 닫혔고, 실패하면 localStorage가 받아 준다
      fetch(`/api/notices/${notice.id}/read`, { method: 'POST', keepalive: true }).catch(() => {});
    }
    setNotice(null);
  }

  /*
   * 「보러 가기」 — 닫는 것과 같은 기록을 남기고 그 화면으로 간다.
   *
   * 읽음 처리를 빼면 「보러 가기」로 나간 사람에게 다음에 또 뜬다. 본 사람에게
   * 다시 띄우는 것이 이 창에서 가장 하면 안 되는 일이라(파일 첫 주석), 나가는 길이
   * 둘이어도 남기는 것은 하나로 맞춘다.
   */
  function go(path: string) {
    close();
    router.push(path);
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
          {t(msg(notice.titleKo, notice.titleEn, notice.titleEs))}
        </h2>
        {(notice.bodyKo || notice.bodyEn || notice.bodyEs) && (
          <p className="notice-body">{t(msg(notice.bodyKo, notice.bodyEn, notice.bodyEs))}</p>
        )}
        {notice.linkPath ? (
          <div className="notice-acts">
            {/* 가는 쪽을 오른쪽에 두고 autoFocus를 준다 — 공지를 올린 목적이 그쪽이다 */}
            <button className="notice-later" onClick={close}>
              {t(T.ok)}
            </button>
            <button className="notice-ok" onClick={() => go(notice.linkPath!)} autoFocus>
              {t(T.go)}
            </button>
          </div>
        ) : (
          <button className="notice-ok" onClick={close} autoFocus>
            {t(T.ok)}
          </button>
        )}
      </div>
    </div>
  );
}
