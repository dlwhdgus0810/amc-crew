'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

const LINKS = [
  { href: '/', label: '시간 고르기' },
  { href: '/groups', label: '그룹 보기' },
  { href: '/admin', label: '관리자' },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <nav>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={pathname === l.href ? 'active' : ''}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
