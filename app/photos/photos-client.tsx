'use client';

import Link from 'next/link';
import { catDisplayName, getCategory } from '@/lib/categories';
import { whenLabelShort } from '@/lib/datefmt';
import { useLocale, useT } from '../i18n';
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
  downloads: { url: string; isOriginal: boolean }[];
  count: number;
}

export default function PhotosClient({ initial }: { initial: { groups: PhotoWallGroupView[] } | null }) {
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

      {groups.map((g) => {
        const cat = getCategory(g.category);
        const label = cat ? t(catDisplayName(g.category)) : g.category;
        // 확대 창에 넘길 목록 — 격자 순서 그대로 (받기 주소도 같이 간다)
        const items: Zoomed[] = g.urls.map((src, i) => ({
          src,
          name: label,
          downloadUrl: g.downloads[i]?.url ?? null,
          downloadIsOriginal: g.downloads[i]?.isOriginal ?? false,
        }));

        return (
          <section key={g.postId} className="wall-group">
            <Link href={`/p/${g.postId}`} className="wall-head">
              <span className="wall-cat" style={cat ? { background: cat.color, color: cat.fg } : undefined}>
                {cat?.emoji} {label}
              </span>
              <span className="wall-when">{whenLabelShort(g.date, g.startTime, locale)}</span>
              {g.title && <span className="wall-title">〈{g.title}〉</span>}
            </Link>

            <div className="wall-grid">
              {g.urls.map((src, i) => (
                <div key={src} className="wall-cell">
                  {zoom.triggerAt(
                    items,
                    i,
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" loading="lazy" />
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
