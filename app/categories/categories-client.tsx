'use client';

/* ============================================================
   app/categories/page.tsx 를 이 파일로 교체하세요.
   달라진 점: useNextMeetups() 훅을 붙여 카드마다
   summary={...} 를 넘긴 것뿐입니다 (나머지는 원본과 동일).
   ============================================================ */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CATEGORIES, CAT_LAYOUT_COOKIE, CAT_LAYOUT_MAX_AGE, type CatLayout } from '@/lib/categories';
import { useT } from '../i18n';
import LoginButtons, { useLoginMsg } from '../login-buttons';
import CategoryCard from '../category-card';
import useNextMeetups, { type NextMeetupsSeed } from '../use-next-meetups';
import { useRefreshSession, useViewer } from '../session';

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…', es: 'Cargando…' },
  title: { ko: '카테고리', en: 'Categories', es: 'Categorías' },
  leaderboard: { ko: '리더보드', en: 'Leaderboard', es: 'Clasificación' },
  layoutA11y: { ko: '카드 배열', en: 'Card layout', es: 'Diseño de tarjetas' },
  layoutRows: { ko: '한 줄로 보기', en: 'One per row', es: 'Una por fila' },
  layoutTile: { ko: '바둑판으로 보기', en: 'Grid of two', es: 'Cuadrícula de dos' },
  subtitle: {
    ko: '★ 즐겨찾기는 홈에 먼저 띄우는 용도이고, 구독은 새 모임과 내가 참가한 모임의 댓글 알림을 받는 용도예요.',
    en: '★ Favourites show up first on the home screen; subscriptions alert you to new meetups and to comments on ones you joined.',
    es: '★ Los favoritos salen primero en el inicio; las suscripciones te avisan de quedadas nuevas y de comentarios en las tuyas.',
  },
  loginPrompt: {
    ko: '카카오 로그인 후 즐겨찾기와 구독을 설정할 수 있어요.',
    en: 'Log in with Kakao to set favourites and subscriptions.',
    es: 'Entra con Kakao para elegir favoritos y suscripciones.',
  },
  /* 로그인 문이 둘인 도메인(펜)용 — 어느 문인지 안 적는다 */
  loginPromptAny: {
    ko: '로그인 후 즐겨찾기와 구독을 설정할 수 있어요.',
    en: 'Log in to set favourites and subscriptions.',
    es: 'Inicia sesión para elegir favoritos y suscripciones.',
  },
};

/*
 * 배열 선택 — 좁은 화면(폰·PWA)에서만 쓴다. 700px 이상은 이미 2열, 1024px 이상은 3열이라
 * 고를 것이 없어서 cat-tile.css가 토글 자체를 숨긴다.
 *
 * **여기서 고른 것이 홈에도 걸린다.** 두 화면이 같은 카드를 그리므로 한쪽만 한 줄로
 * 남을 이유가 없다. 스위치는 이 화면에만 둔다 — 홈에도 달면 같은 스위치가 둘이 된다.
 *
 * 그래서 값이 쿠키다 (lib/categories.ts). localStorage면 서버가 모르니 홈도 늘 한 줄로
 * 그렸다가 마운트한 뒤에 바뀌는데, 홈은 앱을 열면 처음 보는 화면이라 그 다시 배치가
 * 매번 보인다. 쿠키는 서버가 첫 렌더에 읽어 html에 붙인다 (app/layout.tsx).
 *
 * 값을 바꿀 때 router.refresh()를 안 부른다 — html의 표시를 직접 갈아 끼우면 CSS가
 * 그 자리에서 따라오고, 서버를 다시 부르면 카드가 한 번 껌뻑인다.
 */
const LAYOUT_KEY = 'kk-cat-layout';

/* 아이콘은 카테고리 아이콘(app/cat-icon.tsx)·탭바와 같은 규격 — 24 격자, 굵기 1.8, 둥근 끝 */
const iconBase = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** 리더보드 — 이모지(🏆) 대신 선 아이콘. 기기마다 그림이 달라지지 않는다 */
const TrophyIcon = () => (
  <svg {...iconBase} width="15" height="15">
    <path d="M8 4.6h8v4.1a4 4 0 0 1-8 0z" />
    <path d="M8 5.8H6.2a2.3 2.3 0 0 0 2.3 3.4M16 5.8h1.8a2.3 2.3 0 0 1-2.3 3.4" />
    <path d="M12 12.8v3.3" />
    <path d="M9.4 19.4c.3-2 1.2-3.3 2.6-3.3s2.3 1.3 2.6 3.3z" />
    <path d="M8.4 19.4h7.2" />
  </svg>
);
const RowsIcon = () => (
  <svg {...iconBase} width="15" height="15">
    <path d="M4 6.5h16M4 12h16M4 17.5h16" />
  </svg>
);
const TileIcon = () => (
  <svg {...iconBase} width="15" height="15">
    <rect x="4" y="4" width="7" height="7" rx="1.6" />
    <rect x="13" y="4" width="7" height="7" rx="1.6" />
    <rect x="4" y="13" width="7" height="7" rx="1.6" />
    <rect x="13" y="13" width="7" height="7" rx="1.6" />
  </svg>
);


/** 서버가 페이지를 그리면서 미리 읽어 둔 것 (page.tsx) */
export interface CategoriesInitial {
  subs: string[];
  favs: string[];
  summaries: NextMeetupsSeed;
  /** 관리자가 목록에서 내려 둔 카테고리 */
  hidden: string[];
  /* 지난번에 고른 배열 — 서버가 쿠키에서 읽어 온다. 토글의 눌린 표시가 첫 렌더부터 맞아야 한다 */
  layout: CatLayout;
}

export default function CategoriesPage({ initial }: { initial: CategoriesInitial }) {
  const [subs, setSubs] = useState<Set<string>>(() => new Set(initial.subs));
  const [favs, setFavs] = useState<Set<string>>(() => new Set(initial.favs));
  const loginMsg = useLoginMsg();
  const t = useT();
  // 카드 하단 「다음 일정」 한 줄 — 서버가 읽어 둔 것을 그대로 쓴다
  const { summaryFor } = useNextMeetups(initial.summaries);
  /* 관리자가 내려 둔 카테고리는 목록에서 뺀다 — 주소로는 그대로 열린다 */
  const shown = CATEGORIES.filter((c) => !initial.hidden.includes(c.slug));

  const [layout, setLayoutState] = useState<CatLayout>(initial.layout);
  const loggedIn = Boolean(useViewer().user);
  const refresh = useRefreshSession();

  /*
   * 쿠키로 옮기기 전에 고른 사람들 — localStorage에 남아 있던 값을 한 번 쿠키로 옮긴다.
   * 이게 없으면 바둑판으로 보던 사람이 이번 배포에서 말없이 한 줄로 돌아간다.
   * 옮기고 나면 그 자리를 지운다 — 두 곳에 남으면 다음에 어느 쪽이 맞는지 알 수 없다.
   */
  useEffect(() => {
    const saved = localStorage.getItem(LAYOUT_KEY);
    if (!saved) return;
    localStorage.removeItem(LAYOUT_KEY);
    // 쿠키를 이미 고른 뒤라면 그쪽이 최신이다
    if (document.cookie.includes(`${CAT_LAYOUT_COOKIE}=`)) return;
    if (saved === 'tile' || saved === 'rows') chooseLayout(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseLayout(next: CatLayout) {
    setLayoutState(next);
    document.cookie = `${CAT_LAYOUT_COOKIE}=${next}; path=/; max-age=${CAT_LAYOUT_MAX_AGE}; samesite=lax`;
    // CSS가 읽는 것은 이 표시다 — 쿠키만 쓰면 다음에 서버가 그릴 때까지 안 바뀐다
    if (next === 'tile') document.documentElement.dataset.catLayout = 'tile';
    else delete document.documentElement.dataset.catLayout;
  }

  // 서버가 다시 그려 새 prop이 오면 상태로 옮긴다 (useState의 첫 값은 처음 한 번만 쓰인다)
  useEffect(() => {
    setSubs(new Set(initial.subs));
    setFavs(new Set(initial.favs));
  }, [initial]);

  async function toggle(kind: 'favorites' | 'subscriptions', category: string) {
    const isFav = kind === 'favorites';
    const current = isFav ? favs : subs;
    const setter = isFav ? setFavs : setSubs;
    const next = !current.has(category);
    setter((prev) => {
      const s = new Set(prev);
      if (next) s.add(category);
      else s.delete(category);
      return s;
    });
    const res = await fetch(`/api/${kind}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isFav ? { category, favorite: next } : { category, subscribed: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setter(new Set((isFav ? data.favorites : data.subscriptions) ?? []));
      // 서버가 들고 있는 값이라, 다시 그려 두지 않으면 탭을 옮겼다 오면 옛 값이 온다
      refresh();
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>{t(T.title)}</h1>
        <div className="cat-head-right">
          <Link href="/leaderboard" className="leaderboard-link">
            <TrophyIcon />
            {t(T.leaderboard)}
          </Link>
          {/* 글자가 없는 버튼이라 이름은 aria-label로, 고른 상태는 aria-pressed로 알린다 */}
          <div className="cat-layout-toggle" role="group" aria-label={t(T.layoutA11y)}>
            <button
              type="button"
              className={layout === 'rows' ? 'on' : ''}
              aria-pressed={layout === 'rows'}
              aria-label={t(T.layoutRows)}
              title={t(T.layoutRows)}
              onClick={() => chooseLayout('rows')}
            >
              <RowsIcon />
            </button>
            <button
              type="button"
              className={layout === 'tile' ? 'on' : ''}
              aria-pressed={layout === 'tile'}
              aria-label={t(T.layoutTile)}
              title={t(T.layoutTile)}
              onClick={() => chooseLayout('tile')}
            >
              <TileIcon />
            </button>
          </div>
        </div>
      </div>
      <p className="subtitle">{t(T.subtitle)}</p>

      {!loggedIn && (
        <div className="card">
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 500 }}>
              {t(loginMsg(T.loginPrompt, T.loginPromptAny))}
            </span>
            <LoginButtons next="/categories" />
          </div>
        </div>
      )}

      <div className="cat-grid">
        {shown.map((c) => (
          <CategoryCard
            key={c.slug}
            category={c}
            showToggles={loggedIn}
            isFavorite={favs.has(c.slug)}
            isSubscribed={subs.has(c.slug)}
            onFavorite={() => toggle('favorites', c.slug)}
            onSubscribe={() => toggle('subscriptions', c.slug)}
            summary={summaryFor(c.slug, c.kind)}
          />
        ))}
      </div>
    </>
  );
}
