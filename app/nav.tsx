'use client';

/* ============================================================
   app/nav.tsx 를 이 파일로 교체하세요.
   1e 적용본: 헤더의 줄바꿈되는 링크 목록 → 하단 탭바(홈·둘러보기·건의함·알림)
   + 프로필 아바타. AMC의 회차/그룹과 관리자는 문맥 탭(ContextTabs)으로 내립니다.
   ============================================================ */

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useT } from './i18n';

const T = {
  home: { ko: '홈', en: 'Home' },
  categories: { ko: '둘러보기', en: 'Browse' },
  tickets: { ko: '건의함', en: 'Suggestions' },
  showtimes: { ko: '회차 고르기', en: 'Showtimes' },
  groups: { ko: '그룹', en: 'Groups' },
  profile: { ko: '프로필', en: 'Profile' },
  admin: { ko: '관리자', en: 'Admin' },
  notifications: { ko: '알림', en: 'Alerts' },
};

/** 로그인 상태·안 읽은 알림 수를 한 번만 읽어 두 컴포넌트가 함께 쓴다 */
function useSession() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [name, setName] = useState('');
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => {
        setIsAdmin(Boolean(auth.isAdmin));
        setLoggedIn(Boolean(auth.user));
        setName(auth.user?.name ?? '');
        if (auth.user && auth.needsOnboarding && pathname !== '/welcome') {
          // 온보딩 후 원래 보던 페이지(공유 링크 등)로 복귀할 수 있게 경로를 넘긴다
          router.replace(`/welcome?next=${encodeURIComponent(pathname)}`);
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  useEffect(() => {
    fetch('/api/notifications/count')
      .then((r) => r.json())
      .then((data) => setUnread(data.unreadCount ?? 0))
      .catch(() => {});
  }, [pathname]);

  return { isAdmin, loggedIn, name, unread, pathname };
}

/** 하단 탭바 — 화면 어디서나 같은 자리에 있고, 좁은 폰에서도 줄바꿈되지 않는다 */
export default function NavLinks() {
  const { loggedIn, name, unread, pathname } = useSession();
  const t = useT();

  const tabs = [
    { href: '/', label: t(T.home) },
    { href: '/categories', label: t(T.categories) },
    { href: '/tickets', label: t(T.tickets) },
  ];

  return (
    <nav className="tabbar">
      <span className="tabbar-links">
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} className={pathname === tab.href ? 'active' : ''}>
            {tab.label}
          </Link>
        ))}
        {loggedIn && (
          <Link href="/notifications" className={pathname === '/notifications' ? 'active' : ''}>
            {t(T.notifications)}
            {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
          </Link>
        )}
      </span>
      {loggedIn ? (
        <Link
          href="/profile"
          className={`avatar ${pathname === '/profile' ? 'on' : ''}`}
          aria-label={t(T.profile)}
        >
          {name.slice(0, 1) || '·'}
        </Link>
      ) : (
        <a className="avatar" href="/api/auth/login" aria-label={t(T.profile)}>
          ·
        </a>
      )}
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
