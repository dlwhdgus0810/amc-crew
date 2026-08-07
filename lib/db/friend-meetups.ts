import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from './index';
import { postParticipants, posts } from './schema';
import { isPastSlot } from '../dates';
import { meetupScopeFor, type MeetupScope } from './friends';

/**
 * 친구 한 명이 참가한 모임 목록.
 *
 * 두 겹으로 걸러진다.
 *  1. 비공개(link) 모임은 어느 경우에도 나가지 않는다. 링크를 받은 사람만 아는 모임인데
 *     친구 화면에 뜨면 그 자리에서 새어 나간다. 범위 설정과 무관한 절대 규칙이다.
 *  2. 그 친구가 나에게 정해 둔 범위(all | upcoming | none).
 *
 * 참가자 이름·댓글은 싣지 않는다 — "언제 어디서 뭘 하는지"만 보여주는 목록이라
 * 그 사람의 다른 인간관계까지 딸려 나갈 이유가 없다.
 */

export interface FriendMeetup {
  id: string;
  category: string;
  title: string | null;
  date: string;
  startTime: string;
  endTime: string | null;
  location: string;
  /** 나도 그 모임에 있는지 — "같이 갔던 모임"을 표시해 준다 */
  together: boolean;
}

export interface FriendMeetups {
  scope: MeetupScope;
  upcoming: FriendMeetup[];
  past: FriendMeetup[];
}

/** 지난 모임은 최근 것부터 이만큼만 (끝없이 내려가는 화면이 아니다) */
const PAST_LIMIT = 30;

export async function friendMeetups(viewerId: string, ownerId: string): Promise<FriendMeetups | null> {
  const scope = await meetupScopeFor(viewerId, ownerId);
  if (scope === null) return null; // 친구가 아니다
  if (scope === 'none') return { scope, upcoming: [], past: [] };

  const db = await getDb();
  const rows = await db
    .select({
      id: posts.id,
      category: posts.category,
      title: posts.title,
      date: posts.date,
      startTime: posts.startTime,
      endTime: posts.endTime,
      location: posts.location,
    })
    .from(posts)
    .innerJoin(postParticipants, eq(postParticipants.postId, posts.id))
    .where(and(eq(postParticipants.userId, ownerId), eq(posts.visibility, 'public')))
    .orderBy(asc(posts.date), asc(posts.startTime));

  // 내가 함께 있었던 모임 표시 — 한 번에 모아 온다
  const ids = rows.map((r) => r.id);
  const mine = ids.length
    ? await db
        .select({ postId: postParticipants.postId })
        .from(postParticipants)
        .where(and(eq(postParticipants.userId, viewerId), inArray(postParticipants.postId, ids)))
    : [];
  const withMe = new Set(mine.map((m) => m.postId));

  const upcoming: FriendMeetup[] = [];
  const past: FriendMeetup[] = [];
  for (const r of rows) {
    /*
     * 날짜 미정(모집 중)은 여기서 뺀다. 이 화면은 「이 친구가 언제 뭘 하는지」를
     * 날짜 줄로 늘어놓는 곳이라, 날짜가 없는 줄은 놓을 자리가 없다.
     */
    if (!r.date || !r.startTime) continue;
    const item: FriendMeetup = { ...r, date: r.date, startTime: r.startTime, together: withMe.has(r.id) };
    if (isPastSlot(r.date, r.startTime, r.endTime)) past.push(item);
    else upcoming.push(item);
  }
  past.reverse(); // 최근 것부터

  return { scope, upcoming, past: scope === 'upcoming' ? [] : past.slice(0, PAST_LIMIT) };
}
