'use client';

/* ============================================================
   app/comment-thread.tsx 를 이 파일로 교체하세요. (시안 4c)
   달라진 점 — API 호출·좋아요 낙관적 반영 로직은 원본과 동일합니다.
   1) 「이름 | 본문 | 액션」 가로 3분할을 버리고 세로로 쌓습니다.
      이름·시간·하트가 윗줄, 본문은 전폭 → 긴 닉네임이 본문 폭을 먹지 않습니다.
   2) 답글은 왼쪽 세로선으로 깊이를 표시(들여쓰기 14px)해 좁은 폭에서도 안 무너집니다.
   3) 답글/삭제는 본문 아래 작은 텍스트 버튼.
   ============================================================ */

import { useState } from 'react';
import { useT } from './i18n';

export interface CommentView {
  id: string;
  userId: string;
  /** 익명 댓글이면 null — 화면에서 "익명"으로 그린다 */
  name: string | null;
  anonymous: boolean;
  body: string;
  createdAt: string;
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
}

const T = {
  empty: { ko: '첫 댓글을 남겨보세요.', en: 'Be the first to comment.' },
  locked: { ko: '댓글 {n}개 — 카카오 로그인 후 볼 수 있어요.', en: '{n} comments — log in with Kakao to read them.' },
  placeholder: { ko: '댓글 남기기', en: 'Write a comment' },
  replyPlaceholder: { ko: '{name}님에게 답글', en: 'Reply to {name}' },
  submit: { ko: '등록', en: 'Post' },
  reply: { ko: '답글', en: 'Reply' },
  cancel: { ko: '취소', en: 'Cancel' },
  del: { ko: '삭제', en: 'Delete' },
  delConfirm: { ko: '댓글을 삭제할까요?', en: 'Delete this comment?' },
  loginToComment: { ko: '카카오 로그인 후 댓글을 남길 수 있어요.', en: 'Log in with Kakao to comment.' },
  likeA11y: { ko: '좋아요', en: 'Like' },
  anonName: { ko: '익명', en: 'Anonymous' },
  // 익명으로 쓴 본인에게만 — 남에게 어떻게 보이는지 알려준다
  anonMine: { ko: '{name}(익명)', en: '{name} (anonymous)' },
  anonToggle: { ko: '익명으로', en: 'Anonymously' },
  anonHint: { ko: '다른 사람에게 닉네임이 안 보여요', en: 'Others won’t see your nickname' },
  failed: { ko: '요청 실패', en: 'Something went wrong' },
  justNow: { ko: '방금', en: 'now' },
  minsAgo: { ko: '{n}분', en: '{n}m' },
  hoursAgo: { ko: '{n}시간', en: '{n}h' },
  daysAgo: { ko: '{n}일', en: '{n}d' },
};

/** 들여쓰기는 이 깊이까지만 — 더 깊어져도 답글은 달리되 가로 공간이 무너지지 않는다 */
const MAX_INDENT = 3;

/**
 * 모임 댓글 — 답글에 다시 답글을 달 수 있고, 좋아요(하트)는 누른 즉시 화면에 반영한다.
 * 피드와 공유 페이지가 함께 쓴다.
 */
export default function CommentThread({
  postId,
  comments,
  currentUserId,
  isAdmin,
  lockedCount,
  onChanged,
  onError,
}: {
  postId: string;
  comments: CommentView[];
  currentUserId?: string;
  isAdmin?: boolean;
  /** 비로그인이라 내려오지 않은 댓글 수 — 있으면 "로그인 후 볼 수 있어요"로 알려준다 */
  lockedCount?: number;
  /** 서버 상태가 바뀌었으니 다시 불러오라는 신호 */
  onChanged: () => Promise<void> | void;
  onError?: (message: string) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  // 하트는 응답을 기다리지 않고 먼저 칠한다 (실패하면 새로고침으로 되돌아온다)
  const [optimistic, setOptimistic] = useState<Record<string, { liked: boolean; likeCount: number }>>({});

  // 부모가 지워진 답글은 최상위로 올린다 — 그러지 않으면 트리에서 빠져 화면에서 사라진다
  const byId = new Map(comments.map((c) => [c.id, c]));
  const roots = comments.filter((c) => !c.parentId || !byId.has(c.parentId));
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  /** "2시간" 처럼 짧게 — 좁은 폭에서 이름 옆에 얹기 위해 */
  function ago(iso: string) {
    const ms = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 1) return t(T.justNow);
    if (mins < 60) return t(T.minsAgo, { n: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t(T.hoursAgo, { n: hours });
    return t(T.daysAgo, { n: Math.floor(hours / 24) });
  }

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, anonymous, ...(replyTo ? { parentId: replyTo.id } : {}) }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? t(T.failed));
      setText('');
      setReplyTo(null);
      await onChanged();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : t(T.failed));
    } finally {
      setBusy(false);
    }
  }

  async function toggleLike(c: CommentView) {
    if (!currentUserId) return;
    const now = optimistic[c.id] ?? { liked: c.likedByMe, likeCount: c.likeCount };
    setOptimistic((prev) => ({
      ...prev,
      [c.id]: { liked: !now.liked, likeCount: now.likeCount + (now.liked ? -1 : 1) },
    }));
    const res = await fetch(`/api/comments/${c.id}/like`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      setOptimistic((prev) => ({ ...prev, [c.id]: { liked: data.liked, likeCount: data.likeCount } }));
    } else {
      setOptimistic((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      onError?.(t(T.failed));
    }
  }

  async function remove(c: CommentView) {
    if (!confirm(t(T.delConfirm))) return;
    setBusy(true);
    const res = await fetch(`/api/comments/${c.id}`, { method: 'DELETE' });
    if (!res.ok) onError?.((await res.json().catch(() => ({}))).error ?? t(T.failed));
    await onChanged();
    setBusy(false);
  }

  function row(c: CommentView, depth: number) {
    const like = optimistic[c.id] ?? { liked: c.likedByMe, likeCount: c.likeCount };
    const mine = currentUserId === c.userId;
    return (
      <div
        key={c.id}
        className={`comment-row ${depth > 0 ? 'reply' : ''}`}
        // 들여쓰기 폭을 CSS 변수로 넘겨 세로선도 같이 따라오게 한다
        style={
          depth > 0
            ? ({ '--indent': `${Math.min(depth, MAX_INDENT) * 14}px` } as React.CSSProperties)
            : undefined
        }
      >
        <div className="comment-head">
          {/*
            * 익명으로 쓴 본인에게는 이름을 그대로 보여주되 (익명)을 덧붙인다.
            * 이름만 보이면 익명으로 달았다는 걸 잊고 남들도 이름을 본다고 여기게 된다.
            */}
          <span className={`comment-author${c.name === null ? ' anon' : ''}`}>
            {c.name === null
              ? t(T.anonName)
              : mine && c.anonymous
                ? t(T.anonMine, { name: c.name })
                : c.name}
          </span>
          <span className="comment-time">{ago(c.createdAt)}</span>
          <button
            className={`heart ${like.liked ? 'on' : ''}`}
            onClick={() => toggleLike(c)}
            disabled={!currentUserId}
            aria-pressed={like.liked}
            aria-label={t(T.likeA11y)}
          >
            {like.liked ? '♥' : '♡'}
            {like.likeCount > 0 && <span className="heart-count">{like.likeCount}</span>}
          </button>
        </div>
        <div className="comment-body">{c.body}</div>
        {(currentUserId || mine || isAdmin) && (
          <div className="comment-actions">
            {currentUserId && (
              <button className="link-btn" disabled={busy} onClick={() => setReplyTo(c)}>
                {t(T.reply)}
              </button>
            )}
            {(mine || isAdmin) && (
              <button className="link-btn danger-text" disabled={busy} onClick={() => remove(c)}>
                {t(T.del)}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  /** 답글의 답글까지 따라 내려가며 그린다 */
  function renderTree(c: CommentView, depth: number): React.ReactNode {
    return (
      <div key={c.id}>
        {row(c, depth)}
        {repliesOf(c.id).map((r) => renderTree(r, depth + 1))}
      </div>
    );
  }

  return (
    <div className="comments">
      {roots.length === 0 && (
        <div className="comment-empty">
          {lockedCount && lockedCount > 0 ? t(T.locked, { n: lockedCount }) : t(T.empty)}
        </div>
      )}
      {roots.map((c) => renderTree(c, 0))}

      {currentUserId ? (
        <div className="comment-compose">
          {replyTo && (
            <div className="reply-chip">
              <span>{t(T.replyPlaceholder, { name: replyTo.name ?? t(T.anonName) })}</span>
              <button className="link-btn" disabled={busy} onClick={() => setReplyTo(null)}>
                {t(T.cancel)}
              </button>
            </div>
          )}
          <div className="compose-row">
            <input
              type="text"
              placeholder={replyTo ? t(T.replyPlaceholder, { name: replyTo.name ?? t(T.anonName) }) : t(T.placeholder)}
              value={text}
              maxLength={300}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && send()}
            />
            <button className="link-btn strong" disabled={busy || !text.trim()} onClick={send}>
              {t(T.submit)}
            </button>
          </div>
          <label className="comment-anon" title={t(T.anonHint)}>
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            <span>{t(T.anonToggle)}</span>
          </label>
        </div>
      ) : (
        <div className="comment-empty">{t(T.loginToComment)}</div>
      )}
    </div>
  );
}
