import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getCategoryRequest, reviewCategoryRequest } from '@/lib/db/category-requests';

export const dynamic = 'force-dynamic';

/** 제안 검토 (관리자 전용) — 승인/반려 + 선택적 답변 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  if (!isAdmin(user)) {
    return NextResponse.json({ error: '관리자만 검토할 수 있어요.' }, { status: 403 });
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: '제안을 찾을 수 없어요.' }, { status: 404 });
  }
  const request = await getCategoryRequest(id);
  if (!request) {
    return NextResponse.json({ error: '제안을 찾을 수 없어요.' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
    return NextResponse.json({ error: '상태 값이 올바르지 않습니다.' }, { status: 400 });
  }
  const adminNote = typeof body?.adminNote === 'string' ? body.adminNote.trim() : '';
  if (adminNote.length > 500) {
    return NextResponse.json({ error: '답변은 500자 이하로 입력해주세요.' }, { status: 400 });
  }

  await reviewCategoryRequest({
    id,
    status,
    ...(adminNote ? { adminNote } : {}),
    requesterId: request.userId,
    requestName: request.name,
    origin: req.nextUrl.origin,
  });
  return NextResponse.json({ ok: true });
}
