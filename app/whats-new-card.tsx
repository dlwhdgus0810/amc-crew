'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { latestAt, latestNotable } from '@/lib/changelog';
import { useT } from './i18n';

/** 마지막으로 확인한 소식의 날짜 (YYYY-MM-DD) */
export const WHATS_NEW_SEEN = 'kk-whats-new-seen';

const T = {
  label: { ko: '새 소식', en: 'What’s new', es: 'Novedades' },
  go: { ko: '보기 →', en: 'See what changed →', es: 'Ver qué cambió →' },
  close: { ko: '닫기', en: 'Dismiss', es: 'Cerrar' },
};

/**
 * 홈 맨 위의 "새 소식" 한 줄.
 *
 * 화면 위에 떠 있는 배너가 아니라 본문 안의 카드다 — 이 앱은 이미 위쪽에 얹히는 게
 * 둘(테스트 계정 띠, 홈 화면에 추가 안내) 있어서, 셋이 겹치면 정작 내용이 안 보인다.
 *
 * 마지막으로 본 소식보다 새 것이 있을 때만 나온다. 읽음 표시는 localStorage에
 * 날짜 하나뿐이라 DB 컬럼이 필요 없다 — 기기마다 한 번씩 더 보이는 정도는 감수한다.
 */
export default function WhatsNewCard() {
  const [show, setShow] = useState(false);
  /*
   * 보여주는 항목과 "새 것인지" 재는 기준은 서로 다르다.
   * 카드에는 고정된 소식(제일 중요한 기능)을 띄우고, 새로 뜰지 말지는 소식 전체의
   * 최신 시각으로 잰다 — 고정된 항목의 시각으로 재면 그 뒤에 뭐가 올라와도 다시 뜨지 않는다.
   */
  const entry = latestNotable();
  const at = latestAt();
  const t = useT();

  useEffect(() => {
    if (!entry || !at) return;
    let seen: string | null = null;
    try {
      seen = localStorage.getItem(WHATS_NEW_SEEN);
    } catch {
      // 저장소를 못 읽으면 그냥 보여준다 (안 보이는 것보다 낫다)
    }
    // ISO 문자열은 사전순 비교가 곧 시간순 비교다
    setShow(!seen || seen < at);
  }, [entry, at]);

  if (!entry || !show) return null;

  function dismiss() {
    setShow(false);
    try {
      if (at) localStorage.setItem(WHATS_NEW_SEEN, at);
    } catch {
      // 못 적으면 다음에 또 뜬다 — 그뿐이다
    }
  }

  return (
    <div className="whatsnew">
      <span className="whatsnew-tag">{t(T.label)}</span>
      <Link href="/whats-new" className="whatsnew-text" onClick={dismiss}>
        {t(entry.title)}
        <span className="whatsnew-go">{t(T.go)}</span>
      </Link>
      <button className="whatsnew-x" onClick={dismiss} aria-label={t(T.close)}>
        ✕
      </button>
    </div>
  );
}
