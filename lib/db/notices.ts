import { and, desc, eq, inArray } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { getDb } from './index';
import { noticeReads, notices } from './schema';
import { NOTICE_TAG } from '../cache-tags';

/**
 * 공지 — 관리자가 올리면 다들 앱을 열 때 알림창으로 한 번 보는 말.
 *
 * 새 소식(lib/changelog.ts)과 나눠 둔 이유: 저건 "무엇이 바뀌었나"라서 코드와 함께
 * 배포되고 홈 위의 띠로 조용히 알린다. 이건 "이렇게 해주세요"라서 그때그때 쓰고,
 * 지나치지 않게 화면 가운데를 막는다. 성격이 다르니 저장하는 곳도 보여주는 법도 다르다.
 *
 * 한 사람에게 뜨는 것은 그 사람이 볼 수 있는 것 중 가장 최근 하나뿐이다 —
 * 알림창이 둘 겹치면 어느 것도 제대로 안 읽힌다.
 */

export interface NoticeView {
  id: string;
  titleKo: string;
  titleEn: string | null;
  titleEs: string | null;
  bodyKo: string | null;
  bodyEn: string | null;
  bodyEs: string | null;
  /** 빈 배열이면 전체 */
  targets: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

function view(r: typeof notices.$inferSelect): NoticeView {
  return {
    id: r.id,
    titleKo: r.titleKo,
    titleEn: r.titleEn,
    titleEs: r.titleEs,
    bodyKo: r.bodyKo,
    bodyEn: r.bodyEn,
    bodyEs: r.bodyEs,
    targets: r.targets ?? [],
    active: r.active,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/**
 * 담아 두는 것은 "켜져 있는 공지들"이지 "이 사람에게 뜰 공지"가 아니다.
 *
 * 받는 사람을 골라 올릴 수 있게 되면서 답이 사람마다 달라졌는데, 그걸 그대로 담으면
 * 남에게 시험용 공지가 새어 나간다. 그래서 담는 것은 사람과 무관한 목록이고,
 * 고르는 것은 요청마다 pickFor가 한다 — 열두어 명짜리 앱에서 그 비용은 없는 것과 같다.
 */
const ACTIVE_LIMIT = 20;

async function activeQuery(): Promise<NoticeView[]> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(notices)
    .where(eq(notices.active, true))
    .orderBy(desc(notices.createdAt))
    .limit(ACTIVE_LIMIT);
  return rows.map(view);
}

export const activeNotices = unstable_cache(activeQuery, ['active-notices'], {
  tags: [NOTICE_TAG],
  revalidate: 300,
});

/** 이 사람이 볼 수 있는 공지들 — 받는 사람을 고르지 않았거나(전체) 그 안에 있는 것, 최신순 */
function visibleTo(list: NoticeView[], userId: string): NoticeView[] {
  return list.filter((n) => n.targets.length === 0 || n.targets.includes(userId));
}

/**
 * 지금 이 사람에게 띄울 공지 하나 — 볼 수 있는 것 중 아직 확인하지 않은 최신.
 *
 * 확인 여부는 담아 두지 않는다(사람마다 다르다). 볼 수 있는 목록은 담아 둔 것을 쓰고,
 * 여기서 그 몇 개에 대해서만 확인 기록을 묻는다 — 늘 한 번, 열두어 줄짜리 질의다.
 */
export async function noticeFor(list: NoticeView[], userId: string): Promise<NoticeView | null> {
  const mine = visibleTo(list, userId);
  if (mine.length === 0) return null;

  const db = await getDb();
  const rows = await db
    .select({ noticeId: noticeReads.noticeId, seenAt: noticeReads.seenAt })
    .from(noticeReads)
    .where(and(eq(noticeReads.userId, userId), inArray(noticeReads.noticeId, mine.map((n) => n.id))));
  const seenAt = new Map(rows.map((r) => [r.noticeId, r.seenAt.getTime()]));

  /*
   * 확인한 뒤에 내용이 바뀌었으면 다시 띄운다 — 고쳤다는 건 다시 읽혀야 한다는 뜻이다.
   * 그래서 「어느 판을 봤나」를 따로 담지 않고 두 시각을 견준다.
   */
  return mine.find((n) => (seenAt.get(n.id) ?? 0) < new Date(n.updatedAt).getTime()) ?? null;
}

/** 「알겠어요」 — 두 번 눌러도 한 줄이고, 다시 누르면 시각만 새로 적힌다 */
export async function markNoticeRead(noticeId: string, userId: string): Promise<void> {
  const db = await getDb();
  await db
    .insert(noticeReads)
    .values({ noticeId, userId })
    .onConflictDoUpdate({ target: [noticeReads.noticeId, noticeReads.userId], set: { seenAt: new Date() } });
}

export interface NoticeRead {
  userId: string;
  seenAt: string;
}

/** 공지별 확인한 사람들 — 관리자 목록에만 쓴다 */
export async function readsFor(noticeIds: string[]): Promise<Map<string, NoticeRead[]>> {
  const out = new Map<string, NoticeRead[]>();
  if (noticeIds.length === 0) return out;
  const db = await getDb();
  const rows = await db.select().from(noticeReads).where(inArray(noticeReads.noticeId, noticeIds));
  for (const r of rows) {
    const list = out.get(r.noticeId) ?? [];
    list.push({ userId: r.userId, seenAt: r.seenAt.toISOString() });
    out.set(r.noticeId, list);
  }
  return out;
}

/**
 * 관리자 화면이 보는 전체 목록 — 내린 것도 함께 (무엇을 언제 올렸는지가 기록이다).
 *
 * 확인 기록도 같이 준다. 다만 **고치기 전에 눌러 둔 것은 세지 않는다** —
 * 고친 뒤에는 그 사람들에게 다시 뜨고 있는데 화면에 「확인함」으로 남아 있으면
 * 「다들 봤구나」라는 거짓말이 된다.
 */
export async function listNotices(): Promise<(NoticeView & { reads: NoticeRead[] })[]> {
  const db = await getDb();
  const rows = await db.select().from(notices).orderBy(desc(notices.createdAt));
  const reads = await readsFor(rows.map((r) => r.id));
  return rows.map((r) => {
    const v = view(r);
    const cut = r.updatedAt.getTime();
    return { ...v, reads: (reads.get(r.id) ?? []).filter((x) => new Date(x.seenAt).getTime() >= cut) };
  });
}

export interface NoticeInput {
  titleKo: string;
  titleEn: string | null;
  titleEs: string | null;
  bodyKo: string | null;
  bodyEn: string | null;
  bodyEs: string | null;
}

/**
 * 새 공지. 올리면 앞의 것은 저절로 가려진다 —
 * 볼 수 있는 것 중 최신 하나만 뜨므로 이전 것을 따로 내리지 않아도 된다.
 */
export async function createNotice(input: NoticeInput & { targets: string[] }): Promise<NoticeView> {
  const db = await getDb();
  const id = crypto.randomUUID();
  const [row] = await db.insert(notices).values({ id, ...input }).returning();
  return view(row!);
}

/** 올리기·내리기. 없는 공지면 null */
export async function setNoticeActive(id: string, active: boolean): Promise<NoticeView | null> {
  const db = await getDb();
  const [row] = await db
    .update(notices)
    // updatedAt은 건드리지 않는다 — 내렸다 다시 올린 것을 "고쳤다"로 보면
    // 이미 읽고 닫은 사람들에게 같은 공지가 다시 뜬다
    .set({ active })
    .where(eq(notices.id, id))
    .returning();
  return row ? view(row) : null;
}

/**
 * 내용 고치기 — updatedAt이 바뀌므로 닫았던 사람에게도 다시 뜬다.
 *
 * 받는 사람도 여기서 바꾼다. 나한테만 띄워 보고 괜찮으면 전체로 넓히는 것이
 * 이 기능을 쓰는 가장 흔한 순서이기 때문이다.
 */
export async function editNotice(id: string, input: NoticeInput & { targets: string[] }): Promise<NoticeView | null> {
  const db = await getDb();
  const [row] = await db
    .update(notices)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(notices.id, id))
    .returning();
  return row ? view(row) : null;
}

export async function deleteNotice(id: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.delete(notices).where(eq(notices.id, id)).returning();
  return rows.length > 0;
}
