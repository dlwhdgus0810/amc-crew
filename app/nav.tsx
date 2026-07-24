'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function NavLinks() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => {
        setIsAdmin(Boolean(auth.isAdmin));
        setLoggedIn(Boolean(auth.user));
        // 온보딩 게이트: 생년월일·성별 미입력이면 어디서든 /welcome으로
        if (auth.user && auth.needsOnboarding && pathname !== '/welcome') {
          router.replace('/welcome');
        }
      })
      .catch(() => {});
  }, [pathname, router]);

  // 페이지 이동마다 안읽음 수 갱신
  useEffect(() => {
    fetch('/api/notifications/count')
      .then((r) => r.json())
      .then((data) => setUnread(data.unreadCount ?? 0))
      .catch(() => {});
  }, [pathname]);

  const links = [{ href: '/', label: '홈' }];
  if (pathname.startsWith('/movie')) {
    links.push({ href: '/movie', label: '시간 고르기' }, { href: '/movie/groups', label: '그룹 보기' });
  }
  if (loggedIn) {
    links.push({ href: '/profile', label: '프로필' });
  }
  if (isAdmin) {
    links.push({ href: '/admin', label: '관리자' });
  }

  return (
    <nav>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
          {l.label}
        </Link>
      ))}
      {loggedIn && (
        <Link href="/notifications" className={`bell ${pathname === '/notifications' ? 'active' : ''}`}>
          🔔
          {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
        </Link>
      )}
    </nav>
  );
}
