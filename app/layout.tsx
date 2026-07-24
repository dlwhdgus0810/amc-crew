import type { Metadata } from 'next';
import Link from 'next/link';
import NavLinks from './nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Odyssey Crew — 같이 놀 사람?',
  description: '영화·피클볼·볼링·축구 — 취미 모임 만들고 같이 놀 사람 모으기',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="logo">
              Odyssey&nbsp;Crew<sup>®</sup>
            </Link>
            <NavLinks />
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <span>© 2026 ODYSSEY CREW</span>
            <span>오디세이 크루 — 취미 모임</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
