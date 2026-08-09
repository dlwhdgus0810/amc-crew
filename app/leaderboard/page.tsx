import { Suspense } from 'react';
import { getLocale } from '@/lib/locale';
import { pick } from '@/lib/i18n';
import { getViewer } from '@/lib/session';
import { hostRanking, joinRanking } from '@/lib/db/hosting';
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

  const [hosts, joiners] = await Promise.all([hostRanking(TOP), joinRanking(TOP)]);
  return <LeaderboardClient initial={{ hosts, joiners }} />;
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
