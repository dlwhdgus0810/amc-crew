import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getProfiles, resolveDisplayName } from '@/lib/store';
import { ensureUser } from '@/lib/db/users';
import { createPost, listPosts } from '@/lib/db/posts';
import { getCategory, POST_CATEGORY_SLUGS } from '@/lib/categories';
import { sanitizeTitleMeta } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? '';
  const past = req.nextUrl.searchParams.get('past') === '1';
  if (!POST_CATEGORY_SLUGS.includes(category)) {
    return NextResponse.json({ error: '올바르지 않은 카테고리입니다.' }, { status: 400 });
  }
  return NextResponse.json({ posts: await listPosts(category, past) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
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
    return NextResponse.json({ error: '올바르지 않은 카테고리입니다.' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return NextResponse.json({ error: '날짜와 시간을 올바르게 입력해주세요.' }, { status: 400 });
  }
  if (startTime >= endTime) {
    return NextResponse.json({ error: '종료 시간은 시작 시간보다 늦어야 해요.' }, { status: 400 });
  }
  if (!location || location.length > 100) {
    return NextResponse.json({ error: '장소는 1~100자로 입력해주세요.' }, { status: 400 });
  }
  if (description.length > 500) {
    return NextResponse.json({ error: '메모는 500자 이하로 입력해주세요.' }, { status: 400 });
  }
  if (title.length > 100) {
    return NextResponse.json({ error: '제목은 100자 이하로 입력해주세요.' }, { status: 400 });
  }
  const hasTitle = Boolean(getCategory(category)?.titleLabel);
  const titleMeta = hasTitle && title ? sanitizeTitleMeta(body?.titleMeta) : null;
  let capacity: number | undefined;
  if (rawCapacity !== undefined && rawCapacity !== null && rawCapacity !== '') {
    const n = Number(rawCapacity);
    if (!Number.isInteger(n) || n < 2 || n > 99) {
      return NextResponse.json({ error: '정원은 2~99 사이 숫자로 입력해주세요.' }, { status: 400 });
    }
    capacity = n;
  }

  await ensureUser(user);
  const profile = (await getProfiles())[user.id];
  const authorName = resolveDisplayName(profile, user.name);
  const postId = await createPost({
    category,
    authorId: user.id,
    authorName,
    ...(hasTitle && title ? { title } : {}),
    ...(titleMeta ? { titleMeta } : {}),
    date,
    startTime,
    endTime,
    location,
    ...(description ? { description } : {}),
    ...(capacity !== undefined ? { capacity } : {}),
    origin: req.nextUrl.origin,
  });
  return NextResponse.json({ ok: true, postId });
}
