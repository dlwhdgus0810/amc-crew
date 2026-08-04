'use client';

import { useEffect, useState } from 'react';
import { useT } from './i18n';

/**
 * 포스터를 눌러 크게 보는 창.
 *
 * AMC 상영표와 모임 카드가 같이 쓴다. 예전에는 상영표 안에만 있었는데, 모임 카드에도
 * 포스터가 붙으면서 같은 것이 둘이 될 참이었다 — Esc로 닫기, 뒤 화면 스크롤 막기처럼
 * 눈에 안 보이는 처리가 한쪽에만 있으면 어느 쪽이 맞는지 알 수 없게 된다.
 */

const T = {
  zoom: { ko: '{name} 포스터 크게 보기', en: 'View the {name} poster larger' },
  close: { ko: '닫기', en: 'Close' },
};

export interface Zoomed {
  src: string;
  name: string;
}

export function usePosterZoom() {
  const [zoomed, setZoomed] = useState<Zoomed | null>(null);
  const t = useT();

  // 크게 본 동안에는 Esc로 닫고, 뒤 화면이 따라 스크롤되지 않게 막는다
  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomed(null);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [zoomed]);

  return {
    /** 포스터를 누를 수 있게 감싸는 버튼 — 그림만 넘기면 된다 */
    trigger(src: string, name: string, children: React.ReactNode) {
      return (
        <button
          type="button"
          className="poster-btn"
          onClick={() => setZoomed({ src, name })}
          aria-label={t(T.zoom, { name })}
        >
          {children}
        </button>
      );
    },
    /** 화면 맨 끝에 한 번 놓는다 */
    overlay: zoomed ? (
      // 배경 아무 데나 눌러도 닫힌다 — 폰에서는 닫기 버튼보다 이쪽이 편하다
      <div className="poster-zoom" onClick={() => setZoomed(null)} role="presentation">
        <div className="poster-zoom-inner" role="dialog" aria-modal="true" aria-label={zoomed.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomed.src} alt={zoomed.name} />
          <span className="poster-zoom-name">{zoomed.name}</span>
        </div>
        <button type="button" className="poster-zoom-close" aria-label={t(T.close)}>
          ✕
        </button>
      </div>
    ) : null,
  };
}
