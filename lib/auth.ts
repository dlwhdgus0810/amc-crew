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
/** 이번 로그인이 "카톡 알림 재동의" 목적이었는지 표시 (콜백의 결과 안내·확인 메모용) */
export const LOGIN_PURPOSE_COOKIE = 'login_purpose';
export const TALK_MESSAGE_PURPOSE = 'talk_message';

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

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

/** ADMIN_KAKAO_ID(쉼표로 여러 명 가능)에 등록된 카카오 회원번호만 관리자로 인정 */
export function isAdmin(user: SessionUser | null): boolean {
  if (!user) return false;
  const ids = (process.env.ADMIN_KAKAO_ID ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(user.id);
}
