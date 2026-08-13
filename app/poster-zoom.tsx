'use client';

import { useCallback, useEffect, useState } from 'react';
import { useT } from './i18n';

/**
 * 그림을 눌러 크게 보는 창.
 *
 * AMC 상영표, 모임 카드의 포스터, 그리고 모임 사진이 같이 쓴다. 예전에는 상영표 안에만
 * 있었는데, 같은 것이 둘이 되면 Esc로 닫기·뒤 화면 스크롤 막기처럼 눈에 안 보이는 처리가
 * 한쪽에만 남아 어느 쪽이 맞는지 알 수 없게 된다.
 *
 * 여러 장을 넘겨 볼 수 있다. 스무 장짜리 모임 사진을 한 장씩 닫았다 여는 것은 실제로
 * 불평이 나오는 지점이라, 한 장짜리 확대와 같은 창에서 처리한다.
 */

const T = {
  zoom: { ko: '{name} 크게 보기', en: 'View {name} larger', es: 'Ver {name} más grande' },
  close: { ko: '닫기', en: 'Close', es: 'Cerrar' },
  prev: { ko: '이전 사진', en: 'Previous', es: 'Anterior' },
  next: { ko: '다음 사진', en: 'Next', es: 'Siguiente' },
  count: { ko: '{i} / {n}', en: '{i} / {n}', es: '{i} / {n}' },
  original: { ko: '원본 받기', en: 'Download original', es: 'Descargar original' },
  /* 원본이 저장되기 전에 올라온 사진 — 받을 수 있는 것은 보이는 줄인 쪽뿐이다 */
  saveShrunk: { ko: '사진 받기', en: 'Download photo', es: 'Descargar foto' },
};

export interface Zoomed {
  src: string;
  name: string;
  /** 사진이면 올린 사람 — 상영표 포스터에는 없다 */
  by?: string;
  /**
   * 받기 주소. 사진에는 언제나 있고, 상영표 포스터에는 없다.
   *
   * 원본이 저장돼 있으면 그 파일, 없으면 화면에 보이는 줄인 사진이다.
   * 어느 쪽인지는 아래 값이 말하고, 버튼 이름이 그에 따라 갈린다.
   */
  downloadUrl?: string | null;
  /** 위 주소가 올린 파일 그대로인지 — 버튼 이름이 갈린다 */
  downloadIsOriginal?: boolean;
}

export function usePosterZoom() {
  const [open, setOpen] = useState<{ items: Zoomed[]; index: number } | null>(null);
  const t = useT();

  const move = useCallback((step: number) => {
    setOpen((cur) => {
      if (!cur || cur.items.length < 2) return cur;
      // 양 끝에서 멈춘다 — 스무 장을 넘기다 처음으로 되돌아가면 어디까지 봤는지 잃는다
      const next = Math.min(cur.items.length - 1, Math.max(0, cur.index + step));
      return next === cur.index ? cur : { ...cur, index: next };
    });
  }, []);

  // 크게 본 동안에는 Esc로 닫고 ←→로 넘기며, 뒤 화면이 따라 스크롤되지 않게 막는다
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      else if (e.key === 'ArrowLeft') move(-1);
      else if (e.key === 'ArrowRight') move(1);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, move]);

  const cur = open ? open.items[open.index] : null;
  const many = (open?.items.length ?? 0) > 1;

  return {
    /** 한 장짜리 — 상영표와 모임 카드의 포스터가 쓴다 (부르는 모양은 예전 그대로) */
    trigger(src: string, name: string, children: React.ReactNode) {
      return (
        <button
          type="button"
          className="poster-btn"
          onClick={() => setOpen({ items: [{ src, name }], index: 0 })}
          aria-label={t(T.zoom, { name })}
        >
          {children}
        </button>
      );
    },
    /** 여러 장 — 고른 자리에서 열고 좌우로 넘긴다 */
    triggerAt(items: Zoomed[], index: number, children: React.ReactNode) {
      return (
        <button
          type="button"
          className="poster-btn"
          onClick={() => items.length > 0 && setOpen({ items, index })}
          aria-label={t(T.zoom, { name: items[index]?.name ?? '' })}
        >
          {children}
        </button>
      );
    },
    /** 화면 맨 끝에 한 번 놓는다 */
    overlay: cur ? (
      // 배경 아무 데나 눌러도 닫힌다 — 폰에서는 닫기 버튼보다 이쪽이 편하다
      <div className="poster-zoom" onClick={() => setOpen(null)} role="presentation">
        {many && (
          <span className="poster-zoom-count">{t(T.count, { i: open!.index + 1, n: open!.items.length })}</span>
        )}
        <div className="poster-zoom-inner" role="dialog" aria-modal="true" aria-label={cur.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cur.src} alt={cur.name} />
          <span className="poster-zoom-name">
            {cur.by ? `${cur.name} · ${cur.by}` : cur.name}
            {cur.downloadUrl && (
              <>
                {' · '}
                {/*
                 * 저장소가 다른 도메인이라 download 속성은 무시된다 — 브라우저가 열거나
                 * 받는 것은 저장소가 보내는 헤더가 정한다. 새 창으로 띄워 두면 어느 쪽이든
                 * 보던 화면이 날아가지 않는다.
                 */}
                <a
                  href={cur.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="poster-zoom-orig"
                >
                  {t(cur.downloadIsOriginal ? T.original : T.saveShrunk)}
                </a>
              </>
            )}
          </span>
        </div>
        {many && (
          <>
            <button
              type="button"
              className="poster-zoom-nav prev"
              disabled={open!.index === 0}
              aria-label={t(T.prev)}
              onClick={(e) => {
                e.stopPropagation();
                move(-1);
              }}
            >
              ‹
            </button>
            <button
              type="button"
              className="poster-zoom-nav next"
              disabled={open!.index === open!.items.length - 1}
              aria-label={t(T.next)}
              onClick={(e) => {
                e.stopPropagation();
                move(1);
              }}
            >
              ›
            </button>
          </>
        )}
        <button type="button" className="poster-zoom-close" aria-label={t(T.close)}>
          ✕
        </button>
      </div>
    ) : null,
  };
}
