'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '/', label: '시간 고르기' },
  { href: '/groups', label: '그룹 보기' },
];

export default function NavLinks() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((auth) => setIsAdmin(Boolean(auth.isAdmin)))
      .catch(() => {});
  }, []);

  const links = isAdmin ? [...LINKS, { href: '/admin', label: '관리자' }] : LINKS;

  return (
    <nav>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
