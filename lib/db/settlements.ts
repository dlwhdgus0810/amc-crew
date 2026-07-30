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
import { adminIds } from '../auth';
import { formatCents, splitWithExtras, venmoLink } from '../money';
import { sendKakaoMemos } from '../kakao';
import { sendPush } from '../push';
import { dateLabelShort, timeLabel } from '../datefmt';
import { DEFAULT_LOCALE, Locale, Msg, pick, toLocale } from '../i18n';

/** 한 항목을 누가 나눠 내는지 */
export type ItemScope = 'all' | 'some';

export interface SettlementItemInput {
  label: string;
  /** 총 금액 — 나누는 것은 읽을 때 한다 */
  amountCents: number;
  scope: ItemScope;
  /** scope='some'일 때만 쓴다 */
  memberIds: string[];
  /** 이 앱에 없는 사람 몇 명까지 같이 나눌지 */
  extraPeople: number;
}

export interface SettlementView {
  payee: { id: string; name: string; venmo: string | null; zelle: string | null };
  items: {
    id: string;
    label: string;
    amountCents: number;
    scope: ItemScope;
    memberIds: string[];
    extraPeople: number;
    /** 이 항목을 나눠 내는 총 머릿수 (참가자 + 외부 인원) */
    heads: number;
  }[];
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
  viaVenmo: { ko: 'Venmo로 보내기: {url}', en: 'Pay with Venmo: {url}' },
  viaZelle: { ko: 'Zelle: {handle}', en: 'Zelle: {handle}' },
  sentCopy: {
    ko: '💰 {cat} 정산을 보냈어요 — {n}명에게 총 {amount} · {when} · {place}',
    en: '💰 {cat} settle-up sent — {amount} requested from {n} people · {when} · {place}',
  },
  savedCopy: {
    ko: '💰 {cat} 정산을 저장했어요 — 앱에 없는 분들에게 받으시면 돼요 (총 {amount}) · {when} · {place}',
    en: '💰 {cat} settle-up saved — collect from the people outside the app ({amount} total) · {when} · {place}',
  },
  outsiderShare: {
    ko: '모임 밖 인원 1인당 {amount} — 아래를 그분들께 전달하세요',
    en: 'Each person outside the meetup owes {amount} — forward the details below',
  },
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
  items: { amountCents: number; scope: ItemScope; memberIds: string[]; extraPeople: number }[],
  participants: string[]
): Map<string, number> {
  const inMeetup = new Set(participants);
  const total = new Map<string, number>();
  for (const item of items) {
    const members = item.scope === 'all' ? participants : item.memberIds.filter((id) => inMeetup.has(id));
    for (const [userId, cents] of splitWithExtras(item.amountCents, members, item.extraPeople)) {
      total.set(userId, (total.get(userId) ?? 0) + cents);
    }
  }
  return total;
}

/**
 * 모임 밖 인원 한 명이 내야 할 금액.
 * 외부 인원이 걸린 항목만 더한다 — 항목마다 외부 인원을 다르게 넣었다면 그 항목들만 해당된다.
 */
function outsiderPerHead(items: { amountCents: number; extraPeople: number; heads: number }[]): number {
  return items.reduce(
    (sum, i) => (i.extraPeople > 0 && i.heads > 0 ? sum + Math.floor(i.amountCents / i.heads) : sum),
    0
  );
}

/** 이 항목을 나눠 내는 머릿수 — 화면에 "6명이 나눠요"로 보여준다 */
function headsOf(
  item: { scope: ItemScope; memberIds: string[]; extraPeople: number },
  participants: string[]
): number {
  const inMeetup = new Set(participants);
  const members = item.scope === 'all' ? participants : item.memberIds.filter((id) => inMeetup.has(id));
  return members.length + Math.max(0, item.extraPeople);
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

  const participants = await participantIds(postId);
  const items = itemRows.map((i) => {
    const base = {
      id: i.id,
      label: i.label,
      amountCents: i.amountCents,
      scope: (i.scope === 'some' ? 'some' : 'all') as ItemScope,
      memberIds: membersByItem.get(i.id) ?? [],
      extraPeople: i.extraPeople,
    };
    return { ...base, heads: headsOf(base, participants) };
  });

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
      zelle: payee?.zelle ?? null,
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
    extraPeople: Math.max(0, item.extraPeople),
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
  // 알릴 사람이 없어도 여기서 멈추지 않는다 — 관리자 사본은 그때도 나가야 한다
  const payeeIsAdmin = adminIds().includes(view.payee.id);
  if (targets.length === 0 && !payeeIsAdmin) return { sent: 0 };

  const localeRows = targets.length
    ? await db
        .select({ id: users.id, locale: users.locale })
        .from(users)
        .where(
          inArray(
            users.id,
            targets.map((t) => t.userId)
          )
        )
    : [];
  const localeById = new Map(localeRows.map((r) => [r.id, toLocale(r.locale)]));

  const cat = getCategory(post.category);
  const linkUrl = `${origin}/p/${postId}`;
  const rows: { id: string; userId: string; postId: string; message: string }[] = [];
  const messages = new Map<string, { message: string; locale: Locale }>();

  const note = `${catName(post.category, DEFAULT_LOCALE)} ${dateLabelShort(post.date, DEFAULT_LOCALE)}`;

  for (const target of targets) {
    const locale = localeById.get(target.userId) ?? 'ko';
    /*
     * 보낼 수단을 문구에 같이 실어, 알림에서 바로 열 수 있게 한다.
     * 카톡 버튼(link)이 아니라 본문에 넣는다 — 버튼 주소는 카카오에 등록된 도메인이어야 하고,
     * 등록되지 않은 주소는 조용히 다른 도메인으로 바뀐다.
     */
    const ways = [
      view.payee.venmo
        ? pick(locale, N.viaVenmo, { url: venmoLink(view.payee.venmo, target.cents, note) })
        : null,
      view.payee.zelle ? pick(locale, N.viaZelle, { handle: view.payee.zelle }) : null,
    ].filter(Boolean);

    const message = `${cat?.emoji ?? ''} ${pick(locale, N.ask as Msg, {
      cat: catName(post.category, locale),
      payee: view.payee.name,
      amount: formatCents(target.cents),
      when: `${dateLabelShort(post.date, locale)} ${timeLabel(post.startTime, locale)}`,
      place: post.location,
    })}${ways.length ? `\n${ways.join('\n')}` : ''}`.trim();
    rows.push({ id: crypto.randomUUID(), userId: target.userId, postId, message });
    messages.set(target.userId, { message, locale });
  }

  /*
   * 받을 사람이 관리자면 본인에게도 사본을 보낸다.
   * 다만 "나에게 보내주세요"를 스스로 받으면 말이 안 되므로, 내용은 요청 내역 요약이다.
   * 알림 경로가 살아 있는지 실제 기기에서 확인하는 용도이기도 하다.
   */
  if (payeeIsAdmin) {
    const locale = toLocale(
      (await db.select({ locale: users.locale }).from(users).where(eq(users.id, view.payee.id)))[0]?.locale
    );
    const asked = targets.reduce((n, t) => n + t.cents, 0);
    const when = `${dateLabelShort(post.date, locale)} ${timeLabel(post.startTime, locale)}`;
    // 아무에게도 청구하지 않는 정산(혼자 + 외부 인원)은 "보냈다"고 하면 거짓말이 된다
    const copy =
      targets.length > 0
        ? pick(locale, N.sentCopy, {
            cat: catName(post.category, locale),
            n: String(targets.length),
            amount: formatCents(asked),
            when,
            place: post.location,
          })
        : pick(locale, N.savedCopy, {
            cat: catName(post.category, locale),
            amount: formatCents(view.totalCents),
            when,
            place: post.location,
          });
    /*
     * 모임 밖 인원이 있으면 받을 수단을 함께 싣는다.
     * 남에게 청구하는 알림과 달리 이건 "전달용"이다 — 앱에 없는 사람에게는 알림을 보낼 방법이
     * 없으니, 받을 사람이 이 링크를 그대로 넘겨주면 된다.
     */
    const perOutsider = outsiderPerHead(view.items);
    const ways =
      perOutsider > 0
        ? [
            pick(locale, N.outsiderShare, { amount: formatCents(perOutsider) }),
            view.payee.venmo
              ? pick(locale, N.viaVenmo, { url: venmoLink(view.payee.venmo, perOutsider, note) })
              : null,
            view.payee.zelle ? pick(locale, N.viaZelle, { handle: view.payee.zelle }) : null,
          ].filter(Boolean)
        : [];

    const full = `${copy}${ways.length ? `\n${ways.join('\n')}` : ''}`;
    rows.push({ id: crypto.randomUUID(), userId: view.payee.id, postId, message: full });
    messages.set(view.payee.id, { message: full, locale });
  }

  if (rows.length > 0) await db.insert(notifications).values(rows);
  for (const [userId, { message, locale }] of messages) {
    await sendKakaoMemos([userId], message, linkUrl, pick(locale, N.btn));
    await sendPush([userId], { title: 'Kansas Korean', body: message, url: linkUrl, tag: `settle:${postId}` });
  }
  return { sent: targets.length };
}

/** 목록 화면(카드)에서 쓰는 요약 */
export interface SettlementSummary {
  /** 이 모임에 정산이 있는지 */
  exists: boolean;
  /** 보는 사람이 내야 할 금액 (없거나 0이면 null) */
  myCents: number | null;
  /** 보는 사람이 받는 사람인지 */
  iAmPayee: boolean;
}

/**
 * 여러 모임의 정산 요약을 한 번에.
 *
 * 카드마다 따로 조회하면 목록 길이만큼 쿼리가 늘어난다 — 모임 수와 무관하게 네 번만 돈다.
 */
export async function settlementSummaries(
  postIds: string[],
  viewerId?: string
): Promise<Map<string, SettlementSummary>> {
  const out = new Map<string, SettlementSummary>();
  if (postIds.length === 0) return out;

  const db = await getDb();
  const rows = await db.select().from(settlements).where(inArray(settlements.postId, postIds));
  if (rows.length === 0) return out;

  const byId = new Map(rows.map((r) => [r.id, r]));
  const itemRows = await db
    .select()
    .from(settlementItems)
    .where(
      inArray(
        settlementItems.settlementId,
        rows.map((r) => r.id)
      )
    );
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
  const partRows = await db
    .select()
    .from(postParticipants)
    .where(inArray(postParticipants.postId, postIds));

  const membersByItem = new Map<string, string[]>();
  for (const m of memberRows) {
    if (!membersByItem.has(m.itemId)) membersByItem.set(m.itemId, []);
    membersByItem.get(m.itemId)!.push(m.userId);
  }
  const participantsByPost = new Map<string, string[]>();
  for (const p of partRows) {
    if (!participantsByPost.has(p.postId)) participantsByPost.set(p.postId, []);
    participantsByPost.get(p.postId)!.push(p.userId);
  }
  const itemsBySettlement = new Map<string, typeof itemRows>();
  for (const i of itemRows) {
    if (!itemsBySettlement.has(i.settlementId)) itemsBySettlement.set(i.settlementId, []);
    itemsBySettlement.get(i.settlementId)!.push(i);
  }

  for (const [settlementId, row] of byId) {
    const items = (itemsBySettlement.get(settlementId) ?? []).map((i) => ({
      amountCents: i.amountCents,
      scope: (i.scope === 'some' ? 'some' : 'all') as ItemScope,
      memberIds: membersByItem.get(i.id) ?? [],
      extraPeople: i.extraPeople,
    }));
    const shares = computeShares(items, participantsByPost.get(row.postId) ?? []);
    const cents = viewerId ? (shares.get(viewerId) ?? 0) : 0;
    out.set(row.postId, {
      exists: true,
      myCents: cents > 0 ? cents : null,
      iAmPayee: viewerId === row.payeeId,
    });
  }
  return out;
}
