import { desc, eq, inArray } from 'drizzle-orm';
import { getDb } from './index';
import { categoryRequests, notifications, users } from './schema';
import { resolveDisplayName } from '../store';
import { sendKakaoMemos } from '../kakao';
import { adminIds } from '../auth';

export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface CategoryRequestView {
  id: string;
  userId: string;
  userName: string;
  name: string;
  color: string;
  description: string;
  featureRequest: string | null;
  status: RequestStatus;
  adminNote: string | null;
  createdAt: string;
}

function displayNameOf(row: { kakaoName: string; nickname: string | null } | undefined): string {
  if (!row) return '알 수 없음';
  return resolveDisplayName(
    { kakaoName: row.kakaoName, ...(row.nickname ? { nickname: row.nickname } : {}), kakaoNameHistory: [] },
    '알 수 없음'
  );
}

/** 제안 목록. userId를 주면 그 사람 것만 (일반 사용자), 없으면 전체 (관리자). */
export async function listCategoryRequests(userId?: string): Promise<CategoryRequestView[]> {
  const db = await getDb();
  const rows = userId
    ? await db
        .select()
        .from(categoryRequests)
        .where(eq(categoryRequests.userId, userId))
        .orderBy(desc(categoryRequests.createdAt))
    : await db.select().from(categoryRequests).orderBy(desc(categoryRequests.createdAt));
  if (rows.length === 0) return [];

  const userRows = await db.select().from(users);
  const userById = new Map(userRows.map((u) => [u.id, u]));
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: displayNameOf(userById.get(r.userId)),
    name: r.name,
    color: r.color,
    description: r.description,
    featureRequest: r.featureRequest,
    status: r.status as RequestStatus,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getCategoryRequest(id: string) {
  const db = await getDb();
  return (await db.select().from(categoryRequests).where(eq(categoryRequests.id, id)))[0];
}

/** 제안 접수 + 관리자에게 알림 (인앱 + 카톡). 알림 실패는 접수를 막지 않는다. */
export async function createCategoryRequest(input: {
  userId: string;
  userName: string;
  name: string;
  color: string;
  description: string;
  featureRequest?: string;
  origin: string;
}): Promise<string> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.insert(categoryRequests).values({
    id,
    userId: input.userId,
    name: input.name,
    color: input.color,
    description: input.description,
    featureRequest: input.featureRequest ?? null,
  });

  // 본인 제외 + users 행이 실제로 있는 관리자만.
  // 아직 로그인한 적 없는 ADMIN_KAKAO_ID가 섞여 있으면 FK 위반으로 전체 insert가 실패한다.
  const candidates = adminIds().filter((adminId) => adminId !== input.userId);
  const recipients =
    candidates.length > 0
      ? (await db.select({ id: users.id }).from(users).where(inArray(users.id, candidates))).map((u) => u.id)
      : [];
  if (recipients.length > 0) {
    const message = `💡 새 카테고리 제안: ${input.name} — ${input.userName}`;
    try {
      await db.insert(notifications).values(
        recipients.map((userId) => ({ id: crypto.randomUUID(), userId, postId: null, message }))
      );
      await sendKakaoMemos(recipients, message, `${input.origin}/admin`);
    } catch (e) {
      console.error('[category-request] admin notify failed:', e);
    }
  }
  return id;
}

/** 검토 결과 반영 + 제안자에게 알림 */
export async function reviewCategoryRequest(input: {
  id: string;
  status: RequestStatus;
  adminNote?: string;
  requesterId: string;
  requestName: string;
  origin: string;
}): Promise<void> {
  const db = await getDb();
  await db
    .update(categoryRequests)
    .set({ status: input.status, adminNote: input.adminNote ?? null })
    .where(eq(categoryRequests.id, input.id));

  const verdict = input.status === 'approved' ? '승인됐어요' : '반려됐어요';
  const message = `💡 제안한 카테고리 "${input.requestName}"이(가) ${verdict}.${
    input.adminNote ? ` — ${input.adminNote}` : ''
  }`;
  try {
    await db
      .insert(notifications)
      .values({ id: crypto.randomUUID(), userId: input.requesterId, postId: null, message });
    await sendKakaoMemos([input.requesterId], message, `${input.origin}/suggest`);
  } catch (e) {
    console.error('[category-request] requester notify failed:', e);
  }
}
