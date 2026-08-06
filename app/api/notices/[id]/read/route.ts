import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { markNoticeRead } from '@/lib/db/notices';

export const dynamic = 'force-dynamic';

/**
 * 「알겠어요」를 눌렀다.
 *
 * 정지 여부는 보지 않는다 — 이건 무언가를 만드는 요청이 아니라 「봤다」는 표시이고,
 * 막힌 사람에게는 애초에 공지가 뜨지 않는다. 여기서 막으면 실패만 조용히 쌓인다.
 *
 * 공지가 그 사이에 지워졌으면 외래키가 걸려 실패한다. 그건 알려줄 일이 아니라서
 * 조용히 넘긴다 — 부르는 쪽은 이 답을 기다리지 않는다.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const { id } = await params;
  await ensureUser(user);
  try {
    await markNoticeRead(id, user.id);
  } catch {
    return NextResponse.json({ ok: false });
  }
  return NextResponse.json({ ok: true });
}
