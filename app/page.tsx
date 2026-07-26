'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { CATEGORIES } from '@/lib/categories';
import { useT } from './i18n';
import CategoryCard from './category-card';

const T = {
  loading: { ko: '불러오는 중…', en: 'Loading…' },
  statement1: { ko: '취미로 모이는 크루.', en: 'A crew that gathers around hobbies.' },
  statement2: { ko: '오늘 뭐 하고 놀지, 같이 정합니다.', en: 'Let’s decide together what to do today.' },
  profile: { ko: '프로필 →', en: 'Profile →' },
  kakaoLogin: { ko: '카카오 로그인', en: 'Log in with Kakao' },
  loginToSubscribe: { ko: '카카오 로그인 후 구독할 수 있어요.', en: 'Log in with Kakao to subscribe.' },
  loginToFavorite: { ko: '카카오 로그인 후 즐겨찾기할 수 있어요.', en: 'Log in with Kakao to add favourites.' },
  allCategories: { ko: '전체 카테고리 보기 →', en: 'See all categories →' },
  suggest: {
    ko: '하고 싶은 취미가 없나요? 카테고리 제안하기 →',
    en: 'Missing your hobby? Suggest a category →',
  },
  prev: { ko: '이전', en: 'Previous' },
  next: { ko: '다음', en: 'Next' },
};

interface SessionUser {
  id: string;
  name: string;
}

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

export default function HubPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [subs, setSubs] = useState<Set<string>>(new Set());
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get('login_error');
    if (err) {
      setMsg({ type: 'err', text: err });
      window.history.replaceState(null, '', '/');
    }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/subscriptions').then((r) => r.json()),
      fetch('/api/favorites').then((r) => r.json()),
    ])
      .then(([auth, sub, fav]) => {
        setUser(auth.user ?? null);
        setSubs(new Set(sub.subscriptions ?? []));
        setFavs(new Set(fav.favorites ?? []));
      })
      .finally(() => setLoading(false));
  }, []);

  async function toggleSub(category: string) {
    if (!user) {
      setMsg({ type: 'err', text: t(T.loginToSubscribe) });
      return;
    }
    const next = !subs.has(category);
    setSubs((prev) => {
      const s = new Set(prev);
      if (next) s.add(category);
      else s.delete(category);
      return s;
    });
    const res = await fetch('/api/subscriptions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, subscribed: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setSubs(new Set(data.subscriptions ?? []));
    }
  }

  /** 즐겨찾기는 홈에 먼저 띄우기 위한 것 — 알림과는 무관하다 */
  async function toggleFav(category: string) {
    if (!user) {
      setMsg({ type: 'err', text: t(T.loginToFavorite) });
      return;
    }
    const next = !favs.has(category);
    setFavs((prev) => {
      const s = new Set(prev);
      if (next) s.add(category);
      else s.delete(category);
      return s;
    });
    const res = await fetch('/api/favorites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, favorite: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setFavs(new Set(data.favorites ?? []));
    }
  }

  function scroll(dir: number) {
    carRef.current?.scrollBy({ left: dir * 580, behavior: 'smooth' });
  }

  if (loading) return <p className="subtitle">{t(T.loading)}</p>;

  // 즐겨찾기가 있으면 홈에는 그것만 — 나머지는 "전체 카테고리"에서 본다
  const shown = favs.size > 0 ? CATEGORIES.filter((c) => favs.has(c.slug)) : CATEGORIES;

  return (
    <>
      <div className="statement">
        {t(T.statement1)}
        <br />
        <span className="dim2">{t(T.statement2)}</span>
      </div>
      {/* 카테고리를 추가하거나 순서를 바꿔도 따라오도록 목록에서 만든다 */}
      <div className="statement-meta">{CATEGORIES.map((c) => c.en).join(' — ')}</div>

      <div className="home-login">
        {user ? (
          <>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{user.name}</span>
            <Link href="/profile" className="profile-link">
              {t(T.profile)}
            </Link>
          </>
        ) : (
          <a className="kakao-btn" href="/api/auth/login">
            <KakaoIcon />
            {t(T.kakaoLogin)}
          </a>
        )}
      </div>

      {msg && <div className={`msg ${msg.type}`}>{msg.text}</div>}

      <div className="car" ref={carRef}>
        {shown.map((c) => (
          <CategoryCard
            key={c.slug}
            category={c}
            label={`${String(CATEGORIES.indexOf(c) + 1).padStart(2, '0')} / ${c.en}`}
            showToggles={Boolean(user)}
            isFavorite={favs.has(c.slug)}
            isSubscribed={subs.has(c.slug)}
            onFavorite={() => toggleFav(c.slug)}
            onSubscribe={() => toggleSub(c.slug)}
          />
        ))}
      </div>
      <div className="car-arrows">
        <span className="car-links">
          <Link href="/categories" className="profile-link">
            {t(T.allCategories)}
          </Link>
          <Link href="/suggest" className="profile-link">
            {t(T.suggest)}
          </Link>
        </span>
        <button onClick={() => scroll(-1)} aria-label={t(T.prev)}>
          ←
        </button>
        <button onClick={() => scroll(1)} aria-label={t(T.next)}>
          →
        </button>
      </div>
    </>
  );
}
