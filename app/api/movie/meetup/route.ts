import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { getSessionUser } from '@/lib/auth';
import { ensureUser } from '@/lib/db/users';
import { getProfiles, getSelections, resolveDisplayName } from '@/lib/store';
import { addParticipants, createPost, findPostByShowtime } from '@/lib/db/posts';
import { AMC_THEATRE_NAME } from '@/lib/amc';
import { Showtime } from '@/lib/types';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';

/** 상영 시작부터 이만큼을 모임 시간으로 잡는다 (예고편 + 본편 + 나오는 시간) */
const RUNTIME_MINUTES = 180;

function endTime(start: string): string {
  const [h, m] = start.split(':').map(Number);
  const total = (h * 60 + m + RUNTIME_MINUTES) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * AMC 회차 그룹을 실제 모임으로 만든다.
 * 그 회차를 고른 사람들이 그대로 참가자가 되고, 이후 댓글·리마인더·캘린더가 모두 붙는다.
 */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }

  const body = await req.json().catch(() => null);
  const showtimeId = typeof body?.showtimeId === 'string' ? body.showtimeId : '';
  if (!showtimeId) {
    return await errJson(E.badRequest, 400);
  }

  // 같은 회차로 두 번 만들지 않는다 — 이미 있으면 그 모임으로 안내한다
  const existing = await findPostByShowtime(showtimeId);
  if (existing) {
    return NextResponse.json({ ok: true, postId: existing.id, existed: true });
  }

  // 회차 정보와 참가자는 선택 현황에서 가져온다 (선택에 회차 스냅샷이 들어 있다)
  const selections = await getSelections();
  const pickers: string[] = [];
  let showtime: Showtime | undefined;
  for (const [userId, sel] of Object.entries(selections)) {
    const pick = sel.picks.find((p) => p.id === showtimeId);
    if (!pick) continue;
    pickers.push(userId);
    showtime ??= pick;
  }
  if (!showtime) {
    return await errJson(E.showtimesInvalid, 400);
  }

  await ensureUser(user);
  const profiles = await getProfiles();
  const postId = await createPost({
    category: 'movienight',
    authorId: user.id,
    authorName: resolveDisplayName(profiles[user.id], user.name),
    title: `${showtime.movieName} (${showtime.format})`,
    date: showtime.date,
    startTime: showtime.time,
    endTime: endTime(showtime.time),
    location: AMC_THEATRE_NAME,
    amcShowtimeId: showtimeId,
    origin: siteUrl(req.nextUrl.origin),
  });

  // 이 회차를 고른 사람들을 참가자로 (작성자는 createPost가 이미 넣었다)
  await addParticipants(postId, pickers.filter((id) => id !== user.id));

  return NextResponse.json({ ok: true, postId, joined: pickers.length });
}
