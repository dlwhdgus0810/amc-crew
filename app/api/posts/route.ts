import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser, isAdmin } from '@/lib/auth';
import { getProfiles, resolveDisplayName } from '@/lib/store';
import { dbGetUser, ensureUser } from '@/lib/db/users';
import { createPost, listPosts } from '@/lib/db/posts';
import { pathAllowed } from '@/lib/photos';
import { addPhoto } from '@/lib/db/photos';
import { friendIds } from '@/lib/db/friends';
import { createRecurringRule } from '@/lib/db/recurring';
import { getCategory, POST_CATEGORY_SLUGS } from '@/lib/categories';
import { sanitizeTitleMeta } from '@/lib/tmdb';
import { isPastSlot } from '@/lib/dates';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const category = req.nextUrl.searchParams.get('category') ?? '';
  const past = req.nextUrl.searchParams.get('past') === '1';
  if (!POST_CATEGORY_SLUGS.includes(category)) {
    return await errJson(E.badCategory, 400);
  }
  // 좋아요 표시는 보는 사람마다 다르므로 세션을 넘긴다 (비로그인도 목록은 볼 수 있다)
  const viewer = await getSessionUser();
  // 지난 비공개 모임을 볼지는 사람마다 다르다 (프로필 설정, 기본은 안 보임)
  const showPastPrivate = viewer ? ((await dbGetUser(viewer.id))?.showPastPrivate ?? false) : false;
  return NextResponse.json({ posts: await listPosts(category, past, viewer?.id, showPastPrivate) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;

  const body = await req.json().catch(() => null);
  const category = typeof body?.category === 'string' ? body.category : '';
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const date = typeof body?.date === 'string' ? body.date : '';
  const startTime = typeof body?.startTime === 'string' ? body.startTime : '';
  // 종료 시각은 안 적어도 된다 — 빈 값이면 null로 저장하고, 언제 끝난 걸로 볼지는 lib/dates.ts가 정한다
  const endTime = typeof body?.endTime === 'string' && body.endTime ? body.endTime : null;
  const location = typeof body?.location === 'string' ? body.location.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const rawCapacity = body?.capacity;

  if (!POST_CATEGORY_SLUGS.includes(category)) {
    return await errJson(E.badCategory, 400);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime)) {
    return await errJson(E.badDateTime, 400);
  }
  if (endTime !== null && !/^\d{2}:\d{2}$/.test(endTime)) {
    return await errJson(E.badDateTime, 400);
  }
  if (endTime !== null && startTime >= endTime) {
    return await errJson(E.endBeforeStart, 400);
  }
  /*
   * 날짜·시간 오타 방어 — 만들자마자 "지난 모임"으로 들어가는 걸 막는다.
   * (목록 분류와 같은 기준이라 종료 후 유예 시간까지는 허용된다)
   *
   * 관리자는 예외다. 앱을 쓰기 전에 있었던 모임이나 누가 올리는 걸 잊은 모임을
   * 나중에 채워 넣어야 하는데, 그건 오타가 아니라 기록을 맞추는 일이다.
   */
  const backfilling = isPastSlot(date, startTime, endTime);
  if (backfilling && !isAdmin(user)) {
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
  /*
   * 같이 여는 사람. 화면에서 친구만 고르게 되어 있지만 서버에서 다시 확인한다 —
   * 오래 열어 둔 화면이 예전 목록을 들고 있을 수 있고, 점수가 걸린 값이라 더 그렇다.
   */
  const askedCoHost = typeof body?.coHostId === 'string' && body.coHostId ? body.coHostId : null;
  if (askedCoHost && (askedCoHost === user.id || !(await friendIds(user.id)).includes(askedCoHost))) {
    return await errJson(E.coHostNotFriend, 400);
  }

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
    // 비공개면 링크를 아는 사람만 볼 수 있다 (목록·구독 알림·홈 요약에서 빠진다)
    ...(body?.visibility === 'link' ? { visibility: 'link' as const } : {}),
    origin: siteUrl(req.nextUrl.origin),
    ...(askedCoHost ? { coHostId: askedCoHost } : {}),
    // 닉네임 허용은 명시적으로 켤 때만 — 기본은 실명 모임이다
    ...(body?.allowNicknames === true ? { allowNicknames: true } : {}),
    /*
     * 이미 지난 모임을 채워 넣는 것은 기록이지 안내가 아니다 — 아무에게도 알리지 않는다.
     * 지난 모임을 고칠 때 알림을 안 보내는 것과 같은 기준이다.
     */
    ...(backfilling ? { silent: true as const } : {}),
  };

  // 매주 반복이면 규칙을 만들고 첫 회차를 생성한다 (이후 회차는 크론이 매일 채운다)
  if (body?.repeatWeekly === true) {
    const { ruleId, postId } = await createRecurringRule({ ...common, startDate: date });
    // 첫 회차에만 붙인다 — 다음 주 회차는 그 주의 사진을 각자 올리면 된다
    if (typeof body?.photoPath === 'string' && pathAllowed(body.photoPath, user.id)) {
      await addPhoto({ postId, userId: user.id, pathname: body.photoPath, width: null, height: null });
    }
    return NextResponse.json({ ok: true, postId, ruleId, repeatWeekly: true });
  }

  /*
   * 비공개 모임에 부를 친구들. 화면에서 이미 내 친구만 고르게 되어 있지만,
   * 서버에서 다시 교집합을 잡는다 — 오래 열어 둔 화면이 예전 목록을 들고 있을 수 있다.
   */
  const invited =
    body?.visibility === 'link' && Array.isArray(body?.inviteFriendIds)
      ? await (async () => {
          const asked = new Set(body.inviteFriendIds.filter((v: unknown) => typeof v === 'string').slice(0, 50));
          return (await friendIds(user.id)).filter((id) => asked.has(id));
        })()
      : [];

  const postId = await createPost({ ...common, date, ...(invited.length > 0 ? { inviteFriendIds: invited } : {}) });

  /*
   * 만들면서 고른 사진을 그 모임의 첫 사진으로 붙인다.
   *
   * 고를 때는 모임이 아직 없어서 「이 모임의 사진」으로 올릴 수가 없다. 그래서 올린 사람
   * 자리에 먼저 두고, 모임이 생긴 지금 매단다. 자기가 올린 자리인지 여기서 다시 본다 —
   * 브라우저가 보내는 값이라 그대로 믿으면 남의 파일을 자기 모임에 걸 수 있다.
   */
  if (typeof body?.photoPath === 'string' && pathAllowed(body.photoPath, user.id)) {
    await addPhoto({ postId, userId: user.id, pathname: body.photoPath, width: null, height: null });
  }
  // past를 화면에 알려준다 — 알림이 갔다고 적을지 말지를 서버 판정으로 정하게(기준이 둘이면 어긋난다)
  return NextResponse.json({ ok: true, postId, past: backfilling });
}
