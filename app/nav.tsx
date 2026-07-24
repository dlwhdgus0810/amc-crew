'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => {
        setIsAdmin(Boolean(auth.isAdmin));
        setLoggedIn(Boolean(auth.user));
        if (auth.user && auth.needsOnboarding && pathname !== '/welcome') {
          router.replace('/welcome');
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

  const links = [{ href: '/', label: '홈' }];
  if (pathname.startsWith('/movie')) {
    links.push({ href: '/movie', label: '시간 고르기' }, { href: '/movie/groups', label: '그룹' });
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
          <Roll label={l.label} />
        </Link>
      ))}
      {loggedIn && (
        <Link href="/notifications" className={`bell ${pathname === '/notifications' ? 'active' : ''}`}>
          <Roll label="알림" />
          {unread > 0 && <span className="bell-badge">{unread > 9 ? '9+' : unread}</span>}
        </Link>
      )}
    </nav>
  );
}
