import { Suspense } from 'react';
import { getViewer } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { getFavorites, getSubscriptions } from '@/lib/db/posts';
import { nextMeetupByCategory } from '@/lib/db/next-meetups';
import { CATEGORIES, POST_CATEGORY_SLUGS } from '@/lib/categories';
import { statementOfDay } from '@/lib/statements';
import { todayLocal } from '@/lib/dates';
import { pick } from '@/lib/i18n';
import HomeClient from './home-client';
import WhatsNewCard from './whats-new-card';
import { CategoryCardsSkeleton } from './skeleton';

export const dynamic = 'force-dynamic';

/**
 * 홈이 쓰는 것들을 서버에서 한 번에 읽는다.
 *
 * 예전에는 브라우저가 마운트한 뒤 /api/subscriptions·/api/favorites·/api/next-meetups를
 * 각각 받아 왔다. 그 왕복이 끝날 때까지 화면이 비어 있었다.
 * 지금은 페이지를 그리면서 같이 읽어 첫 프레임에 카드가 들어 있다.
 *
 * 셋은 서로를 안 기다리므로 묶는다.
 */
async function HomeData() {
  const { user } = await getViewer();
  const [subs, favs, summaries] = await Promise.all([
    user ? getSubscriptions(user.id) : [],
    user ? getFavorites(user.id) : [],
    nextMeetupByCategory(POST_CATEGORY_SLUGS),
  ]);
  return <HomeClient initial={{ subs, favs, summaries: { today: todayLocal(), summaries } }} />;
}

export default async function HubPage() {
  /*
   * 그날의 문구는 읽어올 게 없다 — DB를 기다리는 자리 밖에 두어 먼저 칠해진다.
   * 안에 두면 카드가 올 때까지 화면 맨 위가 비어 있다.
   *
   * todayLocal()은 앱 시간대(America/Chicago)로 날짜를 내므로 어느 기기에서 열어도
   * 같은 줄이 나온다.
   */
  const locale = await getLocale();
  const today = statementOfDay(todayLocal());
  return (
    <>
      <div className="statement">
        {pick(locale, today.top)}
        <br />
        <span className="dim2">{pick(locale, today.bottom)}</span>
      </div>
      {/* 카테고리를 추가하거나 순서를 바꿔도 따라오도록 목록에서 만든다 */}
      <div className="statement-meta">{CATEGORIES.map((c) => c.en).join(' — ')}</div>

      <WhatsNewCard />

      <Suspense fallback={<CategoryCardsSkeleton n={3} label="불러오는 중" />}>
        <HomeData />
      </Suspense>
    </>
  );
}
