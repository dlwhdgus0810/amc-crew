'use client';

import { useRef, useState } from 'react';

/**
 * 왼쪽으로 밀면 「지우기」가 나오는 줄 — 아이폰 메시지와 같은 방식.
 *
 * ✕ 버튼을 줄 안에 두면 그만큼 문구 자리가 좁아진다. 알림은 한 줄짜리 문장이라
 * 그 32px이 줄바꿈을 만든다. 그래서 버튼을 줄 뒤에 숨기고, 필요할 때만 꺼낸다.
 *
 * 여는 방법은 둘이다: 살짝 밀면 버튼이 나와 누를 수 있고, 끝까지 밀면 바로 지워진다.
 */

/** 버튼이 드러나는 너비 (px) */
const REVEAL = 88;
/** 이만큼 밀면 손을 떼는 순간 바로 지운다 — 버튼을 겨냥하지 않아도 되게 */
const COMMIT = 200;
/** 세로가 이보다 크면 스크롤로 본다 */
const SLOP = 10;

export default function NotifSwipe({
  children,
  label,
  onDelete,
  disabled,
}: {
  children: React.ReactNode;
  /** 지우기 버튼 문구 */
  label: string;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  /** 가로로 밀고 있는 중인지 — 확정되기 전에는 스크롤을 방해하지 않는다 */
  const dragging = useRef(false);
  /** 민 뒤의 탭은 링크를 열지 않는다 (미는 손짓 끝에 click이 따라오는 기기가 있다) */
  const moved = useRef(false);

  const setX = (px: number) => {
    if (body.current) body.current.style.transform = px === 0 ? '' : `translateX(${px}px)`;
  };
  /*
   * 빨간 버튼은 밀기 시작할 때만 그린다.
   * 늘 깔아두면 몸통과 버튼의 아래 모서리가 소수점 픽셀에서 어긋나 빨간 실선이 비친다.
   * (몸통이 정확히 덮고 있어도 그렇다 — 반올림 문제라 크기로는 못 막는다)
   */
  const showDel = (on: boolean) => {
    if (!box.current) return;
    if (on) box.current.dataset.live = '1';
    else delete box.current.dataset.live;
  };
  const settle = (px: number) => {
    if (!body.current) return;
    body.current.style.transition = 'transform 180ms cubic-bezier(0.22, 0.61, 0.36, 1)';
    setX(px);
    window.setTimeout(() => {
      if (body.current) body.current.style.transition = '';
    }, 200);
  };

  function onTouchStart(e: React.TouchEvent) {
    if (disabled || e.touches.length !== 1) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    dragging.current = false;
    moved.current = false;
    if (body.current) body.current.style.transition = '';
  }

  function onTouchMove(e: React.TouchEvent) {
    if (disabled || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!dragging.current) {
      // 세로가 이기면 스크롤이다 — 이번 손짓은 놓아준다
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (Math.abs(dx) < SLOP) return;
      dragging.current = true;
      moved.current = true;
      showDel(true);
    }
    // 열린 상태에서 이어 밀 수 있게 지금 위치를 더한다. 오른쪽으로는 제자리까지만.
    const x = Math.min(0, (open ? -REVEAL : 0) + dx);
    setX(x);
    // 여기서부터는 우리 손짓이다 (세로 스크롤이 같이 일어나지 않게)
    if (e.cancelable) e.preventDefault();
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (disabled || !dragging.current) return;
    dragging.current = false;
    const dx = (e.changedTouches[0]?.clientX ?? startX.current) - startX.current;
    const x = Math.min(0, (open ? -REVEAL : 0) + dx);
    if (-x >= COMMIT) {
      // 끝까지 밀었다 — 겨냥할 것 없이 바로 지운다
      settle(-window.innerWidth);
      onDelete();
      return;
    }
    const next = -x > REVEAL / 2;
    setOpen(next);
    settle(next ? -REVEAL : 0);
    if (!next) window.setTimeout(() => showDel(false), 200);
  }

  return (
    <div className="notif-swipe" ref={box} {...(open ? { 'data-live': '1' } : {})}>
      <button
        className="notif-swipe-del"
        tabIndex={open ? 0 : -1}
        aria-hidden={!open}
        disabled={disabled}
        onClick={() => {
          setOpen(false);
          onDelete();
        }}
      >
        {label}
      </button>
      <div
        ref={body}
        className="notif-swipe-body"
        style={open ? { transform: `translateX(-${REVEAL}px)` } : undefined}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          dragging.current = false;
          setOpen(false);
          settle(0);
          window.setTimeout(() => showDel(false), 200);
        }}
        onClickCapture={(e) => {
          // 밀어서 연 상태에서의 탭은 링크를 열지 않고 닫기만 한다
          if (moved.current || open) {
            e.preventDefault();
            e.stopPropagation();
            moved.current = false;
            if (open) {
              setOpen(false);
              settle(0);
              window.setTimeout(() => showDel(false), 200);
            }
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}
