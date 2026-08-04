import { and, asc, eq, gte, inArray, lte, or } from 'drizzle-orm';
import { getDb } from './index';
import { postParticipants, posts } from './schema';
import { isPastSlot, todayLocal } from '../dates';

/**
 * 달력 한 칸에 필요한 만큼만 담은 모임.
 * 목록 화면(PostView)과 달리 댓글·참가자 이름은 싣지 않는다 — 한 달치를 한꺼번에 그려야 해서
 * 칸마다 필요한 건 "몇 시에, 무슨 카테고리로, 몇 명이" 정도다.
 */
export interface CalendarMeetup {
  id: string;
  category: string;
  title: string | null;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string | null;
  location: string;
  capacity: number | null;
  count: number;
  /** 보는 사람이 참가 중인지 (비로그인이면 false) */
  joined: boolean;
  isPast: boolean;
  /** 링크를 아는 사람만 볼 수 있는 모임 — 달력에서도 표시해 준다 */
  private: boolean;
}

/**
 * from~to (양끝 포함) 사이의 모임.
 *
 * 달력은 월 격자든 한 주든 "화면에 그릴 기간"이 그때그때 달라서 날짜 범위로 받는다.
 * 목록 화면과 달리 지난 모임도 함께 준다 — 달력은 "그날 무슨 일이 있었나"를 보는 화면이라
 * 지난 날짜가 빈칸이면 오히려 고장처럼 보인다.
 */
export async function listMeetupsBetween(
  from: string,
  to: string,
  viewerId?: string,
  showPastPrivate = false
): Promise<CalendarMeetup[]> {
  const db = await getDb();

  // YYYY-MM-DD는 사전순 비교가 곧 날짜순 비교라 문자열 그대로 범위를 잡을 수 있다
  const inRange = and(gte(posts.date, from), lte(posts.date, to));
  /*
   * 비공개(link) 모임은 만든 사람과 참가자에게만 보인다 — 목록 화면과 같은 규칙.
   * 다만 이미 지난 날의 비공개는 기본으로 가린다. 캘린더는 지난 날짜도 함께 그리는
   * 화면이라, 안 가리면 옆 사람이 볼 때 지난 비공개 모임이 그대로 남는다.
   * 경계는 「오늘」이다 — 오늘 낮에 끝난 모임까지 그날 안에서 지우면 오히려 어리둥절하다.
   */
  const mine = viewerId
    ? or(
        eq(posts.authorId, viewerId),
        inArray(
          posts.id,
          db.select({ id: postParticipants.postId }).from(postParticipants).where(eq(postParticipants.userId, viewerId))
        )
      )
    : undefined;
  const visible = mine
    ? or(eq(posts.visibility, 'public'), showPastPrivate ? mine : and(mine, gte(posts.date, todayLocal())))
    : eq(posts.visibility, 'public');

  const rows = await db
    .select({
      id: posts.id,
      category: posts.category,
      title: posts.title,
      date: posts.date,
      startTime: posts.startTime,
      endTime: posts.endTime,
      location: posts.location,
      capacity: posts.capacity,
      visibility: posts.visibility,
    })
    .from(posts)
    .where(and(inRange, visible))
    .orderBy(asc(posts.date), asc(posts.startTime));

  if (rows.length === 0) return [];

  const participantRows = await db
    .select({ postId: postParticipants.postId, userId: postParticipants.userId })
    .from(postParticipants)
    .where(
      inArray(
        postParticipants.postId,
        rows.map((r) => r.id)
      )
    );

  const count = new Map<string, number>();
  const joined = new Set<string>();
  for (const p of participantRows) {
    count.set(p.postId, (count.get(p.postId) ?? 0) + 1);
    if (viewerId && p.userId === viewerId) joined.add(p.postId);
  }

  return rows.map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    date: r.date,
    startTime: r.startTime,
    endTime: r.endTime,
    location: r.location,
    capacity: r.capacity,
    count: count.get(r.id) ?? 0,
    joined: joined.has(r.id),
    isPast: isPastSlot(r.date, r.startTime, r.endTime),
    private: r.visibility === 'link',
  }));
}
