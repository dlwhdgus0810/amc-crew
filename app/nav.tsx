'use client';

/* ============================================================
   app/nav.tsx 를 이 파일로 교체하세요.
   2a 플로팅 아일랜드: 좌우 14px 떠 있는 캡슐 안에
   홈 · 둘러보기 · 알림 · 프로필 + ＋(모임 만들기).
   AMC의 회차/그룹과 관리자는 문맥 탭(ContextTabs)으로 내립니다.
   ============================================================ */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useT } from './i18n';

/** 프로필이 바뀌었음을 탭바에 알리는 신호 */
export const PROFILE_UPDATED = 'kk-profile-updated';

const T = {
  home: { ko: '홈', en: 'Home' },
  categories: { ko: '둘러보기', en: 'Browse' },
  calendar: { ko: '캘린더', en: 'Calendar' },
  // 탭바에서는 내렸고(프로필 안으로), 문맥 탭에서만 쓴다
  tickets: { ko: '건의함', en: 'Suggestions' },
  movienight: { ko: '무비나잇', en: 'Movie Night' },
  showtimes: { ko: '회차 고르기', en: 'Showtimes' },
  groups: { ko: '그룹', en: 'Groups' },
  profile: { ko: '프로필', en: 'Profile' },
  admin: { ko: '관리자', en: 'Admin' },
  notifications: { ko: '알림', en: 'Alerts' },
  create: { ko: '모임 만들기', en: 'New meetup' },
};

/* 20px 라인 아이콘 — 굵기 1.8로 통일 */
const icon = { className: 't-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const HomeIcon = () => (
  <svg {...icon} aria-hidden>
    <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
  </svg>
);
const BrowseIcon = () => (
  <svg {...icon} aria-hidden>
    <circle cx="12" cy="12" r="9" />
    <path d="m15 9-2.4 5.6L7 17l2.4-5.6z" />
  </svg>
);
const CalendarIcon = () => (
  <svg {...icon} aria-hidden>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);
const BellIcon = () => (
  <svg {...icon} aria-hidden>
    <path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 3h15z" />
    <path d="M10 21h4" />
  </svg>
);

/** 로그인 상태·안 읽은 알림 수를 한 번만 읽어 두 컴포넌트가 함께 쓴다 */
function useSession() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = () =>
      fetch('/api/auth/me')
        .then((r) => r.json())
        .then((auth) => {
          setIsAdmin(Boolean(auth.isAdmin));
          setLoggedIn(Boolean(auth.user));
          setName(auth.user?.name ?? '');
          setAvatar(auth.avatar ?? null);
          if (auth.user && auth.needsOnboarding && pathname !== '/welcome') {
            // 온보딩 후 원래 보던 페이지(공유 링크 등)로 복귀할 수 있게 경로를 넘긴다
            router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
          }
        })
        .catch(() => {});
    load();
    // 프로필에서 사진·닉네임을 바꾸면 화면을 옮기지 않아도 탭바가 따라오도록
    window.addEventListener(PROFILE_UPDATED, load);
    return () => window.removeEventListener(PROFILE_UPDATED, load);
  }, [pathname, router]);

  useEffect(() => {
    fetch('/api/notifications/count')
      .then((r) => r.json())
      .then((data) => setUnread(data.unreadCount ?? 0))
      .catch(() => {});
  }, [pathname]);

  /*
   * 홈 화면 아이콘의 숫자 뱃지.
   *
   * 앱이 닫혀 있는 동안에는 서비스 워커가 푸시를 받으며 올려 준다(public/sw.js).
   * 여기서는 앱을 열었을 때 실제 안 읽은 수로 다시 맞춘다 — 다른 기기에서 읽었거나
   * 알림 탭에 들어가 읽음 처리된 경우를 워커는 알 수 없다.
   */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('setAppBadge' in navigator)) return;
    const nav = navigator as Navigator & {
      setAppBadge?: (n?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    // 실패는 삼킨다 — 설치 전이거나 알림 권한이 없으면 거부되는데, 고칠 수 있는 문제가 아니다
    const done = unread > 0 ? nav.setAppBadge?.(unread) : nav.clearAppBadge?.();
    done?.catch(() => {});
  }, [unread, loggedIn]);

  return { isAdmin, loggedIn, name, avatar, unread, pathname };
}

/** 떠 있는 하단 탭바 — 좁은 폰에서도 줄바꿈되지 않고, 콘텐츠 위에 얹힌다 */
export default function NavLinks() {
  const { loggedIn, name, avatar, unread, pathname } = useSession();
  const t = useT();

  return (
    <nav className="tabbar">
      <span className="tabbar-links">
        <Link href="/" className={pathname === '/' ? 'active' : ''}>
          <HomeIcon />
          <span>{t(T.home)}</span>
        </Link>
        <Link href="/categories" className={pathname.startsWith('/categories') ? 'active' : ''}>
          <BrowseIcon />
          <span>{t(T.categories)}</span>
        </Link>
        <Link href="/calendar" className={pathname.startsWith('/calendar') ? 'active' : ''}>
          <CalendarIcon />
          <span>{t(T.calendar)}</span>
        </Link>
        <Link href="/notifications" className={pathname === '/notifications' ? 'active' : ''}>
          <BellIcon />
          <span>{t(T.notifications)}</span>
          {loggedIn && unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
        </Link>
        {loggedIn ? (
          <Link href="/profile" className={pathname === '/profile' ? 'active' : ''}>
            <span className="t-ava">
              {avatar ? <img src={avatar} alt="" /> : name.slice(0, 1) || '·'}
            </span>
            <span>{t(T.profile)}</span>
          </Link>
        ) : (
          <a href="/api/auth/login">
            <span className="t-ava">·</span>
            <span>{t(T.profile)}</span>
          </a>
        )}
      </span>
    </nav>
  );
}

/** 화면 안 문맥 탭 — AMC의 회차/그룹, 관리자 진입 */
export function ContextTabs() {
  const { isAdmin, pathname } = useSession();
  const t = useT();

  const links: { href: string; label: string }[] = [];
  if (pathname.startsWith('/movie')) {
    links.push(
      // AMC는 무비나잇 안의 도구라, 돌아갈 자리를 첫 칸에 둔다
      { href: '/c/movienight', label: t(T.movienight) },
      { href: '/movie', label: t(T.showtimes) },
      { href: '/movie/groups', label: t(T.groups) }
    );
  }
  if (pathname.startsWith('/tickets')) links.push({ href: '/tickets', label: t(T.tickets) });
  // 관리자 진입은 프로필 화면에만 둔다 — 모든 화면 위에 띄울 만한 버튼이 아니다
  if (isAdmin && pathname.startsWith('/admin')) links.push({ href: '/admin', label: t(T.admin) });
  if (links.length === 0) return null;

  return (
    <div className="segbar">
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
          {l.label}
        </Link>
      ))}
    </div>
  );
}
