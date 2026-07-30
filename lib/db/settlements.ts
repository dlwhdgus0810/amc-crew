// 모임 정산 — 한 모임에 하나. 돈을 받을 사람이 항목을 적으면 각자 낼 금액이 계산되고 알림이 나간다.

import { and, asc, eq, inArray } from 'drizzle-orm';
import { getDb } from './index';
import {
  notifications,
  postParticipants,
  posts,
  settlementItemMembers,
  settlementItems,
  settlements,
  users,
} from './schema';
import { resolveDisplayName } from '../store';
import { catName, getCategory } from '../categories';
import { formatCents, splitCents } from '../money';
import { sendKakaoMemos } from '../kakao';
import { sendPush } from '../push';
import { dateLabelShort, timeLabel } from '../datefmt';
import { Locale, Msg, pick, toLocale } from '../i18n';

/** 한 항목을 누가 나눠 내는지 */
export type ItemScope = 'all' | 'some';

export interface SettlementItemInput {
  label: string;
  amountCents: number;
  scope: ItemScope;
  /** scope='some'일 때만 쓴다 */
  memberIds: string[];
}

export interface SettlementView {
  payee: { id: string; name: string; venmo: string | null };
  items: { id: string; label: string; amountCents: number; scope: ItemScope; memberIds: string[] }[];
  /** 사람별로 내야 할 금액 (0원인 사람은 빠진다). 받을 사람 본인도 자기 몫이 있으면 들어간다 */
  shares: { userId: string; name: string; avatar: string | null; cents: number }[];
  totalCents: number;
  createdAt: string;
}

const N = {
  ask: {
    ko: '💰 {cat} 정산 — {payee}님에게 {amount} 보내주세요 · {when} · {place}',
    en: '💰 {cat} settle-up — send {amount} to {payee} · {when} · {place}',
  },
  btn: { ko: '정산 보기', en: 'See the split' },
};

function displayNameOf(row: { kakaoName: string; nickname: string | null } | undefined, fallback: string): string {
  if (!row) return fallback;
  return resolveDisplayName(
    { kakaoName: row.kakaoName, ...(row.nickname ? { nickname: row.nickname } : {}), kakaoNameHistory: [] },
    fallback
  );
}

async function participantIds(postId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ userId: postParticipants.userId })
    .from(postParticipants)
    .where(eq(postParticipants.postId, postId));
  return rows.map((r) => r.userId);
}

/**
 * 항목별로 나눈 뒤 사람별로 합친다.
 *
 * scope='some'인 항목의 대상자 중 모임을 나간 사람은 뺀다 — 남겨두면 목록에도 없는
 * 사람에게 금액이 잡혀 합계가 안 맞는 것처럼 보인다.
 */
function computeShares(
  items: { amountCents: number; scope: ItemScope; memberIds: string[] }[],
  participants: string[]
): Map<string, number> {
  const inMeetup = new Set(participants);
  const total = new Map<string, number>();
  for (const item of items) {
    const members = item.scope === 'all' ? participants : item.memberIds.filter((id) => inMeetup.has(id));
    for (const [userId, cents] of splitCents(item.amountCents, members)) {
      total.set(userId, (total.get(userId) ?? 0) + cents);
    }
  }
  return total;
}

/** 모임의 정산 (없으면 null) */
export async function getSettlement(postId: string): Promise<SettlementView | null> {
  const db = await getDb();
  const [row] = await db.select().from(settlements).where(eq(settlements.postId, postId));
  if (!row) return null;

  const itemRows = await db
    .select()
    .from(settlementItems)
    .where(eq(settlementItems.settlementId, row.id))
    .orderBy(asc(settlementItems.sort));
  const memberRows = itemRows.length
    ? await db
        .select()
        .from(settlementItemMembers)
        .where(
          inArray(
            settlementItemMembers.itemId,
            itemRows.map((i) => i.id)
          )
        )
    : [];
  const membersByItem = new Map<string, string[]>();
  for (const m of memberRows) {
    if (!membersByItem.has(m.itemId)) membersByItem.set(m.itemId, []);
    membersByItem.get(m.itemId)!.push(m.userId);
  }

  const items = itemRows.map((i) => ({
    id: i.id,
    label: i.label,
    amountCents: i.amountCents,
    scope: (i.scope === 'some' ? 'some' : 'all') as ItemScope,
    memberIds: membersByItem.get(i.id) ?? [],
  }));

  const participants = await participantIds(postId);
  const shareMap = computeShares(items, participants);
  const userRows = await db.select().from(users);
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const shares = [...shareMap]
    .filter(([, cents]) => cents > 0)
    .map(([userId, cents]) => ({
      userId,
      name: displayNameOf(userById.get(userId), '알 수 없음'),
      avatar: userById.get(userId)?.avatar ?? null,
      cents,
    }))
    .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));

  const payee = userById.get(row.payeeId);
  return {
    payee: {
      id: row.payeeId,
      name: displayNameOf(payee, '알 수 없음'),
      venmo: payee?.venmo ?? null,
    },
    items,
    shares,
    totalCents: items.reduce((n, i) => n + i.amountCents, 0),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 정산을 저장한다 (있으면 통째로 갈아끼운다).
 * 항목을 지웠다 다시 넣는 편이 부분 수정보다 단순하고, 규모가 작아 비용도 무시할 만하다.
 */
export async function saveSettlement(input: {
  postId: string;
  payeeId: string;
  items: SettlementItemInput[];
}): Promise<void> {
  const db = await getDb();
  const [existing] = await db.select().from(settlements).where(eq(settlements.postId, input.postId));

  const settlementId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    // 항목은 cascade로 함께 지워진다
    await db.delete(settlementItems).where(eq(settlementItems.settlementId, settlementId));
    await db.update(settlements).set({ payeeId: input.payeeId }).where(eq(settlements.id, settlementId));
  } else {
    await db.insert(settlements).values({ id: settlementId, postId: input.postId, payeeId: input.payeeId });
  }

  const itemRows = input.items.map((item, i) => ({
    id: crypto.randomUUID(),
    settlementId,
    label: item.label,
    amountCents: item.amountCents,
    scope: item.scope,
    sort: i,
  }));
  if (itemRows.length > 0) {
    await db.insert(settlementItems).values(itemRows);
    const memberRows = itemRows.flatMap((row, i) =>
      input.items[i].scope === 'some'
        ? [...new Set(input.items[i].memberIds)].map((userId) => ({ itemId: row.id, userId }))
        : []
    );
    if (memberRows.length > 0) await db.insert(settlementItemMembers).values(memberRows);
  }
}

export async function deleteSettlement(postId: string): Promise<void> {
  const db = await getDb();
  await db.delete(settlements).where(eq(settlements.postId, postId));
}

/** 정산을 만든 사람 (수정·삭제 권한 확인용) */
export async function settlementPayee(postId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db.select({ payeeId: settlements.payeeId }).from(settlements).where(eq(settlements.postId, postId));
  return row?.payeeId ?? null;
}

/**
 * 각자에게 "얼마 보내주세요" 알림.
 *
 * 금액이 사람마다 달라 문구를 한 번에 만들 수 없다 — 다른 알림들과 달리 사람 단위로 돈다.
 * 받을 사람 본인에게는 보내지 않는다.
 */
export async function notifySettlement(postId: string, origin: string): Promise<{ sent: number }> {
  const view = await getSettlement(postId);
  if (!view) return { sent: 0 };

  const db = await getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) return { sent: 0 };

  const targets = view.shares.filter((s) => s.userId !== view.payee.id);
  if (targets.length === 0) return { sent: 0 };

  const localeRows = await db
    .select({ id: users.id, locale: users.locale })
    .from(users)
    .where(
      inArray(
        users.id,
        targets.map((t) => t.userId)
      )
    );
  const localeById = new Map(localeRows.map((r) => [r.id, toLocale(r.locale)]));

  const cat = getCategory(post.category);
  const linkUrl = `${origin}/p/${postId}`;
  const rows: { id: string; userId: string; postId: string; message: string }[] = [];
  const messages = new Map<string, { message: string; locale: Locale }>();

  for (const target of targets) {
    const locale = localeById.get(target.userId) ?? 'ko';
    const message = `${cat?.emoji ?? ''} ${pick(locale, N.ask as Msg, {
      cat: catName(post.category, locale),
      payee: view.payee.name,
      amount: formatCents(target.cents),
      when: `${dateLabelShort(post.date, locale)} ${timeLabel(post.startTime, locale)}`,
      place: post.location,
    })}`.trim();
    rows.push({ id: crypto.randomUUID(), userId: target.userId, postId, message });
    messages.set(target.userId, { message, locale });
  }

  await db.insert(notifications).values(rows);
  for (const [userId, { message, locale }] of messages) {
    await sendKakaoMemos([userId], message, linkUrl, pick(locale, N.btn));
    await sendPush([userId], { title: 'Kansas Korean', body: message, url: linkUrl, tag: `settle:${postId}` });
  }
  return { sent: targets.length };
}
