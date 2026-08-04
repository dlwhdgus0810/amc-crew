import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { banStateOf } from '@/lib/db/bans';

export const dynamic = 'force-dynamic';

/**
 * 정지 상태만.
 *
 * 화면 가리개(app/ban-screen.tsx)가 1분마다 부른다 — 열어 둔 화면도 정지가 걸리거나
 * 풀린 걸 따라와야 해서, 이것만은 컨텍스트에 담아 둘 수 없다.
 *
 * /api/auth/me를 부르면 매분 아바타(data URL)까지 딸려 온다. 여기서는 두 칸만 읽는다.
 * (실제 차단은 lib/guard.ts가 변경 라우트마다 하고, 이 가리개는 알려주는 역할이다)
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ban: null });
  return NextResponse.json({ ban: await banStateOf(user.id) });
}
