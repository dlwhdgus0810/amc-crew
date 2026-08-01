import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { deactivateRule, getRule } from '@/lib/db/recurring';

export const dynamic = 'force-dynamic';

/**
 * 반복 중단 (규칙 작성자·관리자).
 * 규칙만 비활성화하고 이미 만들어진 회차는 남긴다 — 개별 취소는 모임 삭제로 한다.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return await errJson(E.ruleNotFound, 404);
  }
  const rule = await getRule(id);
  if (!rule) {
    return await errJson(E.ruleNotFound, 404);
  }
  if (rule.authorId !== user.id && !isAdmin(user)) {
    return await errJson(E.ruleOwnerOnly, 403);
  }
  await deactivateRule(id);
  return NextResponse.json({ ok: true });
}
