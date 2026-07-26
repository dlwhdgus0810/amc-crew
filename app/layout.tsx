import type { Metadata } from 'next';
import Link from 'next/link';
import NavLinks from './nav';
import ServiceWorkerRegistrar from './sw-register';
import { I18nProvider } from './i18n';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import './globals.css';

const META = {
  title: { ko: 'Kansas Korean — 같이 놀 사람?', en: 'Kansas Korean — Who’s in?' },
  description: {
    ko: '영화·피클볼·볼링·축구·밥친구·카페 — 취미 모임 만들고 같이 놀 사람 모으기',
    en: 'Movies, pickleball, bowling, soccer, meals, cafés — create a meetup and find people to join',
  },
  footer: { ko: '캔자스 코리안 — 취미 모임', en: 'Kansas Korean — hobby meetups' },
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, META.title),
    description: pick(locale, META.description),
    // 홈 화면에 추가했을 때 주소창 없이 열리게 (구형 iOS는 매니페스트만으로는 부족하다)
    appleWebApp: {
      capable: true,
      title: 'Kansas Korean',
      statusBarStyle: 'default',
    },
    // Next는 표준 이름(mobile-web-app-capable)만 내보내는데, 예전 iOS는 애플 전용 이름을 본다
    other: { 'apple-mobile-web-app-capable': 'yes' },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>
          <ServiceWorkerRegistrar />
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
              <span>{pick(locale, META.footer)}</span>
            </div>
          </footer>
        </I18nProvider>
      </body>
    </html>
  );
}
