'use client';

/* ============================================================
   app/categories/page.tsx 를 이 파일로 교체하세요.
   달라진 점: useNextMeetups() 훅을 붙여 카드마다
   summary={...} 를 넘긴 것뿐입니다 (나머지는 원본과 동일).
   ============================================================ */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CATEGORIES } from '@/lib/categories';
import { useT } from '../i18n';
import { useIsPeek } from '../tab-peek-context';
import CategoryCard from '../category-card';
import useNextMeetups from '../use-next-meetups';

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  title: { ko: '카테고리', en: 'Categories' },
  leaderboard: { ko: '🏆 리더보드', en: '🏆 Leaderboard' },
  subtitle: {
    ko: '★ 즐겨찾기는 홈에 먼저 띄우는 용도이고, 구독은 새 모임과 내가 참가한 모임의 댓글 알림을 받는 용도예요.',
    en: '★ Favourites show up first on the home screen; subscriptions alert you to new meetups and to comments on ones you joined.',
  },
  loginPrompt: {
    ko: '카카오 로그인 후 즐겨찾기와 구독을 설정할 수 있어요.',
    en: 'Log in with Kakao to set favourites and subscriptions.',
  },
  kakaoLogin: { ko: '카카오 로그인', en: 'Log in with Kakao' },
};

function KakaoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3C6.48 3 2 6.54 2 10.9c0 2.8 1.86 5.26 4.66 6.66l-.95 3.52c-.08.31.27.56.54.38l4.19-2.78c.51.06 1.03.1 1.56.1 5.52 0 10-3.54 10-7.88C22 6.54 17.52 3 12 3z"
      />
    </svg>
  );
}

export default function CategoriesPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const t = useT();
  // 탭을 떠났다 돌아오면 다시 불러온다 — 화면은 살아 있으므로 깜빡이지 않는다
  const isPeek = useIsPeek();
  // 카드 하단 「다음 일정」 한 줄
  const summaryFor = useNextMeetups();

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
      fetch('/api/favorites').then((r) => r.json()),
    ])
      .then(([auth, sub, fav]) => {
        setLoggedIn(Boolean(auth.user));
        setSubs(new Set(sub.subscriptions ?? []));
        setFavs(new Set(fav.favorites ?? []));
      })
      .finally(() => setLoading(false));
  }, [isPeek]);

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
    }
  }

  if (loading) return <p className="subtitle">{t(T.loading)}</p>;

  return (
    <>
      <div className="page-head">
        <h1>{t(T.title)}</h1>
        <Link href="/leaderboard" className="leaderboard-link">
          {t(T.leaderboard)}
        </Link>
      </div>
      <p className="subtitle">{t(T.subtitle)}</p>

      {!loggedIn && (
        <div className="card">
          <div className="field-row" style={{ justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 14, fontWeight: 500 }}>{t(T.loginPrompt)}</span>
            <a className="kakao-btn" href="/api/auth/login?next=/categories">
              <KakaoIcon />
              {t(T.kakaoLogin)}
            </a>
          </div>
        </div>
      )}

      <div className="cat-grid">
        {CATEGORIES.map((c) => (
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
