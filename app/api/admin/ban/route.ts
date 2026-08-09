import { NextRequest, NextResponse } from 'next/server';
import { desc, isNotNull } from 'drizzle-orm';
import { E, errJson } from '@/lib/apierr';
import { adminIds, getSessionUser, isAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db/index';
import { users } from '@/lib/db/schema';
import { BAN_DURATIONS, notifyBan, setBan, toState, type BannedUser } from '@/lib/db/bans';
import { siteUrl } from '@/lib/site';
import { nameOf } from '@/lib/store';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

/** 정지 중인 회원 + 정지할 수 있는 회원 목록 (관리자 전용) */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);

  const locale = await getLocale();
  const db = await getDb();
  const rows = await db.select().from(users).orderBy(desc(users.bannedUntil), users.kakaoName);
  const admins = adminIds();
  const list = rows
    // 관리자는 정지 대상이 아니므로 목록에서 아예 뺀다
    .filter((r) => !admins.includes(r.id))
    .map((r) => {
      const state = toState(r.bannedUntil, r.banReason);
      const name = nameOf(r, r.kakaoName, locale);
      return { id: r.id, name, avatar: r.avatar, ...(state ?? {}) } as Partial<BannedUser> & { id: string; name: string };
    });

  return NextResponse.json({ members: list, durations: BAN_DURATIONS });
}

/** 정지 걸기·풀기. minutes가 0이면 해제. */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);

  const body = await req.json().catch(() => null);
  const userId = typeof body?.userId === 'string' ? body.userId : '';
  const minutes = Number(body?.minutes);
  const reason = typeof body?.reason === 'string' ? body.reason.slice(0, 200) : '';
  if (!userId || !Number.isFinite(minutes)) return await errJson(E.badRequest, 400);
  // 해제(0)이거나 정해 둔 기간 중 하나여야 한다 — 임의의 숫자를 받으면 실수로 100년이 들어간다
  if (minutes !== 0 && !BAN_DURATIONS.includes(minutes as (typeof BAN_DURATIONS)[number])) {
    return await errJson(E.banMinutes, 400);
  }

  try {
    const state = await setBan(userId, minutes, reason);
    // 본인에게 알린다 — 앱을 닫아 둔 사람은 이게 없으면 다음에 열어 보고서야 안다.
    // 알림이 실패해도 정지 자체는 성공 처리 (막는 일이 먼저다)
    try {
      await notifyBan(userId, minutes, reason, siteUrl(req.nextUrl.origin));
    } catch (e) {
      console.error('[ban] notify failed:', e);
    }
    return NextResponse.json({ ok: true, ban: state });
  } catch {
    // setBan은 관리자를 정지하려 할 때만 던진다
    return await errJson(E.banAdmin, 400);
  }
}
