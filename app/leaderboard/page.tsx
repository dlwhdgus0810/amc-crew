import { Suspense } from 'react';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { getViewer } from '@/lib/session';
import {
  categoryRanking,
  contribNames,
  contribRanking,
  hostRanking,
  joinRanking,
  rankNames,
} from '@/lib/db/hosting';
import { hiddenSlugs } from '@/lib/db/hidden';
import { getRegion } from '@/lib/region-server';
import LeaderboardClient from './leaderboard-client';
import { Bar, Block, LOADING_LEADERBOARD, Skeleton } from '../skeleton';

export const dynamic = 'force-dynamic';

/** 화면에는 10등까지만 — 더 길어지면 순위표라기보다 회원 명단이 된다 */
const TOP = 10;

/**
 * 순위표를 서버에서 읽어 첫 프레임에 담는다.
 *
 * 두 순위는 이미 요청 사이에도 담아 둔 것이라(lib/db/hosting.ts), 대개 여기서 DB를
 * 새로 치지도 않는다. 로그인한 사람만 본다 — 이름과 "누가 모임을 열었는지"가 통째로
 * 담긴 목록이라, 모임 카드에서 주최자를 가려 놓고 여기서 내보내면 가린 의미가 없다.
 */
async function LeaderboardData() {
  const { user } = await getViewer();
  if (!user) return <LeaderboardClient initial={null} />;

  /*
   * 이름은 담아 둔 것을 꺼낸 **뒤에** 고른다 — 순위 집계는 누가 보든 같지만
   * 이름은 보는 사람의 언어에 따라 다르다 (lib/db/hosting.ts의 RankSeed 참고).
   */
  // 순위표는 지역별이다 — 이 도메인의 동네 사람들끼리 (lib/db/hosting.ts)
  const region = await getRegion();
  const [hosts, joiners, cats, contrib, hidden, locale] = await Promise.all([
    hostRanking(TOP, region),
    joinRanking(TOP, region),
    categoryRanking(region),
    contribRanking(TOP, region),
    hiddenSlugs(region),
    getLocale(),
  ]);
  /*
   * 감춘 카테고리는 여기서도 뺀다. 관리자가 목록에서 내린 것이 순위표에만 남아 있으면
   * 내린 뜻이 없다 — 프로필의 구독 목록에서 뺀 것과 같은 기준이다.
   * 자르는 것은 뺀 뒤에 한다. 그래야 열 자리가 비지 않는다.
   */
  const categories = cats.filter((c) => !hidden.includes(c.slug)).slice(0, TOP);
  return (
    <LeaderboardClient
      initial={{
        hosts: rankNames(hosts, locale),
        joiners: rankNames(joiners, locale),
        categories,
        contrib: contribNames(contrib, locale),
      }}
    />
  );
}

export default async function LeaderboardPage() {
  return (
    <Suspense fallback={<LeaderboardSkeleton label={pick(await getLocale(), LOADING_LEADERBOARD)} />}>
      <LeaderboardData />
    </Suspense>
  );
}

/** 제목 · 설명 두 줄 · 탭 · 순위 다섯 줄 */
function LeaderboardSkeleton({ label }: { label: string }) {
  return (
    <Skeleton label={label}>
      <Bar w={110} h={24} />
      <Bar w="88%" h={13} mt={10} />
      <Bar w={240} h={12} mt={6} />
      <Bar w={200} h={38} mt={18} />
      <Block h={64}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Bar key={i} w="100%" h={22} mt={i === 0 ? 0 : 12} />
        ))}
      </Block>
    </Skeleton>
  );
}
