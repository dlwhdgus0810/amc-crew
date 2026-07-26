import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getProfiles, resolveDisplayName } from '@/lib/store';
import { countParticipants, deletePost, getPost, getPostView, updatePost } from '@/lib/db/posts';
import { getCategory } from '@/lib/categories';
import { sanitizeTitleMeta } from '@/lib/tmdb';
import { todayLocal } from '@/lib/dates';

export const dynamic = 'force-dynamic';

async function displayNameOf(user: { id: string; name: string }): Promise<string> {
  const profile = (await getProfiles())[user.id];
  return resolveDisplayName(profile, user.name);
}

/** 공유 링크 상세 페이지용 단건 조회 (비로그인 허용) */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await getPostView(id);
  if (!post) {
    return NextResponse.json({ error: '포스트를 찾을 수 없어요.' }, { status: 404 });
  }
  return NextResponse.json({ post });
}

/** 모임 수정 (작성자·관리자). 참가자에게 변경 알림 발송 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return NextResponse.json({ error: '포스트를 찾을 수 없어요.' }, { status: 404 });
  }
  if (post.authorId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: '작성자만 수정할 수 있어요.' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const date = typeof body?.date === 'string' ? body.date : '';
  const startTime = typeof body?.startTime === 'string' ? body.startTime : '';
  const endTime = typeof body?.endTime === 'string' ? body.endTime : '';
  const location = typeof body?.location === 'string' ? body.location.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const rawCapacity = body?.capacity;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return NextResponse.json({ error: '날짜와 시간을 올바르게 입력해주세요.' }, { status: 400 });
  }
  if (startTime >= endTime) {
    return NextResponse.json({ error: '종료 시간은 시작 시간보다 늦어야 해요.' }, { status: 400 });
  }
  // 지난 날짜로 옮기는 것만 막는다 — 이미 끝난 모임의 메모·장소를 고치는 건 그대로 허용
  if (date < todayLocal() && date !== post.date) {
    return NextResponse.json({ error: '지난 날짜로는 옮길 수 없어요.' }, { status: 400 });
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
  const hasTitle = Boolean(getCategory(post.category)?.titleLabel);
  const titleMeta = hasTitle && title ? sanitizeTitleMeta(body?.titleMeta) : null;
  let capacity: number | null = null;
  if (rawCapacity !== undefined && rawCapacity !== null && rawCapacity !== '') {
    const n = Number(rawCapacity);
    if (!Number.isInteger(n) || n < 2 || n > 99) {
      return NextResponse.json({ error: '정원은 2~99 사이 숫자로 입력해주세요.' }, { status: 400 });
    }
    const current = await countParticipants(id);
    if (n < current) {
      return NextResponse.json({ error: `현재 참가 인원(${current}명)보다 적게 설정할 수 없어요.` }, { status: 400 });
    }
    capacity = n;
  }

  await updatePost({
    postId: id,
    category: post.category,
    actorId: user.id,
    actorName: await displayNameOf(user),
    title: hasTitle && title ? title : null,
    titleMeta,
    date,
    startTime,
    endTime,
    location,
    description: description || null,
    capacity,
    origin: req.nextUrl.origin,
  });
  return NextResponse.json({ ok: true });
}

/** 모임 삭제(취소) (작성자·관리자). 참가자에게 취소 알림 발송 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: '카카오 로그인이 필요해요.' }, { status: 401 });
  }
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return NextResponse.json({ error: '포스트를 찾을 수 없어요.' }, { status: 404 });
  }
  if (post.authorId !== user.id && !isAdmin(user)) {
    return NextResponse.json({ error: '작성자만 삭제할 수 있어요.' }, { status: 403 });
  }
  await deletePost(post, user.id, await displayNameOf(user), req.nextUrl.origin);
  return NextResponse.json({ ok: true });
}
