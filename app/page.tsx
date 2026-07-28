'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CATEGORIES, getCategory } from '@/lib/categories';
import { useT } from './i18n';
import CategoryCard from './category-card';
import SortableCategoryCard from './sortable-card';

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
    ko: '⠿ 을 끌어서 즐겨찾기 순서를 바꿀 수 있어요. 키보드로는 ⠿에서 스페이스를 누른 뒤 방향키로 옮기세요.',
    en: 'Drag ⠿ to reorder your favourites, or focus ⠿ and press Space, then use the arrow keys.',
  },
  reorder: { ko: '순서 바꾸기', en: 'Reorder' },
  suggest: {
    ko: '하고 싶은 취미가 없나요? 카테고리 제안하기 →',
    en: 'Missing your hobby? Suggest a category →',
  },
  prev: { ko: '이전', en: 'Previous' },
  next: { ko: '다음', en: 'Next' },
};

/**
 * 홈에서 보던 위치 — 카테고리를 갔다 와도 그 자리로 돌아온다.
 * sessionStorage가 아니라 localStorage인 이유: 홈 화면에 설치한 PWA는 앱을 다시 열 때마다
 * 세션이 새로 시작돼(iOS는 백그라운드에서 앱을 자주 정리한다) 세션 저장소가 비어 있다.
 */
const SCROLL_KEY = 'kk-home-scroll';
/** 이만큼 지난 위치는 무시한다 */
const SCROLL_TTL = 30 * 60 * 1000;

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
  const carRef = useRef<HTMLDivElement>(null);
  // 끄는 동안에는 캐러셀의 scroll-snap을 꺼야 카드가 손을 따라온다
  const [reordering, setReordering] = useState(false);
  const t = useT();
  const favs = useMemo(() => new Set(favList), [favList]);

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
        setFavList(fav.favorites ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  /**
   * 카테고리를 보고 nav로 돌아왔을 때 보던 자리를 그대로 둔다.
   * 캐러셀의 가로 위치와 세로 스크롤을 기억한다.
   * 카드가 그려진 뒤에 복원해야 하므로 loading이 끝나고 나서 건다.
   */
  useEffect(() => {
    if (loading) return;
    const car = carRef.current;

    let target: { x: number; y: number } | null = null;
    const saved = localStorage.getItem(SCROLL_KEY);
    if (saved) {
      try {
        const { x, y, at } = JSON.parse(saved) as { x?: number; y?: number; at?: number };
        // 오래된 위치는 버린다 — 며칠 뒤에 열었는데 중간부터 뜨면 오히려 이상하다
        if (!at || Date.now() - at > SCROLL_TTL) localStorage.removeItem(SCROLL_KEY);
        else target = { x: x ?? 0, y: y ?? 0 };
      } catch {
        localStorage.removeItem(SCROLL_KEY); // 형태가 깨졌으면 버린다
      }
    }

    const apply = () => {
      if (!target) return;
      if (car && target.x) car.scrollLeft = target.x;
      if (target.y) window.scrollTo(0, target.y);
    };
    apply();
    // Next는 새 화면을 그린 뒤 맨 위로 올리므로 다음 프레임에 한 번 더 맞춘다
    const raf = requestAnimationFrame(apply);

    /*
     * 기록은 사람이 실제로 화면을 만진 뒤부터 한다.
     * 착지 직후에도 스크롤 이벤트가 오는데(Next의 맨 위로 올리기, 앱 복귀 시 재배치),
     * 그때 저장해버리면 방금 복원한 위치가 0으로 덮여 다음번엔 맨 위에서 시작한다.
     */
    let armed = false;
    const arm = () => {
      armed = true;
    };
    const inputs = ['pointerdown', 'wheel', 'touchstart', 'keydown'] as const;
    inputs.forEach((type) => window.addEventListener(type, arm, { passive: true }));

    // 떠날 때 읽으면 Next가 맨 위로 올린 뒤일 수 있어, 움직일 때마다 적어둔다
    const save = () => {
      if (!armed) return;
      localStorage.setItem(
        SCROLL_KEY,
        JSON.stringify({ x: car?.scrollLeft ?? 0, y: window.scrollY, at: Date.now() })
      );
    };
    car?.addEventListener('scroll', save, { passive: true });
    window.addEventListener('scroll', save, { passive: true });
    // 손을 뗀 뒤 미끄러지다 멈춘 자리까지 잡는다 (iOS는 미끄러지는 동안 scroll을 늦게 준다)
    car?.addEventListener('scrollend', save);
    window.addEventListener('scrollend', save);
    // 카드를 눌러 떠나는 순간의 위치 — 미끄러지는 중에 눌러도 그 자리가 남는다
    document.addEventListener('click', save, true);
    // PWA는 예고 없이 종료될 수 있어 화면을 벗어나는 순간에도 한 번 남긴다
    window.addEventListener('pagehide', save);
    return () => {
      cancelAnimationFrame(raf);
      inputs.forEach((type) => window.removeEventListener(type, arm));
      car?.removeEventListener('scroll', save);
      window.removeEventListener('scroll', save);
      car?.removeEventListener('scrollend', save);
      window.removeEventListener('scrollend', save);
      document.removeEventListener('click', save, true);
      window.removeEventListener('pagehide', save);
    };
  }, [loading]);

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
    setFavList((prev) => (next ? [...prev, category] : prev.filter((c) => c !== category)));
    const res = await fetch('/api/favorites', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, favorite: next }),
    });
    if (res.ok) {
      const data = await res.json();
      setFavList(data.favorites ?? []);
    }
  }

  /**
   * 즐겨찾기 순서 바꾸기 — 손잡이(⠿)를 끌거나, 손잡이에 포커스를 두고
   * 스페이스로 집어 방향키로 옮긴다 (키보드 조작은 dnd-kit이 제공).
   */
  const sensors = useSensors(
    // 4px 이상 움직여야 드래그로 본다 — 손잡이를 그냥 눌렀을 때 오작동하지 않게
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /**
   * 드래그가 끝나면 브라우저가 pointerup 자리에 click을 만들어내는데,
   * 카드가 통째로 링크라 그대로 두면 카테고리로 이동해버린다. 직후 클릭 한 번만 삼킨다.
   * (키보드 드래그에는 click이 없으므로 타이머로 반드시 풀어준다)
   */
  const swallowClick = useRef(false);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!swallowClick.current) return;
      swallowClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  function armClickSuppression(activatorEvent: Event) {
    if (!(activatorEvent instanceof MouseEvent || activatorEvent instanceof PointerEvent)) return;
    swallowClick.current = true;
    setTimeout(() => {
      swallowClick.current = false;
    }, 300);
  }

  async function onDragEnd(e: DragEndEvent) {
    setReordering(false);
    armClickSuppression(e.activatorEvent);
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const from = favList.indexOf(String(active.id));
    const to = favList.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    // 응답을 기다리지 않고 먼저 그린다 — 저장에 실패하면 서버 순서로 되돌아온다
    const next = arrayMove(favList, from, to);
    setFavList(next);
    const res = await fetch('/api/favorites', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: next }),
    });
    if (res.ok) setFavList((await res.json()).favorites ?? next);
  }

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

      <div className={`car ${reordering ? 'reordering' : ''}`} ref={carRef}>
        {canReorder ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={() => setReordering(true)}
            onDragCancel={() => setReordering(false)}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={favList} strategy={horizontalListSortingStrategy}>
              {shown.map((c) => (
                <SortableCategoryCard
                  key={c.slug}
                  category={c}
                  reorderLabel={t(T.reorder)}
                  showToggles={Boolean(user)}
                  isFavorite={favs.has(c.slug)}
                  isSubscribed={subs.has(c.slug)}
                  onFavorite={() => toggleFav(c.slug)}
                  onSubscribe={() => toggleSub(c.slug)}
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          shown.map((c) => (
            <CategoryCard
              key={c.slug}
              category={c}
              showToggles={Boolean(user)}
              isFavorite={favs.has(c.slug)}
              isSubscribed={subs.has(c.slug)}
              onFavorite={() => toggleFav(c.slug)}
              onSubscribe={() => toggleSub(c.slug)}
            />
          ))
        )}
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
