import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { dbGetUser, ensureUser } from '@/lib/db/users';
import { revokeTalkMessageConsent, verifyTalkMessageConsent } from '@/lib/kakao';

export const dynamic = 'force-dynamic';

/**
 * 카톡 알림 동의 상태 조회.
 * ?verify=1 이면 카카오에 실제 동의 상태를 물어보고 DB를 정정한다.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  await ensureUser(user);

  if (req.nextUrl.searchParams.get('verify') !== '1') {
    const row = await dbGetUser(user.id);
    const flag = row?.kakaoTalkMessage;
    return NextResponse.json({ status: flag == null ? 'unknown' : flag ? 'on' : 'off' });
  }

  const { status, reason } = await verifyTalkMessageConsent(user.id);
  if (reason === 'kakao') {
    return await errJson(E.kakaoConsentCheck, 502);
  }
  // reason === 'token'은 에러가 아니라 "확인 불가" 상태 (재로그인하면 복구된다)
  return NextResponse.json({ status, verified: true, ...(reason ? { reason } : {}) });
}

/** 카톡 알림 끄기 — 카카오에서 talk_message 동의를 실제로 철회한다. */
export async function DELETE() {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);

  await ensureUser(user);
  const { ok, reason } = await revokeTalkMessageConsent(user.id);
  if (!ok) {
    return reason === 'token' ? await errJson(E.kakaoRelogin, 409) : await errJson(E.kakaoRevoke, 502);
  }
  return NextResponse.json({ ok: true, status: 'off' });
}
