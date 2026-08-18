'use client';

import Link from 'next/link';
import { catDisplayName, getCategory } from '@/lib/categories';
import { timeAgo, whenLabelShort } from '@/lib/datefmt';
import { useLocale, useT } from '../i18n';

/**
 * 후기 모아보기 — 공개 모임의 최근 후기를 한 줄씩.
 *
 * 사진과 달리 **다녀오지 않은 모임의 후기도 읽는다.** 「저기 재미있었대」를 보고 다음에
 * 가보는 것이 이 글의 쓸모라서다. 쓰는 것은 다녀온 사람만이고, 그 자리는 모임 화면에 있다.
 *
 * 익명 카테고리는 이름이 「익명」으로 내려온다 (가리는 일은 서버가 한다).
 */

const T = {
  title: { ko: '후기', en: 'Reviews', es: 'Reseñas' },
  subtitle: {
    ko: '다녀온 사람들이 남긴 한 줄이에요. 후기는 모임 화면에서 남길 수 있어요.',
    en: 'A line each from people who were there. Leave yours on the meetup page.',
    es: 'Una línea de quienes estuvieron. Deja la tuya en la página de la quedada.',
  },
  loginPrompt: {
    ko: '카카오 로그인 후 후기를 볼 수 있어요.',
    en: 'Log in with Kakao to read reviews.',
    es: 'Entra con Kakao para leer las reseñas.',
  },
  empty: {
    ko: '아직 후기가 없어요. 다녀온 모임에 첫 후기를 남겨보세요.',
    en: 'No reviews yet — leave the first one on a meetup you went to.',
    es: 'Aún no hay reseñas: deja la primera en una quedada a la que fuiste.',
  },
};

export interface RecentReviewView {
  /** 비공개 모임이면 null — 그 모임으로 가는 길을 아예 안 준다 (lib/db/reviews.ts) */
  postId: string | null;
  category: string;
  title: string | null;
  date: string | null;
  startTime: string | null;
  userId: string;
  name: string;
  avatar: string | null;
  body: string;
  updatedAt: string;
  mine: boolean;
}

export default function ReviewsClient({ initial }: { initial: { rows: RecentReviewView[] } | null }) {
  const t = useT();
  const locale = useLocale();

  if (!initial) {
    return (
      <>
        <h1>{t(T.title)}</h1>
        <div className="card">{t(T.loginPrompt)}</div>
      </>
    );
  }

  const { rows } = initial;

  return (
    <>
      <h1>{t(T.title)}</h1>
      <p className="subtitle">{t(T.subtitle)}</p>

      {rows.length === 0 && <div className="card">{t(T.empty)}</div>}

      {rows.length > 0 && (
        <ul className="feed-reviews">
          {rows.map((r) => {
            const cat = getCategory(r.category);
            const label = cat ? t(catDisplayName(r.category)) : r.category;
            return (
              <li key={`${r.postId ?? r.category}:${r.updatedAt}`} className="card feed-review">
                <p className="feed-review-body">{r.body}</p>
                {/*
                  * 머리줄은 **갈 곳이 있을 때만** 링크다. 비공개 모임이면 id가 안 내려와서
                  * (lib/db/reviews.ts) 종목과 날짜만 적는다 — 사진 쪽과 같은 규칙이다.
                  */}
                {r.postId ? (
                  <Link href={`/p/${r.postId}#reviews`} className="feed-review-meta">
                    <span className="feed-review-cat" style={cat ? { background: cat.color, color: cat.fg } : undefined}>
                      {cat?.emoji} {label}
                    </span>
                    <span>{whenLabelShort(r.date, r.startTime, locale)}</span>
                  </Link>
                ) : (
                  <span className="feed-review-meta">
                    <span className="feed-review-cat" style={cat ? { background: cat.color, color: cat.fg } : undefined}>
                      {cat?.emoji} {label}
                    </span>
                    <span>{whenLabelShort(r.date, r.startTime, locale)}</span>
                  </span>
                )}
                <span className="feed-review-by">
                  {r.name} · {timeAgo(r.updatedAt, locale)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
