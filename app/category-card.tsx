'use client';

/* ============================================================
   app/category-card.tsx 를 이 파일로 교체하세요. (시안 3a)
   컬러 블록 카드 + 하단에 "다음 일정 한 줄".
   ★/구독은 글자 대신 아이콘 버튼 2개로 줄여 제목과 겹치지 않습니다.
   summary 는 optional 이라 기존 호출부(page.tsx / categories/page.tsx)를
   수정하지 않아도 그대로 컴파일됩니다 — 넘기면 하단 줄이 나타납니다.
   ============================================================ */

import Link from 'next/link';
import { Category, catDisplayName, descriptionFor } from '@/lib/categories';
import { useCardTheme } from './card-theme-context';
import CatIcon from './cat-icon';
import { useT } from './i18n';

/*
 * <rain-canvas>는 커스텀 엘리먼트다 (public/rain-canvas.js) — TS에 이름만 알려 둔다.
 *
 * `declare global { namespace JSX }`가 아니라 'react' 모듈 안에 선언한다. React 19부터
 * JSX 네임스페이스가 전역이 아니라 React 밑으로 옮겨서, 전역에 적으면 여기 태그가
 * IntrinsicElements에 없다고 잡힌다.
 */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'rain-canvas': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        rate?: string;
      };
      /* public/snow-canvas.js — 속성으로 쌓이는 높이·속도를 바꿀 수 있다 (README 참고) */
      'snow-canvas': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        max?: string;
        inside?: string;
        floor?: string;
        ledge?: string;
        skirt?: string;
        rate?: string;
      };
    }
  }
}

const T = {
  favoriteA11y: { ko: '즐겨찾기', en: 'Favourite', es: 'Favorito' },
  subscribeA11y: { ko: '구독 알림', en: 'Subscription alerts', es: 'Avisos de suscripción' },
  noUpcoming: { ko: '예정된 모임 없음', en: 'No upcoming meetups', es: 'No hay quedadas próximas' },
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
  const theme = useCardTheme();
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
      style={{
        background: `var(--cat-${category.slug}, ${category.color})`,
        color: `var(--cat-${category.slug}-fg, ${category.fg})`,
        ...style,
      }}
      data-slug={category.slug}
      draggable={false}
      // 끄는 중인 카드에서 손을 떼면 링크가 눌린 것으로 처리되므로 막는다
      onClick={dragging ? (e) => e.preventDefault() : undefined}
    >
      {/*
        * 유성 — 밤하늘 카드에만. 그림일 뿐이라 손가락을 받지 않고(pointer-events:none),
        * 화면 낭독기에도 안 읽힌다. 움직임을 줄여 달라고 해 둔 기기에서는 아예 안 나온다.
        * 개수·길이·시작 시각은 CSS가 정한다 (app/overrides.css).
        */}
      {category.meteors && (
        <span className="meteors" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <b />
          <b />
          <b />
        </span>
      )}
      {/*
        * 시즌 테마의 카드 장식 — 벚꽃은 아래 가장자리의 꽃잎 물결, 장마는 카드 안에
        * 내리는 비와 고인 물, 그리고 밖에 맺히는 이슬.
        *
        * **왜 항상 그리고 CSS로 가리는가.** 이 컴포넌트는 클라이언트이고 테마를 모른다.
        * prop으로 내리려면 부르는 쪽(app/page.tsx·app/categories/page.tsx)까지 따라
        * 고쳐야 해서, layout.tsx가 <html data-season>에 한 글자만 두고 CSS가 갈라지게
        * 했다. 시즌 테마가 아니면 이 낱개들은 display:none이라 아무것도 그리지 않는다.
        *
        * **낱개가 무엇이 되는지는 CSS가 정한다** (app/overrides.css) — .meteors와 같은
        * 방식이다. 벚꽃에서는 i 열여섯 개가 가장자리 꽃잎이고, 장마에서는 앞의 여섯이
        * 빗줄기, 그다음 다섯이 이슬, em이 고인 물이다.
        */}
      {/*
        * 장마 — 카드 안의 물. 캔버스가 그린다 (public/rain-canvas.js).
        * 이것도 항상 그려 두고 CSS가 가린다 — 시즌이 아니면 display:none이라
        * 커스텀 엘리먼트가 연결되지 않고 루프도 안 돈다.
        *
        * 색은 안 넘긴다 — 캔버스가 상속된 color를 읽는다. 어두운 카드에서는 크림,
        * 밝은 카드에서는 짙은 청회색이 된다 (CSS의 currentColor와 같은 이야기다).
        */}
      <rain-canvas className="card-rain" rate="0.1" aria-hidden="true" />
      {/*
        * 겨울 — 카드 위에 쌓이는 눈. 캔버스가 그린다 (public/snow-canvas.js).
        * 비와 같은 방식이다: 항상 그려 두고 겨울이 아니면 CSS가 display:none으로 가린다.
        * 자리·크기(카드 위로 90px, 아래로 70px)는 app/season-winter.css가 잡는다.
        */}
      <snow-canvas aria-hidden="true" />

      <span className="card-season" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <em />
      </span>
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
        {/* 시즌 테마에서는 계절 문구로 바뀐다 (lib/categories.ts의 descriptionFor) */}
        <div className="car-desc">{t(descriptionFor(category, theme))}</div>
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
