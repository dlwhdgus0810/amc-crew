import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { getProfiles, resolveDisplayName } from '@/lib/store';
import { ensureUser } from '@/lib/db/users';
import { createPost, listPosts } from '@/lib/db/posts';
import { createRecurringRule } from '@/lib/db/recurring';
import { getCategory, POST_CATEGORY_SLUGS } from '@/lib/categories';
import { sanitizeTitleMeta } from '@/lib/tmdb';
import { isPastSlot } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? '';
  const past = req.nextUrl.searchParams.get('past') === '1';
  if (!POST_CATEGORY_SLUGS.includes(category)) {
    return await errJson(E.badCategory, 400);
  }
  // 좋아요 표시는 보는 사람마다 다르므로 세션을 넘긴다 (비로그인도 목록은 볼 수 있다)
  const viewer = await getSessionUser();
  return NextResponse.json({ posts: await listPosts(category, past, viewer?.id) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }

  const body = await req.json().catch(() => null);
  const category = typeof body?.category === 'string' ? body.category : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const date = typeof body?.date === 'string' ? body.date : '';
  const startTime = typeof body?.startTime === 'string' ? body.startTime : '';
  const endTime = typeof body?.endTime === 'string' ? body.endTime : '';
  const location = typeof body?.location === 'string' ? body.location.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const rawCapacity = body?.capacity;

  if (!POST_CATEGORY_SLUGS.includes(category)) {
    return await errJson(E.badCategory, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return await errJson(E.badDateTime, 400);
  }
  if (startTime >= endTime) {
    return await errJson(E.endBeforeStart, 400);
  }
  // 날짜·시간 오타 방어 — 만들자마자 "지난 모임"으로 들어가는 걸 막는다
  // (목록 분류와 같은 기준이라 종료 후 유예 시간까지는 허용된다)
  if (isPastSlot(date, endTime)) {
    return await errJson(E.pastSlot, 400);
  }
  if (!location || location.length > 100) {
    return await errJson(E.location, 400);
  }
  if (description.length > 500) {
    return await errJson(E.memo, 400);
  }
  if (title.length > 100) {
    return await errJson(E.title, 400);
  }
  const cat = getCategory(category);
  const hasTitle = Boolean(cat?.titleLabel);
  // TMDB 메타는 자동완성을 쓰는 카테고리에서만 붙인다 (메뉴 같은 자유 입력은 제목만 저장)
  const titleMeta = hasTitle && title && cat?.titleSearch === 'tmdb' ? sanitizeTitleMeta(body?.titleMeta) : null;
  let capacity: number | undefined;
  if (rawCapacity !== undefined && rawCapacity !== null && rawCapacity !== '') {
    const n = Number(rawCapacity);
    if (!Number.isInteger(n) || n < 2 || n > 99) {
      return await errJson(E.capacity, 400);
    }
    capacity = n;
  }

  await ensureUser(user);
  const profile = (await getProfiles())[user.id];
  const authorName = resolveDisplayName(profile, user.name);
  const common = {
    category,
    authorId: user.id,
    authorName,
    ...(hasTitle && title ? { title } : {}),
    ...(titleMeta ? { titleMeta } : {}),
    startTime,
    endTime,
    location,
    ...(description ? { description } : {}),
    ...(capacity !== undefined ? { capacity } : {}),
    origin: req.nextUrl.origin,
  };

  // 매주 반복이면 규칙을 만들고 첫 회차를 생성한다 (이후 회차는 크론이 매일 채운다)
  if (body?.repeatWeekly === true) {
    const { ruleId, postId } = await createRecurringRule({ ...common, startDate: date });
    return NextResponse.json({ ok: true, postId, ruleId, repeatWeekly: true });
  }

  const postId = await createPost({ ...common, date });
  return NextResponse.json({ ok: true, postId });
}
