import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { NOTICE_TAG } from '@/lib/cache-tags';
import { deleteNotice, editNotice, setNoticeActive } from '@/lib/db/notices';
import { readNoticeInput } from '../input';

export const dynamic = 'force-dynamic';

/**
 * 공지 고치기 · 올리고 내리기 (관리자).
 *
 * 내용이나 받는 사람을 고치면 updatedAt이 바뀌어 이미 닫은 사람에게도 다시 뜬다.
 * 올리고 내리는 것만으로는 다시 뜨지 않는다 — 잘못 내렸다가 되돌린 것까지 「새 공지」로
 * 치면 같은 말을 두 번 읽힌다.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }
  const { id } = await params;

  /*
   * 몸통을 두 번 읽을 수 없어서(스트림은 한 번뿐이다) 먼저 복제해 두고 갈래를 정한다.
   * active만 온 요청과 내용을 고치는 요청이 같은 라우트를 쓴다.
   */
  const peek = await req.clone().json().catch(() => null);

  if (typeof peek?.active === 'boolean' && peek?.titleKo === undefined) {
    const notice = await setNoticeActive(id, peek.active);
    if (!notice) return await errJson(E.noticeNotFound, 404);
    revalidateTag(NOTICE_TAG);
    return NextResponse.json({ ok: true, notice });
  }

  if (typeof peek?.titleKo === 'string') {
    const parsed = await readNoticeInput(req);
    if ('error' in parsed) return parsed.error;
    const notice = await editNotice(id, { ...parsed.input, targets: parsed.targets });
    if (!notice) return await errJson(E.noticeNotFound, 404);
    revalidateTag(NOTICE_TAG);
    return NextResponse.json({ ok: true, notice });
  }

  return await errJson(E.badRequest, 400);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }
  const { id } = await params;
  if (!(await deleteNotice(id))) {
    return await errJson(E.noticeNotFound, 404);
  }
  revalidateTag(NOTICE_TAG);
  return NextResponse.json({ ok: true });
}
