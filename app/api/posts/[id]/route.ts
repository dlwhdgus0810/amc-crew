import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { friendIds } from '@/lib/db/friends';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getProfiles, LocalName, localName } from '@/lib/store';
import { countParticipants, deletePost, getPost, getPostView, notifyCoHost, updatePost } from '@/lib/db/posts';
import { getCategory } from '@/lib/categories';
import { sanitizeTitleMeta } from '@/lib/tmdb';
import { isPastSlot, todayLocal } from '@/lib/dates';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** 알림에 실을 이름 — 받는 사람의 언어로 정해진다 */
async function displayNameOf(user: { id: string; name: string }): Promise<LocalName> {
  const profile = (await getProfiles())[user.id];
  return localName(profile, user.name);
}

/** 공유 링크 상세 페이지용 단건 조회 (비로그인 허용) */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getSessionUser();
  const post = await getPostView(id, viewer?.id);
  if (!post) {
    return await errJson(E.postNotFound, 404);
  }
  return NextResponse.json({ post });
}

/** 모임 수정 (작성자·관리자). 참가자에게 변경 알림 발송 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return await errJson(E.postNotFound, 404);
  }
  // 같이 연 사람도 호스트다 — 시간·장소를 고치는 건 둘 다 할 수 있어야 한다
  if (post.authorId !== user.id && post.coHostId !== user.id && !isAdmin(user)) {
    return await errJson(E.authorOnlyEdit, 403);
  }

  const body = await req.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  // 날짜 미정으로 두거나(둘 다 null) 나중에 날짜를 정하는 것 둘 다 여기로 온다
  const noDate = body?.date === null || body?.date === '';
  const date = !noDate && typeof body?.date === 'string' ? body.date : null;
  // 여행처럼 며칠 이어지는 카테고리는 시각을 안 받는다 (만들 때와 같은 규칙)
  const ranged = Boolean(getCategory(post.category)?.dateRange);
  const startTime = !noDate && !ranged && typeof body?.startTime === 'string' ? body.startTime : null;
  // 종료 시각은 안 적어도 된다 — 빈 값이면 null로 저장하고, 언제 끝난 걸로 볼지는 lib/dates.ts가 정한다
  const endTime = !ranged && typeof body?.endTime === 'string' && body.endTime ? body.endTime : null;
  const endDate = ranged && typeof body?.endDate === 'string' && body.endDate ? body.endDate : null;
  const lodging = typeof body?.lodging === 'string' ? body.lodging.trim() : '';
  const location = typeof body?.location === 'string' ? body.location.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const rawCapacity = body?.capacity;

  if (!noDate && (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return await errJson(E.badDateTime, 400);
  }
  if (!noDate && !ranged && (!startTime || !/^\d{2}:\d{2}$/.test(startTime))) {
    return await errJson(E.badDateTime, 400);
  }
  if (endDate !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || !date || endDate < date)) {
    return await errJson(E.endBeforeStart, 400);
  }
  // 날짜를 비워 두는 것은 참가신청을 쓰는 카테고리에서만 (만들 때와 같은 규칙)
  if (noDate && !getCategory(post.category)?.signup) {
    return await errJson(E.badDateTime, 400);
  }
  if (endTime !== null && !/^\d{2}:\d{2}$/.test(endTime)) {
    return await errJson(E.badDateTime, 400);
  }
  if (endTime !== null && startTime && startTime >= endTime) {
    return await errJson(E.endBeforeStart, 400);
  }

  /*
   * 같이 여는 사람 바꾸기. 값을 아예 안 보내면 지금 사람을 그대로 둔다.
   * 바꾸는 건 모임을 만든 사람만 — 공동 호스트가 자기를 빼거나 남으로 갈아끼울 수 있으면
   * 점수가 걸린 자리를 서로 뺏을 수 있다.
   */
  let coHostId: string | null | undefined;
  if (body?.coHostId !== undefined && (post.authorId === user.id || isAdmin(user))) {
    coHostId = typeof body.coHostId === 'string' && body.coHostId ? body.coHostId : null;
    /*
     * 만든 사람은 자기 친구 중에서만 고른다. 관리자는 그 제한을 받지 않는다 —
     * 명단을 바로잡는 사람이라 친구가 아닌 사람도 호스트로 세울 일이 있다.
     * 다만 만든 사람 자신을 공동 호스트로 넣는 건 누구든 막는다 (한 사람이 두 몫을 가져간다).
     */
    if (coHostId && coHostId === post.authorId) {
      return await errJson(E.coHostIsAuthor, 400);
    }
    if (coHostId && !isAdmin(user) && !(await friendIds(user.id)).includes(coHostId)) {
      return await errJson(E.coHostNotFriend, 400);
    }
  }
  /*
   * 지난 날짜로 옮기는 것만 막는다 — 이미 끝난 모임의 메모·장소를 고치는 건 그대로 허용.
   * 관리자는 옮길 수도 있다 (날짜를 잘못 적어 둔 기록을 바로잡는 경우).
   */
  if (date < todayLocal() && date !== post.date && !isAdmin(user)) {
    return await errJson(E.pastMove, 400);
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
  const cat = getCategory(post.category);
  const hasTitle = Boolean(cat?.titleLabel);
  // TMDB 메타는 자동완성을 쓰는 카테고리에서만 (메뉴 같은 자유 입력은 제목만 저장)
  const titleMeta = hasTitle && title && cat?.titleSearch === 'tmdb' ? sanitizeTitleMeta(body?.titleMeta) : null;
  let capacity: number | null = null;
  if (rawCapacity !== undefined && rawCapacity !== null && rawCapacity !== '') {
    const n = Number(rawCapacity);
    if (!Number.isInteger(n) || n < 2 || n > 99) {
      return await errJson(E.capacity, 400);
    }
    const current = await countParticipants(id);
    if (n < current) {
      return await errJson(E.capacityBelowJoined, 400, { n: current });
    }
    capacity = n;
  }

  /*
   * 지난 모임을 고치는 건 바로잡는 일이지 알릴 일이 아니다.
   *
   * 고치기 전과 후를 둘 다 본다. 앞날 모임을 지난 날짜로 옮기는 것도 기록을 맞추는
   * 일이라서다 — 7/1에 한 모임을 누가 9/25로 잘못 올려놨을 때 관리자가 되돌리는 경우다.
   * 고치기 전만 보면 그때 「모임 변경 · 7/1」이 나가는데, 이미 끝난 일을 알리는 셈이 된다.
   */
  const editingPast =
    isPastSlot(post.date, post.startTime, post.endTime, post.endDate) ||
    isPastSlot(date, startTime, endTime, endDate);

  /*
   * 같이 여는 사람만 바뀐 경우.
   *
   * 그때는 참가자들에게 「모임 변경」을 보내지 않는다 — 시간도 장소도 그대로인데
   * 변경 알림이 오면 뭐가 달라졌나 다시 열어보게 된다. 대신 새로 세워진 사람에게만 알린다.
   */
  const newCoHost = coHostId !== undefined && coHostId !== post.coHostId ? coHostId : null;
  const onlyCoHostChanged =
    newCoHost !== null &&
    date === post.date &&
    startTime === post.startTime &&
    endTime === post.endTime &&
    endDate === post.endDate &&
    (lodging || null) === post.lodging &&
    location === post.location &&
    (description || null) === post.description &&
    capacity === post.capacity &&
    (hasTitle && title ? title : null) === post.title &&
    (body?.visibility === undefined || body.visibility === post.visibility) &&
    (typeof body?.allowNicknames !== 'boolean' || body.allowNicknames === post.allowNicknames) &&
    // 플라이어만 바꾼 것도 「변경 알림」이 나갈 일이 아니다 — 시간도 장소도 그대로다
    true;

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
    endDate,
    lodging: lodging || null,
    location,
    description: description || null,
    capacity,
    ...(body?.visibility === 'link' || body?.visibility === 'public'
      ? { visibility: body.visibility as 'public' | 'link' }
      : {}),
    ...(coHostId !== undefined ? { coHostId } : {}),
    ...(typeof body?.allowNicknames === 'boolean' ? { allowNicknames: body.allowNicknames } : {}),
    ...(editingPast || onlyCoHostChanged ? { silent: true } : {}),
    origin: siteUrl(req.nextUrl.origin),
  });



  /*
   * 새로 세워진 공동 호스트에게만 따로 알린다. 지난 모임은 알리지 않는다 —
   * 이미 끝난 모임의 명단을 바로잡는 일이라 그 사람이 할 일이 없다.
   */
  if (newCoHost && !editingPast) {
    try {
      /*
       * 고친 뒤의 값으로 알린다. post는 고치기 전 모습이라, 장소를 함께 바꾼 경우
       * 새 호스트에게 옛 장소가 적힌 알림이 간다.
       */
      await notifyCoHost(
        { ...post, date, startTime, location, title: hasTitle && title ? title : null },
        await displayNameOf(user),
        newCoHost
      );
    } catch (e) {
      console.error('[posts] co-host notify failed:', e);
    }
  }
  return NextResponse.json({ ok: true });
}

/** 모임 삭제(취소) (작성자·관리자). 참가자에게 취소 알림 발송 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;
  const { id } = await params;
  const post = await getPost(id);
  if (!post) {
    return await errJson(E.postNotFound, 404);
  }
  if (post.authorId !== user.id && post.coHostId !== user.id && !isAdmin(user)) {
    return await errJson(E.authorOnlyDelete, 403);
  }
  /*
   * 지난 모임은 기록이다 — 누가 언제 뭘 했는지, 호스트 점수가 어디서 왔는지가 여기 남는다.
   * 그래서 호스트에게는 지우는 길을 막아 둔다. 실수로 하나 지우면 되돌릴 방법이 없다.
   * 관리자만 지운다: 잘못 올라간 모임을 치우는 사람이 아무도 없으면 그건 그것대로 막힌다.
   */
  if (!isAdmin(user) && isPastSlot(post.date, post.startTime, post.endTime, post.endDate)) {
    return await errJson(E.pastDelete, 400);
  }
  // 지난 모임을 치우는 것은 정리지 취소가 아니다 — 알림을 보내지 않는다
  const wasPast = isPastSlot(post.date, post.startTime, post.endTime, post.endDate);
  await deletePost(post, user.id, await displayNameOf(user), siteUrl(req.nextUrl.origin), wasPast);
  return NextResponse.json({ ok: true });
}
