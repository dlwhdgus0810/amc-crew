import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { NOTICE_TAG } from '@/lib/cache-tags';
import { activeNotices, createNotice, listNotices, noticeFor } from '@/lib/db/notices';
import { readNoticeInput } from './input';
import { regionOfRequest } from '@/lib/region-server';

export const dynamic = 'force-dynamic';

/**
 * 지금 이 사람에게 띄울 공지 하나 (회원). ?all=1이면 관리자에게 전체 목록.
 *
 * 앱을 열 때마다 한 번씩 불린다 — 켜져 있는 목록은 담아 둔 것을 쓰고(lib/db/notices.ts),
 * 그중 누구에게 보일지만 여기서 고른다.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    // 비로그인에게는 조용히 빈 답 — 공지는 회원끼리 하는 말이다
    return NextResponse.json({ notice: null });
  }
  if (req.nextUrl.searchParams.get('all') === '1') {
    if (!isAdmin(user)) {
      return await errJson(E.adminOnly, 403);
    }
    return NextResponse.json({ notices: await listNotices() });
  }
  // 이 도메인의 지역에 켜진 것(양쪽용 포함) 중에서 고른다
  return NextResponse.json({ notice: await noticeFor(await activeNotices(regionOfRequest(req)), user.id) });
}

/** 새 공지 올리기 (관리자) */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }
  const banned = await banGuard(user);
  if (banned) return banned;

  const parsed = await readNoticeInput(req);
  if ('error' in parsed) return parsed.error;

  const notice = await createNotice({ ...parsed.input, targets: parsed.targets });
  revalidateTag(NOTICE_TAG);
  return NextResponse.json({ ok: true, notice });
}
