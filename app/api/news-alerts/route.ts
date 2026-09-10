import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getNewsAlerts, sendNews, setNewsAlerts } from '@/lib/db/news';
import { newestEntry } from '@/lib/changelog';

export const dynamic = 'force-dynamic';

/** 내가 새 소식 알림을 켰는지 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ newsAlerts: false });
  return NextResponse.json({ newsAlerts: await getNewsAlerts(user.id) });
}

/** 켜기/끄기 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const body = await req.json().catch(() => null);
  if (typeof body?.on !== 'boolean') {
    return await errJson(E.badRequest, 400);
  }
  await ensureUser(user);
  await setNewsAlerts(user.id, body.on);
  return NextResponse.json({ ok: true, newsAlerts: body.on });
}

/**
 * 가장 최근 소식을 켜 둔 사람들에게 발송 (관리자 전용).
 * 배포만으로는 아무것도 나가지 않는다 — 보낼 때를 관리자가 고른다.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  if (!isAdmin(user)) {
    return await errJson(E.adminOnly, 403);
  }
  // 고정된 항목이 아니라 이번에 새로 올라온 소식을 보낸다
  const latest = newestEntry();
  if (!latest) {
    return await errJson(E.badRequest, 400);
  }
  // 주소는 받는 사람의 동네 도메인으로 sendNews가 만든다 — 여기서는 경로와 요청 주소만
  const result = await sendNews(latest.title, '/whats-new', latest.at, req.nextUrl.origin, latest.regions);
  return NextResponse.json({ ok: true, ...result });
}
