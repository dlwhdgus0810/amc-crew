import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import { translateCached } from '@/lib/db/translations';
import { TRANSLATE_MAX, translateEnabled } from '@/lib/translate';

export const dynamic = 'force-dynamic';

/**
 * 「번역 보기」를 눌렀을 때.
 *
 * 어느 언어로 옮길지는 **몸통에서 받지 않는다.** 보는 사람의 언어(쿠키)로 정한다 —
 * 받으면 아무 언어나 넣어 남의 키로 번역기를 돌릴 수 있고, 캐시도 쓸데없이 불어난다.
 *
 * 회원만 부를 수 있다. 로그인 안 한 사람에게는 애초에 댓글도 명단도 안 보인다.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;

  if (!translateEnabled()) {
    return await errJson(E.translateOff, 503);
  }

  const body = await req.json().catch(() => null);
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text || text.length > TRANSLATE_MAX) {
    return await errJson(E.badRequest, 400);
  }

  const out = await translateCached(text, await getLocale());
  if (!out) {
    return await errJson(E.translateFailed, 502);
  }
  return NextResponse.json({ text: out });
}
