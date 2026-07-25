import type { Metadata } from 'next';
import Link from 'next/link';
import NavLinks from './nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Kansas Korean — 같이 놀 사람?',
  description: '영화·피클볼·볼링·축구 — 취미 모임 만들고 같이 놀 사람 모으기',
  // 홈 화면에 추가했을 때 주소창 없이 열리게 (구형 iOS는 매니페스트만으로는 부족하다)
  appleWebApp: {
    capable: true,
    title: 'Kansas Korean',
    statusBarStyle: 'default',
  },
  // Next는 표준 이름(mobile-web-app-capable)만 내보내는데, 예전 iOS는 애플 전용 이름을 본다
  other: { 'apple-mobile-web-app-capable': 'yes' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <div className="container header-inner">
            <Link href="/" className="logo">
              Kansas&nbsp;Korean<sup>®</sup>
            </Link>
            <NavLinks />
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <span>© 2026 KANSAS KOREAN</span>
            <span>캔자스 코리안 — 취미 모임</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
