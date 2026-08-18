'use client';

import Link from 'next/link';
import { catDisplayName, getCategory } from '@/lib/categories';
import { whenLabelShort } from '@/lib/datefmt';
import { buildTimeline, timelineOrder } from '@/lib/photo-timeline';
import { useLocale, useT } from '../i18n';
import { usePosterZoom, type Zoomed } from '../poster-zoom';
import PhotoTimelineView from '../photo-timeline-view';

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
  /* 호스트가 회원 전체에게 열어 둔 묶음 */
  open: { ko: '전체공개', en: 'Open to all', es: 'Abierta a todos' },
  openWhy: {
    ko: '이 모임 사진은 회원 누구나 볼 수 있게 열려 있어요.',
    en: 'These photos are open to every member.',
    es: 'Estas fotos están abiertas a todos los miembros.',
  },
};

export interface PhotoWallGroupView {
  /** 안 갔던 모임이면 null — 그 모임으로 가는 길을 아예 안 준다 */
  postId: string | null;
  category: string;
  title: string | null;
  date: string | null;
  startTime: string | null;
  /** 마지막 날 — 여행처럼 며칠짜리 모임에서만 */
  endDate: string | null;
  urls: string[];
  /** urls와 같은 순서의 격자용 400px */
  thumbs: string[];
  downloads: { url: string; isOriginal: boolean }[];
  /** urls와 같은 순서의 찍은 시각·자리 — 타임라인 카테고리에서만 실린다 */
  taken: {
    takenAt: string | null;
    takenOffset: number | null;
    lat: number | null;
    lon: number | null;
    place: string | null;
  }[];
  /** 숙소 좌표 — 있으면 그 근처 자리에 「숙소」가 붙는다 */
  lodgingAt: { lat: number; lon: number } | null;
  count: number;
  /** 호스트가 회원 전체에게 열어 뒀는지 — 머리줄에 「전체공개」를 붙인다 */
  photosPublic: boolean;
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
        /*
         * 나란한 배열들을 사진 한 장씩으로 묶는다. 서버가 배열로 주는 것은 그쪽이
         * 이미 그 모양이라서고(urls·thumbs·downloads), 여기서부터는 한 장이 한 덩어리다.
         */
        const shots = g.urls.map((src, i) => ({
          id: src,
          src,
          thumb: g.thumbs[i] ?? src,
          downloadUrl: g.downloads[i]?.url ?? null,
          downloadIsOriginal: g.downloads[i]?.isOriginal ?? false,
          ...(g.taken[i] ?? { takenAt: null, takenOffset: null, lat: null, lon: null, place: null }),
        }));
        /*
         * 여행이면 찍은 순서로. 모임 화면과 같은 조건이고 같은 그림을 쓴다
         * (app/photo-timeline-view.tsx).
         */
        const asTimeline = Boolean(cat?.timeline) && shots.some((p) => p.takenAt);
        // 확대 창은 **화면에 놓인 순서**를 따라간다 (받기 주소도 같이 간다)
        const ordered = asTimeline ? timelineOrder(buildTimeline(shots)) : shots;
        const items: Zoomed[] = ordered.map((p) => ({
          src: p.src,
          name: label,
          downloadUrl: p.downloadUrl,
          downloadIsOriginal: p.downloadIsOriginal,
        }));
        const slotOf = new Map(ordered.map((p, i) => [p.id, i]));
        const cell = (p: (typeof shots)[number]) => (
          <div key={p.id} className="wall-cell">
            {zoom.triggerAt(
              items,
              slotOf.get(p.id) ?? 0,
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.thumb} alt="" loading="lazy" />
            )}
          </div>
        );

        return (
          <section key={g.urls[0] ?? g.postId} className="wall-group">
            {/*
              * 머리줄은 **갔던 모임일 때만** 모임 화면으로 간다.
              *
              * 안 갔는데 여기 실린 것은 호스트가 사진을 열어 뒀다는 뜻인데(photosPublic),
              * 그 사람이 연 것은 사진이지 모임이 아니다. 비공개 모임이면 이 링크가 곧
              * 초대장이고 — 링크를 아는 사람만 열 수 있다는 전제가 여기서 깨진다 —
              * 익명 모임이면 명단과 댓글이 딸려 온다.
              *
              * 안 갔으면 같은 줄을 글자로만 그린다. 어느 모임 사진인지는 알아야 하니까.
              */}
            {g.postId ? (
              <Link href={`/p/${g.postId}`} className="wall-head">
                <span className="wall-cat" style={cat ? { background: `var(--cat-${cat.slug})`, color: `var(--cat-${cat.slug}-fg)` } : undefined}>
                  {cat?.emoji} {label}
                </span>
                <span className="wall-when">{whenLabelShort(g.date, g.startTime, locale, g.endDate)}</span>
                {g.title && <span className="wall-title">〈{g.title}〉</span>}
                {g.photosPublic && (
                  <span className="wall-open" title={t(T.openWhy)}>
                    {t(T.open)}
                  </span>
                )}
              </Link>
            ) : (
              <span className="wall-head">
                <span className="wall-cat" style={cat ? { background: `var(--cat-${cat.slug})`, color: `var(--cat-${cat.slug}-fg)` } : undefined}>
                  {cat?.emoji} {label}
                </span>
                <span className="wall-when">{whenLabelShort(g.date, g.startTime, locale, g.endDate)}</span>
                {g.title && <span className="wall-title">〈{g.title}〉</span>}
                {g.photosPublic && (
                  <span className="wall-open" title={t(T.openWhy)}>
                    {t(T.open)}
                  </span>
                )}
              </span>
            )}

            {/*
              * 격자에 그리는 것은 **썸네일(400px)**이고, 눌러서 크게 보는 것은
              * items에 담긴 화면용(1600px)이다. 한 칸이 폰에서 110px 남짓이라
              * 여기에 화면용을 넣으면 첫 화면 열두 칸이 7.5MB가 된다.
              */}
            {asTimeline ? (
              <PhotoTimelineView photos={shots} lodgingAt={g.lodgingAt} renderCell={cell} />
            ) : (
              <div className="wall-grid">{shots.map(cell)}</div>
            )}
            {/*
              * 실은 것보다 많으면 나머지는 모임 화면에서 본다 (목록 응답을 가볍게 두려고 자른다).
              * 안 갔던 모임이면 그 길이 없으므로 남은 장수만 적는다 — 여기까지가 열어 준 몫이다.
              *
              * 타임라인일 때는 격자 밖에 둔다 — 마지막 자리에 끼면 그 시각에 찍은 사진처럼 보인다.
              */}
            {g.count > shots.length && (
              <div className={asTimeline ? 'wall-rest' : 'wall-grid'}>
                {g.postId ? (
                  <Link href={`/p/${g.postId}#photos`} className="wall-cell wall-more">
                    {t(T.more, { n: g.count - shots.length })}
                  </Link>
                ) : (
                  <span className="wall-cell wall-more">{t(T.more, { n: g.count - shots.length })}</span>
                )}
              </div>
            )}
          </section>
        );
      })}

      {zoom.overlay}
    </>
  );
}
