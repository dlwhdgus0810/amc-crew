import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

export interface SessionUser {
  id: string; // 카카오 회원번호
  name: string; // 카카오 닉네임
}

export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일
export const STATE_COOKIE = 'kakao_oauth_state';

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
