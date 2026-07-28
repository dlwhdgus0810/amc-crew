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
  tickets: { ko: '건의함', en: 'Suggestions' },
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
const TicketIcon = () => (
  <svg {...icon} aria-hidden>
    <path d="M20 15a2 2 0 0 1-2 2H8l-4 3V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z" />
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
        <Link href="/notifications" className={pathname === '/notifications' ? 'active' : ''}>
          <BellIcon />
          <span>{t(T.notifications)}</span>
          {loggedIn && unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
        </Link>
        <Link href="/tickets" className={pathname.startsWith('/tickets') ? 'active' : ''}>
          <TicketIcon />
          <span>{t(T.tickets)}</span>
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
    links.push({ href: '/movie', label: t(T.showtimes) }, { href: '/movie/groups', label: t(T.groups) });
  }
  if (pathname.startsWith('/tickets')) links.push({ href: '/tickets', label: t(T.tickets) });
  if (isAdmin) links.push({ href: '/admin', label: t(T.admin) });
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
