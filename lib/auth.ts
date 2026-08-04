import { cache } from 'react';
import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export interface SessionUser {
  id: string; // 카카오 회원번호
  name: string; // 카카오 닉네임
}

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일
export const STATE_COOKIE = 'kakao_oauth_state';
export const LOGIN_NEXT_COOKIE = 'login_next';
/** 테스트 계정으로 보는 동안 원래(관리자) 세션을 담아두는 곳 — 돌아갈 때 쓴다 */
export const IMPERSONATOR_COOKIE = 'impersonator';

/** 로그인 후 복귀 경로 검증: 사이트 내 경로만 허용 (open redirect 방지) */
export function safeNextPath(path: string | undefined | null): string {
  if (path && path.startsWith('/') && !path.startsWith('//')) return path;
  return '/';
}

function secret(): string {
  return process.env.AUTH_SECRET ?? 'dev-only-secret-change-me';
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

export function createSessionToken(user: SessionUser): string {
  const payload = Buffer.from(
    JSON.stringify({ ...user, exp: Date.now() + SESSION_MAX_AGE * 1000 })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined): SessionUser | null {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof data.id !== 'string' || typeof data.name !== 'string') return null;
    if (typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { id: data.id, name: data.name };
  } catch {
    return null;
  }
}

/**
 * 지금 요청을 보낸 사람. DB는 안 본다 — 토큰 서명만 확인한다.
 *
 * 라우트 하나가 이걸 여러 번 부르고(가드, 본문, 응답 만들기) 서버 렌더에서는 레이아웃과
 * 페이지가 각각 부른다. cache로 감싸 쿠키 읽기와 HMAC 검증을 한 번만 한다.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
});

/** ADMIN_KAKAO_ID(쉼표로 여러 명 가능)에 등록된 카카오 회원번호만 관리자로 인정 */
export function isAdmin(user: SessionUser | null): boolean {
  return user ? adminIds().includes(user.id) : false;
}

/** ADMIN_KAKAO_ID에 등록된 관리자 카카오 회원번호 목록 (알림 수신자 등) */
export function adminIds(): string[] {
  return (process.env.ADMIN_KAKAO_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
