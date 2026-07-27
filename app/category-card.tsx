'use client';

import Link from 'next/link';
import { Category } from '@/lib/categories';
import { useT } from './i18n';

// 라벨은 카드 좌측 상단의 car-idx처럼 언어와 무관한 모노 대문자 표기다
const T = {
  favorite: { ko: 'FAV', en: 'FAV' },
  subscribe: { ko: 'SUBSCRIBE', en: 'SUBSCRIBE' },
  subscribed: { ko: 'SUBSCRIBED', en: 'SUBSCRIBED' },
  favoriteA11y: { ko: '즐겨찾기', en: 'Favourite' },
  subscribeA11y: { ko: '구독', en: 'Subscribe' },
};

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
          <span className="car-toggles">
            <button
              className={`sub-toggle ${isFavorite ? 'on' : ''}`}
              onClick={stop(onFavorite)}
              aria-pressed={isFavorite}
              aria-label={t(T.favoriteA11y)}
            >
              <span className="star" aria-hidden="true">
                {isFavorite ? '★' : '☆'}
              </span>
              {t(T.favorite)}
            </button>
            {category.kind === 'posts' && (
              <>
                <span className="sep" aria-hidden="true" />
                <button
                  className={`sub-toggle ${isSubscribed ? 'on' : ''}`}
                  onClick={stop(onSubscribe)}
                  aria-pressed={isSubscribed}
                  aria-label={t(T.subscribeA11y)}
                >
                  {isSubscribed ? t(T.subscribed) : t(T.subscribe)}
                </button>
              </>
            )}
          </span>
        )}
      </div>
      <div>
        <div className="car-name">{t(category.name)}</div>
        <div className="car-desc">{t(category.description)}</div>
      </div>
    </Link>
  );
}
