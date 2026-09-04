import { Suspense } from 'react';
import { getViewer } from '@/lib/session';
import { getSubscriptions } from '@/lib/db/posts';
import { getNewsAlerts } from '@/lib/db/news';
import { hiddenSlugs } from '@/lib/db/hidden';
import { cookies } from 'next/headers';
import { earnedThemesFor, giftsFor, walletOf } from '@/lib/db/shop';
import { CARD_THEME_COOKIE, toCardTheme } from '@/lib/card-theme';
import { dbGetUser } from '@/lib/db/users';
import { getLocale } from '@/lib/locale';
import ProfileClient from './profile-client';

export const dynamic = 'force-dynamic';

/**
 * 프로필이 쓰는 것을 서버에서 읽는다.
 *
 * 사진·닉네임·계좌 같은 폼 값은 이미 레이아웃의 세션에서 채운다. 여기서 읽는 건
 * 그 밖의 넷 — 구독 목록, 새 소식 알림, 지난 비공개 모임 설정, 그리고 감춰 둔 카테고리.
 *
 * 감춘 것을 읽는 이유: 구독 칸에 그것들이 그대로 남아 있었다. 홈·둘러보기에서는
 * 빠지는데 여기서만 보이니, 목록에 없는 취미를 구독하고 있는 꼴이었다.
 */
async function ProfileData() {
  const { user, unread } = await getViewer();
  if (!user) {
    return (
      <ProfileClient
        initial={{ subs: [], newsAlerts: false, showPastPrivate: false, unread: 0, hidden: [], owned: [], earned: [], gifts: [], themeShort: 0, theme: 'default' }}
      />
    );
  }
  const locale = await getLocale();
  const [subs, newsAlerts, row, hidden, wallet, gifts, earned, jar] = await Promise.all([
    getSubscriptions(user.id),
    getNewsAlerts(user.id),
    dbGetUser(user.id),
    hiddenSlugs(),
    // 산 테마를 여기서 읽는다 — 고를 수 있는 것이 산 것뿐이라 목록이 곧 이 값이다
    walletOf(user.id),
    // 그중 선물로 받은 것은 누가 줬는지까지 (lib/db/shop.ts의 giftsFor)
    giftsFor(user.id, locale),
    /* 산 것이 아니라 자격으로 열리는 테마 — 지금은 세 순위표 1위의 금빛 하나다 */
    earnedThemesFor(user.id),
    cookies(),
  ]);
  return (
    // unread는 위 getViewer()가 이미 세어 둔 값이다 — 알림 줄 배지에만 쓴다
    <ProfileClient
      initial={{
        subs,
        newsAlerts,
        showPastPrivate: row?.showPastPrivate ?? false,
        unread,
        hidden,
        owned: wallet.owned,
        /* 산 것이 아니라 지금 자격으로 열려 있는 것 — 1위에서 내려오면 사라진다 */
        earned,
        gifts,
        /* 사진을 내려 달란트가 마이너스면 산 테마도 못 고른다 (lib/db/shop.ts의 themeAllowed) */
        themeShort: wallet.left < 0 ? -wallet.left : 0,
        theme: toCardTheme(jar.get(CARD_THEME_COOKIE)?.value),
      }}
    />
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={null}>
      <ProfileData />
    </Suspense>
  );
}
