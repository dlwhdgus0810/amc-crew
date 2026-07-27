import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getCategoryRequest, reviewCategoryRequest } from '@/lib/db/category-requests';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** 제안 검토 (관리자 전용) — 승인/반려 + 선택적 답변 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!isAdmin(user)) {
    return await errJson(E.adminOnlyReview, 403);
  }

  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return await errJson(E.requestNotFound, 404);
  }
  const request = await getCategoryRequest(id);
  if (!request) {
    return await errJson(E.requestNotFound, 404);
  }

  const body = await req.json().catch(() => null);
  const status = body?.status;
  if (status !== 'approved' && status !== 'rejected' && status !== 'pending') {
    return await errJson(E.badStatus, 400);
  }
  const adminNote = typeof body?.adminNote === 'string' ? body.adminNote.trim() : '';
  if (adminNote.length > 500) {
    return await errJson(E.adminNote, 400);
  }

  await reviewCategoryRequest({
    id,
    status,
    ...(adminNote ? { adminNote } : {}),
    requesterId: request.userId,
    requestName: request.name,
    origin: siteUrl(req.nextUrl.origin),
  });
  return NextResponse.json({ ok: true });
}
