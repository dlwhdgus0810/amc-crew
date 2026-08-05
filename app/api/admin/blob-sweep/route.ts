import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { allPhotoPaths } from '@/lib/db/photos';
import { allFlyerPaths } from '@/lib/db/posts';
import { deleteBlobs } from '@/lib/blob';

export const dynamic = 'force-dynamic';

/**
 * 주인 없는 파일 청소 (관리자 전용).
 *
 * 저장소에 있는데 DB 어디에서도 안 가리키는 파일을 지운다. 그런 파일이 생기는 길이 셋 있다.
 *  1) 개발 중 올린 것 — dev는 DB가 인메모리(PGlite)인데 저장소는 진짜다(lib/db/index.ts:33).
 *     그래서 개발 중 올린 것은 구조적으로 전부 주인이 없다.
 *  2) 올리고 나서 「이 모임에 붙여 주세요」를 보내기 전에 탭을 닫은 경우.
 *  3) 만들기 시트에서 포스터만 고르고 취소한 경우 — 모임이 안 생겼으니 붙을 데가 없다.
 *
 * 하루가 안 지난 것은 건드리지 않는다. 이 유예가 없으면 지금 막 올라와 아직 행이 안 생긴
 * 파일을 잡아먹는다 — 위 2)의 그 틈이 바로 그 순간이다.
 */
const GRACE_MS = 24 * 60 * 60 * 1000;

export async function POST() {
  const user = await getSessionUser();
  if (!user) return await errJson(E.loginRequired, 401);
  if (!isAdmin(user)) return await errJson(E.adminOnly, 403);

  const [stored, photos, flyers] = await Promise.all([list(), allPhotoPaths(), allFlyerPaths()]);
  const owned = new Set([...photos, ...flyers]);

  const cutoff = Date.now() - GRACE_MS;
  const orphans = stored.blobs.filter(
    (b: { pathname: string; uploadedAt: Date | string }) =>
      !owned.has(b.pathname) && new Date(b.uploadedAt).getTime() < cutoff
  );

  await deleteBlobs(orphans.map((b) => b.pathname));
  return NextResponse.json({
    ok: true,
    checked: stored.blobs.length,
    owned: owned.size,
    deleted: orphans.length,
    // 무엇을 지웠는지 남긴다 — 잘못 지웠을 때 어디를 봐야 하는지 알 수 있어야 한다
    paths: orphans.map((b) => b.pathname),
  });
}
