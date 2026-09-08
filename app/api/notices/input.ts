import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import type { NoticeInput } from '@/lib/db/notices';
import { isRegion } from '@/lib/region';
import { regionOfRequest } from '@/lib/region-server';

/**
 * 공지 본문 읽기 — 올릴 때와 고칠 때가 같은 값을 받으므로 한 곳에 둔다.
 *
 * 한국어 말고는 없어도 된다. 비어 있으면 null로 넣고 화면이 적혀 있는 다른 언어를 쓴다 —
 * 여기서 한국어를 복사해 채워 넣지 않는다. 그러면 나중에 그 언어를 채웠는지
 * 아닌지를 알 수 없게 된다.
 */

export const TITLE_MAX = 60;
export const BODY_MAX = 1000;
/** 받는 사람 상한 — 회원 수를 넘는 값이 들어오면 잘못 만든 요청이다 */
const TARGETS_MAX = 200;

type Parsed = { input: NoticeInput; targets: string[] } | { error: NextResponse };

export async function readNoticeInput(req: NextRequest): Promise<Parsed> {
  const body = await req.json().catch(() => null);
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

  const titleKo = str(body?.titleKo);
  const titleEn = str(body?.titleEn);
  const titleEs = str(body?.titleEs);
  const bodyKo = str(body?.bodyKo);
  const bodyEn = str(body?.bodyEn);
  const bodyEs = str(body?.bodyEs);

  if (!titleKo || [titleKo, titleEn, titleEs].some((v) => v.length > TITLE_MAX)) {
    return { error: await errJson(E.noticeTitle, 400) };
  }
  if ([bodyKo, bodyEn, bodyEs].some((v) => v.length > BODY_MAX)) {
    return { error: await errJson(E.noticeBody, 400) };
  }

  /*
   * 「보러 가기」 경로 — 앱 안만 받는다.
   *
   * `//evil.com`은 브라우저가 프로토콜 상대 주소로 읽어 밖으로 나간다. 그래서
   * 「/로 시작」만으로는 부족하고 `//`를 따로 거른다 — lib/auth.ts의 safeNextPath와 같다.
   * 여기서 거르지 않으면 공지 하나로 회원 전체를 임의의 사이트에 보낼 수 있다.
   */
  const linkPath = str(body?.linkPath);
  if (linkPath && (!linkPath.startsWith('/') || linkPath.startsWith('//'))) {
    return { error: await errJson(E.noticeLink, 400) };
  }

  /*
   * 어느 지역에 띄울지. 안 보내면 올린 호스트의 지역, 'all'이면 양쪽(null).
   * 아는 값 밖이면 잘못 만든 요청이다.
   */
  const askedRegion = body?.region;
  let region: NoticeInput['region'];
  if (askedRegion === undefined || askedRegion === null) region = regionOfRequest(req);
  else if (askedRegion === 'all') region = null;
  else if (isRegion(askedRegion)) region = askedRegion;
  else return { error: await errJson(E.badRequest, 400) };

  const raw = Array.isArray(body?.targets) ? body.targets : [];
  if (raw.length > TARGETS_MAX || raw.some((v: unknown) => typeof v !== 'string' || !v)) {
    return { error: await errJson(E.badRequest, 400) };
  }
  // 같은 사람이 두 번 들어와도 결과는 같아야 한다
  const targets = [...new Set(raw as string[])];

  return {
    input: {
      titleKo,
      titleEn: titleEn || null,
      titleEs: titleEs || null,
      bodyKo: bodyKo || null,
      bodyEn: bodyEn || null,
      bodyEs: bodyEs || null,
      linkPath: linkPath || null,
      region,
    },
    targets,
  };
}
