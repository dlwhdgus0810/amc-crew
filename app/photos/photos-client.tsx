'use client';

import { useState } from 'react';
import Link from 'next/link';
import { catDisplayName, getCategory } from '@/lib/categories';
import { whenLabelShort } from '@/lib/datefmt';
import { useLocale, useT } from '../i18n';
import { useSavePhotos } from '../save-photos';
import { usePosterZoom, type Zoomed } from '../poster-zoom';

/**
 * 사진 모아보기 — 내가 다녀온 모임들의 사진을 모임별로 묶어 보여준다.
 *
 * **내가 갔던 모임만 나온다.** 사진은 같이 논 사람들 사이의 것이라는 규칙이 모임 화면에
 * 이미 있고(참가자에게만 붙는다), 모아 본다고 그 전제를 넓히지 않는다.
 *
 * 사진을 누르면 모임 화면과 같은 확대 창이 열린다 — 받기 버튼까지 그대로 따라온다.
 */

const T = {
  title: { ko: '사진', en: 'Photos', es: 'Fotos' },
  subtitle: {
    ko: '다녀온 모임에서 우리가 찍은 사진들이에요.',
    en: 'Photos from the meetups you went to.',
    es: 'Fotos de las quedadas a las que fuiste.',
  },
  loginPrompt: {
    ko: '카카오 로그인 후 다녀온 모임의 사진을 볼 수 있어요.',
    en: 'Log in with Kakao to see photos from your meetups.',
    es: 'Entra con Kakao para ver las fotos de tus quedadas.',
  },
  empty: {
    ko: '아직 사진이 없어요. 다녀온 모임에서 한 장 올려보세요.',
    en: 'No photos yet — add one from a meetup you went to.',
    es: 'Aún no hay fotos: sube una desde una quedada a la que fuiste.',
  },
  more: { ko: '+{n}장 더', en: '+{n} more', es: '+{n} más' },
};

export interface PhotoWallGroupView {
  postId: string;
  category: string;
  title: string | null;
  date: string | null;
  startTime: string | null;
  urls: string[];
  /** urls와 같은 순서의 격자용 400px */
  thumbs: string[];
  count: number;
}

export default function PhotosClient({ initial }: { initial: { groups: PhotoWallGroupView[] } | null }) {
  const [err, setErr] = useState<string | null>(null);
  const saveAll = useSavePhotos(setErr);
  const t = useT();
  const locale = useLocale();
  const zoom = usePosterZoom();

  if (!initial) {
    return (
      <>
        <h1>{t(T.title)}</h1>
        <div className="card">{t(T.loginPrompt)}</div>
      </>
    );
  }

  const { groups } = initial;

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

      {groups.length === 0 && <div className="card">{t(T.empty)}</div>}
      {err && <div className="msg err">{err}</div>}

      {groups.map((g) => {
        const cat = getCategory(g.category);
        const label = cat ? t(catDisplayName(g.category)) : g.category;
        /*
         * 확대 창에 넘길 목록 — 격자 순서 그대로.
         *
         * **받기 버튼은 안 붙인다.** 여기는 「지난 사진들을 훑는」 화면이라 넘겨 보다가
         * 한 장을 저장하는 자리가 아니다. 받을 일이 생기면 모임 화면으로 가면 되고,
         * 거기에는 한 장 받기와 전부 받기가 다 있다.
         */
        const items: Zoomed[] = g.urls.map((src) => ({ src, name: label }));

        return (
          <section key={g.postId} className="wall-group">
            <Link href={`/p/${g.postId}`} className="wall-head">
              <span className="wall-cat" style={cat ? { background: cat.color, color: cat.fg } : undefined}>
                {cat?.emoji} {label}
              </span>
              <span className="wall-when">{whenLabelShort(g.date, g.startTime, locale)}</span>
              {g.title && <span className="wall-title">〈{g.title}〉</span>}
            </Link>

            {/*
              * 이 모임 사진 전부 받기.
              *
              * 여기 실린 것은 앞의 스무 장뿐이라, 주소는 눌렀을 때 서버에서 받아 온다 —
              * 미리 다 실으면 안 누를 사람 몫까지 응답이 무거워진다.
              *
              * 한 장짜리 모임에는 안 붙인다. 사진을 눌러 받는 것과 같은 일이라서다.
              */}
            {g.count > 1 && (
              <button
                className="wall-save"
                disabled={saveAll.busy}
                onClick={() =>
                  saveAll.run(async () => {
                    const res = await fetch(`/api/posts/${g.postId}/photos`, { cache: 'no-store' });
                    if (!res.ok) throw new Error(String(res.status));
                    const data = await res.json();
                    return (data.photos as { downloadUrl: string }[]).map((p) => p.downloadUrl);
                  })
                }
              >
                {saveAll.label(g.count)}
              </button>
            )}

            <div className="wall-grid">
              {/*
                * 격자에 그리는 것은 **썸네일(400px)**이고, 눌러서 크게 보는 것은
                * items에 담긴 화면용(1600px)이다. 한 칸이 폰에서 110px 남짓이라
                * 여기에 화면용을 넣으면 첫 화면 열두 칸이 7.5MB가 된다.
                */}
              {g.urls.map((src, i) => (
                <div key={src} className="wall-cell">
                  {zoom.triggerAt(
                    items,
                    i,
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.thumbs[i] ?? src} alt="" loading="lazy" />
                  )}
                </div>
              ))}
              {/* 실은 것보다 많으면 나머지는 모임 화면에서 본다 (목록 응답을 가볍게 두려고 자른다) */}
              {g.count > g.urls.length && (
                <Link href={`/p/${g.postId}#photos`} className="wall-cell wall-more">
                  {t(T.more, { n: g.count - g.urls.length })}
                </Link>
              )}
            </div>
          </section>
        );
      })}

      {zoom.overlay}
    </>
  );
}
