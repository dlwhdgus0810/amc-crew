'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from './i18n';
import { formatScore, RATING_MAX } from '@/lib/ratings';

/**
 * 무비나잇 평점 패널 — 끝난 모임에만 붙는다.
 *
 * 참가한 사람만 매길 수 있고, 매긴 점수는 모임에 참가한 사람들끼리 서로 보인다.
 * 12명짜리 친구 모임이라 「누가 몇 점 줬는지」가 곧 이야깃거리다 — 평균만 보여주면
 * 그 재미가 없어진다. 참가자 명단은 이 화면에서 이미 이름으로 보이고 있다.
 *
 * 슬라이더로 대충 맞추고 ± 버튼으로 0.1씩 맞춘다. 101단계라 손가락만으로는
 * 8.3과 8.4를 구분할 수 없다.
 */

const T = {
  heading: { ko: '우리 평점', en: 'Our rating' },
  none: { ko: '아직 아무도 점수를 안 매겼어요.', en: 'Nobody has rated this yet.' },
  ofN: { ko: '{n}명 평균', en: 'from {n}' },
  mine: { ko: '내 점수', en: 'Your score' },
  save: { ko: '매기기', en: 'Rate' },
  update: { ko: '고쳐 매기기', en: 'Update' },
  clear: { ko: '무르기', en: 'Clear' },
  saving: { ko: '저장하는 중…', en: 'Saving…' },
  failed: { ko: '저장하지 못했어요.', en: 'Couldn’t save that.' },
  down: { ko: '0.1점 내리기', en: 'Down 0.1' },
  up: { ko: '0.1점 올리기', en: 'Up 0.1' },
  slider: { ko: '평점 (0.0~10.0)', en: 'Rating (0.0–10.0)' },
  onlyThere: {
    ko: '이 모임에 참가한 사람만 점수를 매길 수 있어요.',
    en: 'Only people who were there can rate it.',
  },
};

/** 처음 열었을 때 슬라이더가 놓일 자리 — 한가운데는 「보통」이라는 뜻이 되어 버린다 */
const DEFAULT_SCORE = 8;

export interface RatingPanelProps {
  postId: string;
  /** 서버가 읽어 둔 요약 (PostView.rating) */
  summary: { average: number | null; count: number; mine: number | null };
  /** 누가 몇 점 줬는지 — 서버가 같이 읽어 넘긴다 */
  scores: { userId: string; score: number }[];
  /** 이름을 붙이는 데 쓴다 (점수를 준 사람은 언제나 참가자다) */
  participants: { id: string; name: string }[];
  currentUserId?: string;
}

export default function RatingPanel({
  postId,
  summary,
  scores,
  participants,
  currentUserId,
}: RatingPanelProps) {
  const [draft, setDraft] = useState(summary.mine ?? DEFAULT_SCORE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const t = useT();

  // 서버가 다시 그려 새 prop이 오면 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다)
  useEffect(() => {
    if (summary.mine != null) setDraft(summary.mine);
  }, [summary.mine]);

  const iWasThere = Boolean(currentUserId && participants.some((p) => p.id === currentUserId));
  const nameOf = (userId: string) => participants.find((p) => p.id === userId)?.name ?? '알 수 없음';

  /** 0.1 단위로 붙잡아 둔다 — 슬라이더가 8.299999를 주는 일이 없도록 */
  const clamp = (v: number) => Math.min(RATING_MAX, Math.max(0, Math.round(v * 10) / 10));

  async function save(score: number | null) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/posts/${postId}/rating`, {
      method: score == null ? 'DELETE' : 'PUT',
      ...(score == null
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score }) }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? t(T.failed));
      return;
    }
    // 평균과 남들 점수는 서버가 다시 세어야 한다
    router.refresh();
  }

  return (
    <>
      <h2 id="rating" style={{ scrollMarginTop: 72 }}>
        {t(T.heading)}
      </h2>

      <div className="card rating-card">
        {summary.average == null ? (
          <p className="hint" style={{ margin: 0 }}>
            {t(T.none)}
          </p>
        ) : (
          <div className="rating-avg">
            <span className="rating-avg-num">{formatScore(summary.average)}</span>
            <span className="rating-avg-of">/ {RATING_MAX}</span>
            <span className="rating-avg-n">{t(T.ofN, { n: summary.count })}</span>
          </div>
        )}

        {scores.length > 0 && (
          <ul className="rating-list">
            {scores.map((s) => (
              <li key={s.userId} className={s.userId === currentUserId ? 'me' : ''}>
                <span className="rating-who">{nameOf(s.userId)}</span>
                <span className="rating-bar" aria-hidden="true">
                  <span style={{ width: `${(s.score / RATING_MAX) * 100}%` }} />
                </span>
                <span className="rating-num">{formatScore(s.score)}</span>
              </li>
            ))}
          </ul>
        )}

        {!iWasThere ? (
          <p className="hint" style={{ marginBottom: 0 }}>
            {t(T.onlyThere)}
          </p>
        ) : (
          <div className="rating-input">
            <div className="field-label">{t(T.mine)}</div>
            <div className="rating-row">
              <button
                type="button"
                className="rating-step"
                onClick={() => setDraft((v) => clamp(v - 0.1))}
                disabled={busy || draft <= 0}
                aria-label={t(T.down)}
              >
                −
              </button>
              <input
                type="range"
                min={0}
                max={RATING_MAX}
                step={0.1}
                value={draft}
                disabled={busy}
                onChange={(e) => setDraft(clamp(Number(e.target.value)))}
                aria-label={t(T.slider)}
              />
              <button
                type="button"
                className="rating-step"
                onClick={() => setDraft((v) => clamp(v + 0.1))}
                disabled={busy || draft >= RATING_MAX}
                aria-label={t(T.up)}
              >
                +
              </button>
              <span className="rating-draft">{formatScore(draft)}</span>
            </div>

            <div className="field-row" style={{ marginTop: 12 }}>
              <button className="btn" disabled={busy} onClick={() => save(draft)}>
                {busy ? t(T.saving) : summary.mine == null ? t(T.save) : t(T.update)}
              </button>
              {summary.mine != null && (
                <button className="link-btn" disabled={busy} onClick={() => save(null)}>
                  {t(T.clear)}
                </button>
              )}
            </div>
          </div>
        )}

        {error && <div className="msg err">{error}</div>}
      </div>
    </>
  );
}
