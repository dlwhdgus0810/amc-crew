import { desc, eq } from 'drizzle-orm';
import { getDb } from './index';
import { categoryRequests, notifications, users } from './schema';
import { resolveDisplayName } from '../store';
import { notifyAdmins } from './admin-notify';
import { sendPush } from '../push';
import { pick, toLocale } from '../i18n';

const N = {
  newRequest: { ko: '💡 새 카테고리 제안: {name} — {by}', en: '💡 New category suggestion: {name} — {by}', es: '💡 Nueva propuesta de categoría: {name} — {by}' },
  btnReview: { ko: '제안 검토하기', en: 'Review it', es: 'Revisarla' },
  approved: { ko: '승인됐어요', en: 'was approved', es: 'fue aprobada' },
  rejected: { ko: '반려됐어요', en: 'was declined', es: 'fue rechazada' },
  verdict: {
    ko: '💡 제안한 카테고리 "{name}"이(가) {verdict}.{note}',
    en: '💡 Your category suggestion “{name}” {verdict}.{note}',
    es: '💡 Tu propuesta de categoría «{name}» {verdict}.{note}',
  },
  note: { ko: ' — {text}', en: ' — {text}', es: ' — {text}' },
  btnMine: { ko: '내 제안 보기', en: 'View my suggestions', es: 'Ver mis propuestas' },
};

/** 수신자 언어 (users.locale, 없으면 기본) */
async function localeOf(userId: string) {
  const db = await getDb();
  const row = (await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId)))[0];
  return toLocale(row?.locale);
}

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

  await notifyAdmins({
    exclude: input.userId,
    message: (locale) => pick(locale, N.newRequest, { name: input.name, by: input.userName }),
    button: (locale) => pick(locale, N.btnReview),
    linkUrl: `${input.origin}/admin`,
    tag: 'category-request',
  });
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

  const locale = await localeOf(input.requesterId);
  const message = pick(locale, N.verdict, {
    name: input.requestName,
    verdict: pick(locale, input.status === 'approved' ? N.approved : N.rejected),
    note: input.adminNote ? pick(locale, N.note, { text: input.adminNote }) : '',
  });
  try {
    await db
      .insert(notifications)
      .values({ id: crypto.randomUUID(), userId: input.requesterId, postId: null, message });
    // 인앱만 남기면 앱을 열어보기 전까지 결과를 모른다 (예전에는 카톡이 그 역할을 했다)
    await sendPush([input.requesterId], {
      title: 'Kansas Korean',
      body: message,
      url: `${input.origin}/suggest`,
      tag: 'category-request',
    });
  } catch (e) {
    console.error('[category-request] requester notify failed:', e);
  }
}
