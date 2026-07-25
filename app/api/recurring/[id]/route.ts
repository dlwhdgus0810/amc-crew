import { NextRequest, NextResponse } from 'next/server';
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
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: '반복 설정을 찾을 수 없어요.' }, { status: 404 });
  }
  const rule = await getRule(id);
  if (!rule) {
    return NextResponse.json({ error: '반복 설정을 찾을 수 없어요.' }, { status: 404 });
  }
  if (rule.authorId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: '만든 사람만 반복을 중단할 수 있어요.' }, { status: 403 });
  }
  await deactivateRule(id);
  return NextResponse.json({ ok: true });
}
