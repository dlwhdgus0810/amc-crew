/**
 * 홈 화면의 알맹이 — **미리보기도 이것을 그린다** (app/preview/page.tsx).
 *
 * app/page.tsx에서 떼어 냈다. Next는 page 파일에 기본 내보내기 말고 다른 것을 두지
 * 못하게 하고, 페이지 컴포넌트는 정해진 모양(PageProps)만 받을 수 있어서 only 같은
 * 값을 붙일 수 없다. 알맹이를 여기 두면 홈은 그대로 두고 미리보기만 다른 값을 넘긴다.
 */

import { Suspense } from 'react';
import { getViewer } from '@/lib/session';
import { getLocale } from '@/lib/locale';
import { getFavorites, getSubscriptions } from '@/lib/db/posts';
import { nextMeetupByCategory } from '@/lib/db/next-meetups';
import { signupCounts } from '@/lib/db/signups';
import { hiddenSlugs } from '@/lib/db/hidden';
import { CATEGORIES, POST_CATEGORY_SLUGS } from '@/lib/categories';
import { cookies } from 'next/headers';
import { seasonStat, statementOfDay, type SeasonStat } from '@/lib/statements';
import { currentWeather } from '@/lib/weather';
import { springBloomDay } from '@/lib/spring';
import { CARD_THEME_COOKIE, PREVIEW_COOKIE, themeDeco, toCardTheme } from '@/lib/card-theme';
import { todayLocal } from '@/lib/dates';
import { pick, type Locale } from '@/lib/i18n';
import { getRegion } from '@/lib/region-server';
import { REGIONS, type Region } from '@/lib/region';
import HomeClient from './home-client';
import WhatsNewCard from './whats-new-card';
import { CategoryCardsSkeleton, LOADING } from './skeleton';

/**
 * 홈이 쓰는 것들을 서버에서 한 번에 읽는다.
 *
 * 예전에는 브라우저가 마운트한 뒤 /api/subscriptions·/api/favorites·/api/next-meetups를
 * 각각 받아 왔다. 그 왕복이 끝날 때까지 화면이 비어 있었다.
 * 지금은 페이지를 그리면서 같이 읽어 첫 프레임에 카드가 들어 있다.
 *
 * 셋은 서로를 안 기다리므로 묶는다.
 */
async function HomeData({ only }: { only?: string[] }) {
  const [{ user }, region] = await Promise.all([getViewer(), getRegion()]);
  const [subs, favs, summaries, signups, hidden] = await Promise.all([
    user ? getSubscriptions(user.id, region) : [],
    user ? getFavorites(user.id) : [],
    nextMeetupByCategory(region, POST_CATEGORY_SLUGS),
    // 모임이 아직 없어도 신청한 사람이 있으면 홈에 띄운다 (독서나눔처럼 사람부터 모으는 곳)
    signupCounts(region),
    // 관리자가 내려 둔 카테고리는 목록에서 뺀다 (카테고리 화면은 주소로 그대로 열린다)
    hiddenSlugs(region),
  ]);
  return (
    <HomeClient initial={{ subs, favs, summaries: { today: todayLocal(region), summaries, signups }, hidden }} only={only} />
  );
}

/** 홈 맨 위의 카테고리 띠 — 감춘 것은 빼고 그린다 */
async function CategoryStrip() {
  const hidden = await hiddenSlugs(await getRegion());
  return (
    <div className="statement-meta">
      {CATEGORIES.filter((c) => !hidden.includes(c.slug))
        .map((c) => c.en)
        .join(' — ')}
    </div>
  );
}

/**
 * 홈 화면의 알맹이 — **미리보기도 이것을 그린다** (app/preview/page.tsx).
 *
 * 페이지의 기본 내보내기와 나눠 둔 이유는 Next의 타입이다. 페이지 컴포넌트는 정해진
 * 모양(PageProps)만 받을 수 있어서 only 같은 것을 붙일 수 없다. 알맹이를 따로 두면
 * 홈은 그대로 두고 미리보기만 다른 값을 넘길 수 있다.
 *
 * only가 오면 그 카드만 그린다. 홈으로 열릴 때는 안 넘어오므로 지금까지와 똑같다.
 */
export async function HomeView({ only }: { only?: string[] } = {}) {
  /*
   * 그날의 문구는 읽어올 게 없다 — DB를 기다리는 자리 밖에 두어 먼저 칠해진다.
   * 안에 두면 카드가 올 때까지 화면 맨 위가 비어 있다.
   *
   * todayLocal()은 그 지역 시간대로 날짜를 내므로 어느 기기에서 열어도 같은 줄이 나온다.
   */
  const [locale, region] = await Promise.all([getLocale(), getRegion()]);
  /*
   * 시즌 테마면 첫 줄도 계절 목록에서 고른다 (lib/statements.ts).
   *
   * 미리보기 쿠키를 먼저 보는 것은 레이아웃과 같은 규칙이다 — 이 화면이 미리보기
   * 창 안에도 그대로 들어가므로(app/preview/page.tsx), 여기서 안 보면 카드 색은
   * 봄인데 첫 줄만 평소 문구가 나온다.
   */
  const jar = await cookies();
  const theme = toCardTheme(jar.get(PREVIEW_COOKIE)?.value ?? jar.get(CARD_THEME_COOKIE)?.value);
  const day = todayLocal(region);
  const today = statementOfDay(day, theme);
  const deco = themeDeco(theme);
  const leafPeak = REGIONS[region].leafPeak;
  return (
    <>
      <div className="statement">
        {pick(locale, today.top)}
        <br />
        <span className="dim2">{pick(locale, today.bottom)}</span>
      </div>
      {/*
        * 계절 상태줄 — 첫 줄 아래 한 줄. 봄은 개화, 여름은 강수, 가을은 단풍,
        * 겨울은 기온이다 (lib/statements.ts의 SEASON_STATS).
        *
        * **날씨를 기다리느라 홈이 늦게 뜨지 않게 한다.** 여름·겨울은 Open-Meteo를
        * 부르는데(lib/weather.ts), 그 사이 고정값으로 같은 줄을 그려 두고 값이 오면
        * 갈아 끼운다. 줄의 높이가 같아서 자리가 흔들리지 않는다. 30분에 한 번만
        * 받아 오므로 대개는 기다림 없이 바로 나온다.
        */}
      <Suspense fallback={<SeasonStatus stat={seasonStat(deco, day, { leafPeak })} locale={locale} />}>
        <LiveSeasonStatus deco={deco} day={day} locale={locale} region={region} />
      </Suspense>
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
        <HomeData only={only} />
      </Suspense>
    </>
  );
}

/**
 * 상태줄 한 줄.
 *
 * aria-hidden인 것은 장식이기 때문이다 — 실제 일정은 아래 카드에 다 있고, 이 줄은
 * 계절의 결을 한 줄로 얹은 것이다.
 */
function SeasonStatus({ stat, locale }: { stat: SeasonStat | null; locale: Locale }) {
  if (!stat) return null;
  return (
    <div className="season-status" aria-hidden>
      <b>
        {pick(locale, stat.label)}
        {stat.sub && <em> {pick(locale, stat.sub)}</em>}
      </b>
      <i style={{ '--fill': stat.fill } as React.CSSProperties} />
    </div>
  );
}

/**
 * 계절마다 필요한 것만 부른다.
 *
 *   여름·겨울  지금 날씨 (Open-Meteo)
 *   봄         올해 개화일 (USA-NPN)
 *   가을       아무것도 — 절정일이 날짜 하나라 셈만 하면 된다
 */
async function LiveSeasonStatus({
  deco,
  day,
  locale,
  region,
}: {
  deco: 'petal' | 'rain' | 'snow' | 'leaf' | 'gold' | null;
  day: string;
  locale: Locale;
  region: Region;
}) {
  // 날씨·개화·단풍 절정일이 전부 지역의 것이다 (lib/region.ts)
  const [weather, bloomDoy] = await Promise.all([
    deco === 'rain' || deco === 'snow' ? currentWeather(region) : null,
    deco === 'petal' ? springBloomDay(region) : null,
  ]);
  return (
    <SeasonStatus stat={seasonStat(deco, day, { weather, bloomDoy, leafPeak: REGIONS[region].leafPeak })} locale={locale} />
  );
}
