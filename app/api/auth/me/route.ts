import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * 내 정보.
 *
 * 내용은 lib/session.ts가 만든다 — 화면은 레이아웃이 서버에서 읽어 컨텍스트로 받으므로
 * 이 라우트를 부르지 않는다. 프로필을 저장한 뒤처럼 바뀐 값을 그 자리에서 다시
 * 확인해야 하는 곳만 남는다.
 */
export async function GET() {
  return NextResponse.json(await getViewer());
}
