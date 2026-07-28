/* ============================================================
   새 파일 — lib/db/next-meetups.ts 로 저장하세요.
   카테고리별 "다음 모임 한 줄"에 필요한 최소 정보만 모아 옵니다.
   쿼리 2번(예정 모임 + 참가자)으로 전체 카테고리를 한꺼번에 처리합니다.
   ============================================================ */

import { and, asc, eq, gt, inArray, or } from 'drizzle-orm';
import { getDb } from './index';
import { postParticipants, posts } from './schema';
import { pastCutoff } from '../dates';

export interface NextMeetup {
  postId: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  /** 장소 (AMC는 상영 포맷) */
  location: string;
  /** 제목이 있는 카테고리면 그 제목 (AMC는 영화 이름) */
  title: string | null;
  count: number;
  capacity: number | null;
  /** 보는 사람이 이미 참가 중인지 (비로그인이면 false) */
  joined: boolean;
}

/**
 * 카테고리별 가장 가까운 예정 모임.
 * "지난 모임" 판정은 목록 화면과 같은 기준(종료 시각 + 유예)을 쓴다.
 */
export async function nextMeetupByCategory(
  categories: string[],
  viewerId?: string
): Promise<Record<string, NextMeetup>> {
  if (categories.length === 0) return {};
  const db = await getDb();
  const { date: cutDate, time: cutTime } = pastCutoff();
  const upcoming = or(gt(posts.date, cutDate), and(eq(posts.date, cutDate), gt(posts.endTime, cutTime)));

  const rows = await db
    .select({
      id: posts.id,
      category: posts.category,
      title: posts.title,
      date: posts.date,
      startTime: posts.startTime,
      location: posts.location,
      capacity: posts.capacity,
    })
    .from(posts)
    .where(and(inArray(posts.category, categories), upcoming))
    .orderBy(asc(posts.date), asc(posts.startTime));

  // 날짜순으로 왔으므로 카테고리마다 처음 만난 행이 곧 다음 모임이다
  const firstByCategory = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!firstByCategory.has(r.category)) firstByCategory.set(r.category, r);
  }
  if (firstByCategory.size === 0) return {};

  const ids = [...firstByCategory.values()].map((r) => r.id);
  const participantRows = await db
    .select({ postId: postParticipants.postId, userId: postParticipants.userId })
    .from(postParticipants)
    .where(inArray(postParticipants.postId, ids));

  const count = new Map<string, number>();
  const joined = new Set<string>();
  for (const p of participantRows) {
    count.set(p.postId, (count.get(p.postId) ?? 0) + 1);
    if (viewerId && p.userId === viewerId) joined.add(p.postId);
  }

  const out: Record<string, NextMeetup> = {};
  for (const [category, r] of firstByCategory) {
    out[category] = {
      postId: r.id,
      date: r.date,
      startTime: r.startTime,
      location: r.location,
      title: r.title,
      count: count.get(r.id) ?? 0,
      capacity: r.capacity,
      joined: joined.has(r.id),
    };
  }
  return out;
}
