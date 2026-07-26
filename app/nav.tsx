'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useT } from './i18n';

const T = {
  home: { ko: '홈', en: 'Home' },
  categories: { ko: '카테고리', en: 'Categories' },
  showtimes: { ko: '시간 고르기', en: 'Showtimes' },
  groups: { ko: '그룹', en: 'Groups' },
  profile: { ko: '프로필', en: 'Profile' },
  admin: { ko: '관리자', en: 'Admin' },
  notifications: { ko: '알림', en: 'Alerts' },
};

function Roll({ label }: { label: string }) {
  return (
    <span className="roll">
      <span>
        <span>{label}</span>
        <span>{label}</span>
      </span>
    </span>
  );
}

export default function NavLinks() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [unread, setUnread] = useState(0);
  const t = useT();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => {
        setIsAdmin(Boolean(auth.isAdmin));
        setLoggedIn(Boolean(auth.user));
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

  const links = [
    { href: '/', label: t(T.home) },
    { href: '/categories', label: t(T.categories) },
  ];
  if (pathname.startsWith('/movie')) {
    links.push({ href: '/movie', label: t(T.showtimes) }, { href: '/movie/groups', label: t(T.groups) });
  }
  if (loggedIn) {
    links.push({ href: '/profile', label: t(T.profile) });
  }
  if (isAdmin) {
    links.push({ href: '/admin', label: t(T.admin) });
  }

  return (
    <nav>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
          <Roll label={l.label} />
        </Link>
      ))}
      {loggedIn && (
        <Link href="/notifications" className={`bell ${pathname === '/notifications' ? 'active' : ''}`}>
          <Roll label={t(T.notifications)} />
          {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
        </Link>
      )}
    </nav>
  );
}
