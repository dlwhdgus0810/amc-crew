'use client';

import { useState } from 'react';
import { useT } from './i18n';

export interface CommentView {
  id: string;
  userId: string;
  name: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
}

const T = {
  empty: { ko: '첫 댓글을 남겨보세요.', en: 'Be the first to comment.' },
  placeholder: { ko: '댓글 남기기', en: 'Write a comment' },
  replyPlaceholder: { ko: '{name}님에게 답글', en: 'Reply to {name}' },
  submit: { ko: '등록', en: 'Post' },
  reply: { ko: '답글', en: 'Reply' },
  cancel: { ko: '취소', en: 'Cancel' },
  del: { ko: '삭제', en: 'Delete' },
  delConfirm: { ko: '댓글을 삭제할까요?', en: 'Delete this comment?' },
  loginToComment: { ko: '카카오 로그인 후 댓글을 남길 수 있어요.', en: 'Log in with Kakao to comment.' },
  likeA11y: { ko: '좋아요', en: 'Like' },
  failed: { ko: '요청 실패', en: 'Something went wrong' },
};

/** 들여쓰기는 이 깊이까지만 — 더 깊어져도 답글은 달리되 가로 공간이 무너지지 않는다 */
const MAX_INDENT = 4;

/**
 * 모임 댓글 — 답글에 다시 답글을 달 수 있고, 좋아요(하트)는 누른 즉시 화면에 반영한다.
 * 피드와 공유 페이지가 함께 쓴다.
 */
export default function CommentThread({
  postId,
  comments,
  currentUserId,
  isAdmin,
  onChanged,
  onError,
}: {
  postId: string;
  comments: CommentView[];
  currentUserId?: string;
  isAdmin?: boolean;
  /** 서버 상태가 바뀌었으니 다시 불러오라는 신호 */
  onChanged: () => Promise<void> | void;
  onError?: (message: string) => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentView | null>(null);
  // 하트는 응답을 기다리지 않고 먼저 칠한다 (실패하면 새로고침으로 되돌아온다)
  const [optimistic, setOptimistic] = useState<Record<string, { liked: boolean; likeCount: number }>>({});

  // 부모가 지워진 답글은 최상위로 올린다 — 그러지 않으면 트리에서 빠져 화면에서 사라진다
  const byId = new Map(comments.map((c) => [c.id, c]));
  const roots = comments.filter((c) => !c.parentId || !byId.has(c.parentId));
  const repliesOf = (id: string) => comments.filter((c) => c.parentId === id);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, ...(replyTo ? { parentId: replyTo.id } : {}) }),
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
    return (
      <div
        key={c.id}
        className={`comment-row ${depth > 0 ? 'reply' : ''}`}
        // 들여쓰기 폭을 CSS 변수로 넘겨 ↳ 표시도 같이 따라오게 한다
        style={
          depth > 0
            ? ({ '--indent': `${Math.min(depth, MAX_INDENT) * 22}px` } as React.CSSProperties)
            : undefined
        }
      >
        <span className="comment-author">{c.name}</span>
        <span className="comment-body">{c.body}</span>
        <span className="comment-actions">
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
          {currentUserId && (
            <button className="secondary" disabled={busy} onClick={() => setReplyTo(c)}>
              {t(T.reply)}
            </button>
          )}
          {(currentUserId === c.userId || isAdmin) && (
            <button className="danger" disabled={busy} onClick={() => remove(c)}>
              {t(T.del)}
            </button>
          )}
        </span>
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
        <div className="comment-row" style={{ color: 'var(--text-dim)' }}>{t(T.empty)}</div>
      )}
      {roots.map((c) => renderTree(c, 0))}

      {currentUserId ? (
        <div className="field-row" style={{ marginTop: 12 }}>
          <input
            type="text"
            placeholder={replyTo ? t(T.replyPlaceholder, { name: replyTo.name }) : t(T.placeholder)}
            value={text}
            maxLength={300}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && send()}
            style={{ maxWidth: 420 }}
          />
          <button className="secondary" disabled={busy || !text.trim()} onClick={send}>
            {t(T.submit)}
          </button>
          {replyTo && (
            <button className="secondary" disabled={busy} onClick={() => setReplyTo(null)}>
              {t(T.cancel)}
            </button>
          )}
        </div>
      ) : (
        <div className="comment-row" style={{ color: 'var(--text-dim)' }}>{t(T.loginToComment)}</div>
      )}
    </div>
  );
}
