import { desc, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { getDb } from './index';
import { notices } from './schema';
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
  bodyKo: string | null;
  bodyEn: string | null;
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
    bodyKo: r.bodyKo,
    bodyEn: r.bodyEn,
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

/** 이 사람에게 뜰 공지 하나 — 받는 사람을 고르지 않았거나(전체) 그 안에 있는 것 중 최신 */
export function pickFor(list: NoticeView[], userId: string): NoticeView | null {
  return list.find((n) => n.targets.length === 0 || n.targets.includes(userId)) ?? null;
}

/** 관리자 화면이 보는 전체 목록 — 내린 것도 함께 (무엇을 언제 올렸는지가 기록이다) */
export async function listNotices(): Promise<NoticeView[]> {
  const db = await getDb();
  const rows = await db.select().from(notices).orderBy(desc(notices.createdAt));
  return rows.map(view);
}

export interface NoticeInput {
  titleKo: string;
  titleEn: string | null;
  bodyKo: string | null;
  bodyEn: string | null;
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
