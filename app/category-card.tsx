'use client';

/* ============================================================
   app/category-card.tsx 를 이 파일로 교체하세요. (시안 3a)
   컬러 블록 카드 + 하단에 "다음 일정 한 줄".
   ★/구독은 글자 대신 아이콘 버튼 2개로 줄여 제목과 겹치지 않습니다.
   summary 는 optional 이라 기존 호출부(page.tsx / categories/page.tsx)를
   수정하지 않아도 그대로 컴파일됩니다 — 넘기면 하단 줄이 나타납니다.
   ============================================================ */

import Link from 'next/link';
import { Category, catDisplayName } from '@/lib/categories';
import CatIcon from './cat-icon';
import { useT } from './i18n';

const T = {
  favoriteA11y: { ko: '즐겨찾기', en: 'Favourite' },
  subscribeA11y: { ko: '구독 알림', en: 'Subscription alerts' },
  noUpcoming: { ko: '예정된 모임 없음', en: 'No upcoming meetups' },
};

/** 구독 중이면 ★처럼 속을 채운다 (색은 카드 글자색을 따라간다) */
const BellIcon = ({ filled }: { filled: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth={1.9}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 3h15z" />
    <path d="M10 21h4" fill="none" />
  </svg>
);

/**
 * 홈 캐러셀과 카테고리 목록이 함께 쓰는 카드.
 * 즐겨찾기(★)는 홈 노출용, 구독은 알림용이라 서로 다른 토글이다.
 */
export default function CategoryCard({
  category,
  showToggles,
  isFavorite,
  isSubscribed,
  onFavorite,
  onSubscribe,
  dragHandle,
  dragging,
  nodeRef,
  style,
  summary,
}: {
  category: Category;
  showToggles: boolean;
  isFavorite: boolean;
  isSubscribed: boolean;
  onFavorite: () => void;
  onSubscribe: () => void;
  /** 순서 바꾸기 손잡이 — 홈의 즐겨찾기 카드에만 붙는다 */
  dragHandle?: React.ReactNode;
  dragging?: boolean;
  /** 아래 둘은 dnd-kit이 카드를 잡고 움직이기 위해 넘긴다 */
  nodeRef?: (node: HTMLElement | null) => void;
  style?: React.CSSProperties;
  /** 카드 하단 한 줄 — when은 모노(“토 15:00”), detail은 장소·인원 */
  summary?: { when?: string; detail?: string } | null;
}) {
  const t = useT();
  // 카드 전체가 링크라 토글 클릭이 이동으로 새지 않게 막는다
  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <Link
      href={category.kind === 'movie' ? '/movie' : `/c/${category.slug}`}
      ref={nodeRef}
      className={`car-card ${dragging ? 'dragging' : ''}`}
      style={{ background: category.color, color: category.fg, ...style }}
      data-slug={category.slug}
      draggable={false}
      // 끄는 중인 카드에서 손을 떼면 링크가 눌린 것으로 처리되므로 막는다
      onClick={dragging ? (e) => e.preventDefault() : undefined}
    >
      <div className="car-top">
        <span className="car-idx">
          {dragHandle}
          {category.en}
        </span>
        {showToggles && (
          <span className="car-actions">
            <button
              className={`car-icon ${isFavorite ? 'on' : ''}`}
              onClick={stop(onFavorite)}
              aria-pressed={isFavorite}
              aria-label={t(T.favoriteA11y)}
            >
              <span className="star" aria-hidden="true">
                {isFavorite ? '★' : '☆'}
              </span>
            </button>
            {category.kind === 'posts' && (
              <button
                className={`car-icon ${isSubscribed ? 'on' : ''}`}
                onClick={stop(onSubscribe)}
                aria-pressed={isSubscribed}
                aria-label={t(T.subscribeA11y)}
              >
                <BellIcon filled={isSubscribed} />
              </button>
            )}
          </span>
        )}
      </div>
      <div>
        <div className="car-name">
          {t(catDisplayName(category.slug))}
          <CatIcon slug={category.slug} />
        </div>
        <div className="car-desc">{t(category.description)}</div>
      </div>
      {summary && (
        <div className="car-foot">
          {summary.when && <span className="car-foot-when">{summary.when}</span>}
          {summary.when && summary.detail && <span className="car-foot-sep" aria-hidden="true" />}
          <span className="car-foot-detail">{summary.detail ?? t(T.noUpcoming)}</span>
          <span className="car-foot-go" aria-hidden="true">
            ›
          </span>
        </div>
      )}
    </Link>
  );
}
