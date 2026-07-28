import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import {
  createSessionToken,
  IMPERSONATOR_COOKIE,
  isAdmin,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  getSessionUser,
  verifySessionToken,
} from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { findTestUser } from '@/lib/test-users';

export const dynamic = 'force-dynamic';

const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: SESSION_MAX_AGE,
  path: '/',
};

/** 테스트 계정으로 전환 (관리자 전용) */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  // 이미 테스트 계정으로 보는 중이면 원래 세션은 쿠키에 들어 있다
  const saved = req.cookies.get(IMPERSONATOR_COOKIE)?.value;
  const realUser = verifySessionToken(saved) ?? user;
  if (!isAdmin(realUser)) {
    return await errJson(E.adminOnly, 403);
  }

  const body = await req.json().catch(() => null);
  const target = typeof body?.id === 'string' ? findTestUser(body.id) : undefined;
  if (!target) {
    return await errJson(E.badRequest, 400);
  }

  await ensureUser(target);
  const res = NextResponse.json({ ok: true, viewingAs: target.name });
  res.cookies.set(SESSION_COOKIE, createSessionToken(target), cookieOpts);
  // 원래 세션은 처음 전환할 때 한 번만 저장한다 (테스트 계정끼리 옮겨다녀도 유지)
  res.cookies.set(IMPERSONATOR_COOKIE, saved ?? createSessionToken(realUser), cookieOpts);
  return res;
}

/** 관리자로 돌아가기 */
export async function DELETE(req: NextRequest) {
  const saved = req.cookies.get(IMPERSONATOR_COOKIE)?.value;
  const realUser = verifySessionToken(saved);
  if (!realUser) {
    return await errJson(E.badRequest, 400);
  }
  const res = NextResponse.json({ ok: true, back: realUser.name });
  res.cookies.set(SESSION_COOKIE, createSessionToken(realUser), cookieOpts);
  res.cookies.delete(IMPERSONATOR_COOKIE);
  return res;
}
