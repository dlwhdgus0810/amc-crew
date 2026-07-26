'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, getCategory } from '@/lib/categories';
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
  dragHint: {
    ko: '⠿ 을 끌어서 즐겨찾기 순서를 바꿀 수 있어요.',
    en: 'Drag ⠿ to reorder your favourites.',
  },
  reorder: { ko: '순서 바꾸기', en: 'Reorder' },
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
  // 즐겨찾기는 사용자가 정한 순서가 있으므로 배열로 들고 있는다
  const [favList, setFavList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const carRef = useRef<HTMLDivElement>(null);
  const favRef = useRef<string[]>([]);
  const edgeRef = useRef(0);
  // 끄는 중인 카드는 ref로도 들고 있는다 — 포인터 이벤트가 리렌더보다 먼저 와도 최신 값이 필요하다
  const dragRef = useRef<string | null>(null);
  const stopDragRef = useRef<(() => void) | null>(null);
  const t = useT();
  const favs = useMemo(() => new Set(favList), [favList]);

  /** 드래그 중에는 리렌더보다 포인터 이벤트가 빨라서 최신 목록을 ref로도 같이 들고 있어야 한다 */
  function applyFavs(next: string[]) {
    favRef.current = next;
    setFavList(next);
  }

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
        applyFavs(fav.favorites ?? []);
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
    applyFavs(next ? [...favRef.current, category] : favRef.current.filter((c) => c !== category));
    const res = await fetch('/api/favorites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, favorite: next }),
    });
    if (res.ok) {
      const data = await res.json();
      applyFavs(data.favorites ?? []);
    }
  }

  /**
   * 손잡이를 끌어 즐겨찾기 순서를 바꾼다.
   * 마우스와 터치를 함께 다루려고 HTML5 드래그 대신 포인터 이벤트를 쓴다.
   */
  // 끄는 동안은 window에서 듣는다 — 카드 순서가 바뀌면 손잡이 DOM이 옮겨져
  // setPointerCapture가 풀리고 pointerup을 놓친다.
  // 등록도 pointerdown 안에서 바로 한다 (useEffect는 페인트 뒤라 빠른 드래그를 놓친다).
  function startDrag(slug: string) {
    return (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragRef.current = slug;
      setDragging(slug);

      const onMove = (e: PointerEvent) => {
        const slug = dragRef.current;
        if (!slug) return;
        // 캐러셀 가장자리에 오면 그쪽으로 스크롤한다
        const box = carRef.current?.getBoundingClientRect();
        edgeRef.current = !box ? 0 : e.clientX < box.left + 70 ? -1 : e.clientX > box.right - 70 ? 1 : 0;

        const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('.car-card')
          ?.dataset.slug;
        if (!over || over === slug) return;
        const prev = favRef.current;
        const from = prev.indexOf(slug);
        const to = prev.indexOf(over);
        if (from < 0 || to < 0) return;
        const next = prev.slice();
        next.splice(to, 0, next.splice(from, 1)[0]);
        applyFavs(next);
      };

      const onUp = async () => {
        if (!dragRef.current) return;
        dragRef.current = null;
        edgeRef.current = 0;
        setDragging(null);
        stopDragRef.current?.();
        const res = await fetch('/api/favorites', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order: favRef.current }),
        });
        if (res.ok) {
          const data = await res.json();
          applyFavs(data.favorites ?? []);
        }
      };

      const id = setInterval(() => {
        if (edgeRef.current) carRef.current?.scrollBy({ left: edgeRef.current * 18 });
      }, 16);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      stopDragRef.current = () => {
        clearInterval(id);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        stopDragRef.current = null;
      };
    };
  }

  useEffect(() => () => stopDragRef.current?.(), []);

  function scroll(dir: number) {
    carRef.current?.scrollBy({ left: dir * 580, behavior: 'smooth' });
  }

  if (loading) return <p className="subtitle">{t(T.loading)}</p>;

  // 즐겨찾기가 있으면 홈에는 그것만 — 사용자가 정한 순서대로. 나머지는 "전체 카테고리"에서 본다
  const shown = favList.length > 0 ? favList.map(getCategory).filter((c) => c !== undefined) : CATEGORIES;
  const canReorder = Boolean(user) && favList.length > 1;

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
            dragging={dragging === c.slug}
            dragHandle={
              canReorder ? (
                <button
                  className="car-drag"
                  aria-label={t(T.reorder)}
                  onPointerDown={startDrag(c.slug)}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  ⠿
                </button>
              ) : null
            }
          />
        ))}
      </div>
      {canReorder && <div className="drag-hint">{t(T.dragHint)}</div>}
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
