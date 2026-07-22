import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Odyssey Crew — 같이 볼 사람?',
  description: 'AMC Town Center 20에서 The Odyssey 같이 볼 시간 맞추기',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="logo">
              🎬 Odyssey&nbsp;Crew
            </Link>
            <nav>
              <Link href="/">시간 고르기</Link>
              <Link href="/groups">그룹 보기</Link>
            </nav>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            The Odyssey · AMC Town Center 20 (Leawood, KS) · 상영시간 25~30분 후 본편 시작
          </div>
        </footer>
      </body>
    </html>
  );
}
