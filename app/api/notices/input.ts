import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import type { NoticeInput } from '@/lib/db/notices';

/**
 * 공지 본문 읽기 — 올릴 때와 고칠 때가 같은 값을 받으므로 한 곳에 둔다.
 *
 * 영어는 없어도 된다. 비어 있으면 null로 넣고 화면이 한국어를 그대로 쓴다 —
 * 여기서 한국어를 복사해 채워 넣지 않는다. 그러면 나중에 영어를 채웠는지
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
  const bodyKo = str(body?.bodyKo);
  const bodyEn = str(body?.bodyEn);

  if (!titleKo || titleKo.length > TITLE_MAX || titleEn.length > TITLE_MAX) {
    return { error: await errJson(E.noticeTitle, 400) };
  }
  if (bodyKo.length > BODY_MAX || bodyEn.length > BODY_MAX) {
    return { error: await errJson(E.noticeBody, 400) };
  }

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
      bodyKo: bodyKo || null,
      bodyEn: bodyEn || null,
    },
    targets,
  };
}
