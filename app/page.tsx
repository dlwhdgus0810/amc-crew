import { Suspense } from 'react';
import { getViewer } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { getFavorites, getSubscriptions } from '@/lib/db/posts';
import { nextMeetupByCategory } from '@/lib/db/next-meetups';
import { signupCounts } from '@/lib/db/signups';
import { hiddenSlugs } from '@/lib/db/hidden';
import { CATEGORIES, POST_CATEGORY_SLUGS } from '@/lib/categories';
import { cookies } from 'next/headers';
import { statementOfDay } from '@/lib/statements';
import { CARD_THEME_COOKIE, PREVIEW_COOKIE, toCardTheme } from '@/lib/card-theme';
import { todayLocal } from '@/lib/dates';
import { pick } from '@/lib/i18n';
import HomeClient from './home-client';
import WhatsNewCard from './whats-new-card';
import { CategoryCardsSkeleton, LOADING } from './skeleton';

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
  const [subs, favs, summaries, signups, hidden] = await Promise.all([
    user ? getSubscriptions(user.id) : [],
    user ? getFavorites(user.id) : [],
    nextMeetupByCategory(POST_CATEGORY_SLUGS),
    // 모임이 아직 없어도 신청한 사람이 있으면 홈에 띄운다 (독서나눔처럼 사람부터 모으는 곳)
    signupCounts(),
    // 관리자가 내려 둔 카테고리는 목록에서 뺀다 (카테고리 화면은 주소로 그대로 열린다)
    hiddenSlugs(),
  ]);
  return <HomeClient initial={{ subs, favs, summaries: { today: todayLocal(), summaries, signups } , hidden }} />;
}

/** 홈 맨 위의 카테고리 띠 — 감춘 것은 빼고 그린다 */
async function CategoryStrip() {
  const hidden = await hiddenSlugs();
  return (
    <div className="statement-meta">
      {CATEGORIES.filter((c) => !hidden.includes(c.slug))
        .map((c) => c.en)
        .join(' — ')}
    </div>
  );
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
  /*
   * 시즌 테마면 첫 줄도 계절 목록에서 고른다 (lib/statements.ts).
   *
   * 미리보기 쿠키를 먼저 보는 것은 레이아웃과 같은 규칙이다 — 이 화면이 미리보기
   * 창 안에도 그대로 들어가므로(app/preview/page.tsx), 여기서 안 보면 카드 색은
   * 봄인데 첫 줄만 평소 문구가 나온다.
   */
  const jar = await cookies();
  const today = statementOfDay(
    todayLocal(),
    toCardTheme(jar.get(PREVIEW_COOKIE)?.value ?? jar.get(CARD_THEME_COOKIE)?.value)
  );
  return (
    <>
      <div className="statement">
        {pick(locale, today.top)}
        <br />
        <span className="dim2">{pick(locale, today.bottom)}</span>
      </div>
      {/*
        * 카테고리를 추가하거나 순서를 바꿔도 따라오도록 목록에서 만든다.
        * 관리자가 내려 둔 것은 여기서도 뺀다 — 카드에는 없는데 이 줄에만 남으면
        * 「있는데 왜 안 보이지」가 된다.
        */}
      {/* 기다리는 동안 전부 늘어놓지 않는다 — 감춘 것이 잠깐 보였다 사라지면 그게 더 이상하다.
          자리(줄 높이)만 잡아 두고 값이 오면 채운다 */}
      <Suspense fallback={<div className="statement-meta">&nbsp;</div>}>
        <CategoryStrip />
      </Suspense>

      <WhatsNewCard />

      <Suspense fallback={<CategoryCardsSkeleton n={3} label={pick(locale, LOADING)} />}>
        <HomeData />
      </Suspense>
    </>
  );
}
