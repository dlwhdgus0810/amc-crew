'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useT } from './i18n';
import { timeAgo } from '@/lib/datefmt';
import { REVIEW_MAX } from '@/lib/reviews';

/**
 * 모임 한줄 후기 — 끝난 모임에만 붙는다.
 *
 * 다녀온 사람이 한 줄 남기고, 그 모임의 후기는 회원 누구나 읽는다. 「저기 재미있었대」를
 * 보고 다음에 가보는 것이 이 글의 쓸모라, 읽는 쪽을 참가자로 좁히지 않았다.
 *
 * 평점 패널(app/rating-panel.tsx)과 얼개가 같다. 다른 점은 어느 모임에나 붙는다는 것 —
 * 평점은 무비나잇 전용이다.
 *
 * 익명 카테고리에서는 이름이 「익명」으로 내려온다. 가리는 일은 서버가 하고
 * (lib/db/reviews.ts의 mask), 여기서는 받은 대로 그린다.
 */

const T = {
  heading: { ko: '후기', en: 'Reviews', es: 'Reseñas' },
  none: { ko: '아직 후기가 없어요.', en: 'No reviews yet.', es: 'Todavía no hay reseñas.' },
  placeholder: { ko: '어땠는지 한 줄 남겨주세요', en: 'How was it? One line', es: '¿Qué tal estuvo? Una línea' },
  save: { ko: '남기기', en: 'Post', es: 'Publicar' },
  update: { ko: '고치기', en: 'Update', es: 'Cambiar' },
  clear: { ko: '지우기', en: 'Delete', es: 'Borrar' },
  saving: { ko: '저장하는 중…', en: 'Saving…', es: 'Guardando…' },
  failed: { ko: '저장하지 못했어요.', en: 'Couldn’t save that.', es: 'No se pudo guardar.' },
  onlyThere: {
    ko: '이 모임에 다녀온 사람만 후기를 남길 수 있어요.',
    en: 'Only people who were there can leave a review.',
    es: 'Solo quien estuvo allí puede dejar una reseña.',
  },
  left: { ko: '{n}자 남음', en: '{n} left', es: 'Quedan {n}' },
  /*
   * 쓰기 전에 알려 준다. 이름이 붙는 줄 알고 쓰는 것과 안 붙는 줄 알고 쓰는 것은
   * 아예 다른 글이 되므로, 다 쓴 뒤에 알려 주면 늦다.
   */
  anonNote: {
    ko: '후기는 이름 없이 올라가요. 아쉬웠던 점도 편하게 적어주세요.',
    en: 'Reviews go up without your name — say the awkward parts too.',
    es: 'Las reseñas se publican sin tu nombre: cuenta también lo que no salió bien.',
  },
};

export interface ReviewItem {
  userId: string;
  name: string;
  avatar: string | null;
  body: string;
  updatedAt: string;
  mine: boolean;
}

export default function ReviewPanel({
  postId,
  reviews,
  canWrite,
}: {
  postId: string;
  /** 서버가 읽어 넘긴 그 모임의 후기 (최신순) */
  reviews: ReviewItem[];
  /** 지난 모임 + 참가자일 때만 true — 서버도 같은 조건을 다시 본다 */
  canWrite: boolean;
}) {
  const mine = reviews.find((r) => r.mine);
  const [draft, setDraft] = useState(mine?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const t = useT();
  const locale = useLocale();

  // 서버가 다시 그려 새 prop이 오면 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다)
  useEffect(() => {
    setDraft(mine?.body ?? '');
  }, [mine?.body]);

  async function save(body: string | null) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/posts/${postId}/review`, {
      method: body == null ? 'DELETE' : 'PUT',
      ...(body == null ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? t(T.failed));
      return;
    }
    // 남들 후기까지 다시 읽어야 한다 — 그 사이에 누가 남겼을 수 있다
    router.refresh();
  }

  const text = draft.trim();
  const changed = text !== (mine?.body ?? '');

  return (
    <>
      <h2 id="reviews" style={{ scrollMarginTop: 72 }}>
        {t(T.heading)} {reviews.length > 0 ? reviews.length : ''}
      </h2>

      <div className="card">
        {reviews.length === 0 && (
          <p className="hint" style={{ margin: 0 }}>
            {t(T.none)}
          </p>
        )}

        {reviews.length > 0 && (
          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r.userId || r.updatedAt} className="review-row">
                <span className="review-body">{r.body}</span>
                <span className="review-by">
                  {r.name} · {timeAgo(r.updatedAt, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {canWrite ? (
          <div className="review-write">
            {/* 이름이 안 붙는다는 것을 쓰기 전에 알려 준다 */}
            <p className="hint" style={{ margin: '0 0 8px' }}>{t(T.anonNote)}</p>
            <input
              type="text"
              value={draft}
              maxLength={REVIEW_MAX}
              placeholder={t(T.placeholder)}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && text && changed && save(text)}
            />
            <div className="field-row" style={{ marginTop: 10 }}>
              <button disabled={busy || !text || !changed} onClick={() => save(text)}>
                {busy ? t(T.saving) : t(mine ? T.update : T.save)}
              </button>
              {mine && (
                <button className="secondary danger" disabled={busy} onClick={() => save(null)}>
                  {t(T.clear)}
                </button>
              )}
              <span className="hint" style={{ marginLeft: 'auto' }}>
                {t(T.left, { n: REVIEW_MAX - draft.length })}
              </span>
            </div>
          </div>
        ) : (
          reviews.length > 0 && (
            <p className="hint" style={{ margin: '12px 0 0' }}>
              {t(T.onlyThere)}
            </p>
          )
        )}

        {error && <div className="msg err">{error}</div>}
      </div>
    </>
  );
}
