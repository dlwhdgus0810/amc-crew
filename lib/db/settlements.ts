// 모임 정산 — 한 모임에 하나. 돈을 받을 사람이 항목을 적으면 각자 낼 금액이 계산되고 알림이 나간다.

import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { getDb } from './index';
import { regionOfRow } from '../region';
import { appName, siteUrl } from '../site';
import {
  notifications,
  postParticipants,
  posts,
  settlementItemMembers,
  settlementItems,
  settlements,
  settlementMembers,
  settlementPaid,
  users,
} from './schema';
import { localName, NameRow, nameOf, UNKNOWN_NAME } from '../store';
import { getLocale } from '../locale';
import { catName, getCategory } from '../categories';
import { adminIds } from '../auth';
import { formatCents, payNote, shortCode, splitWithExtras, venmoLink } from '../money';
import { sendPush } from '../push';
import { dateLabelShort, timeLabel, whenLabelShort } from '../datefmt';
import { DEFAULT_LOCALE, Locale, Msg, pick, toLocale } from '../i18n';
import { NOTIF } from '../notif-kinds';

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
  /** 이 정산 하나를 가리키는 값 — 고치기·지우기·알림이 다 이걸로 간다 */
  id: string;
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
  shares: {
    userId: string;
    name: string;
    avatar: string | null;
    cents: number;
    /**
     * 「보냈다」 표시. 아직 없으면 null.
     *
     * byPayee는 **받을 사람이 확인해 준 것**이라는 뜻이다. 낸 사람이 스스로 누른 것과
     * 구분해서 보여 준다 — 벤모는 바로 꽂히지만 현금이나 Zelle은 며칠 걸리기도 해서,
     * 받은 사람이 확인한 줄만 진짜 끝난 것이다.
     */
    paid: { at: string; byPayee: boolean } | null;
  }[];
  totalCents: number;
  /** 모임에 없지만 이 정산에 넣은 사람들 (내 친구) — 낼 금액이 0이어도 목록에 남아야 한다 */
  extraMembers: { id: string; name: string }[];
  /** 앱 밖 사람에게 전달할 짧은 링크의 코드 (/v/<code>) */
  shortCode: string | null;
  createdAt: string;
}

const N = {
  ask: {
    ko: '💰 {cat} 정산 — {payee}님에게 {amount} 보내주세요 · {when} · {place}',
    en: '💰 {cat} settle-up — send {amount} to {payee} · {when} · {place}',
    es: '💰 Cuentas de {cat}: envía {amount} a {payee} · {when} · {place}',
  },
  btn: { ko: '정산 보기', en: 'See the split', es: 'Ver el reparto' },
  viaVenmo: { ko: 'Venmo: {handle}', en: 'Venmo: {handle}', es: 'Venmo: {handle}' },
  /*
   * 외부인 전달용에만 주소를 붙인다. 이 사람들은 앱에 없어서 모임 화면을 열 수 없고,
   * 그래서 금액이 채워진 링크가 여기 말고는 갈 곳이 없다.
   */
  viaVenmoLink: { ko: 'Venmo로 보내기: {url}', en: 'Pay with Venmo: {url}', es: 'Pagar con Venmo: {url}' },
  viaZelle: { ko: 'Zelle: {handle}', en: 'Zelle: {handle}', es: 'Zelle: {handle}' },
  sentCopy: {
    ko: '💰 {cat} 정산을 보냈어요 — {n}명에게 총 {amount} · {when} · {place}',
    en: '💰 {cat} settle-up sent — {amount} requested from {n} people · {when} · {place}',
    es: '💰 Cuentas de {cat} enviadas: {amount} pedidos a {n} personas · {when} · {place}',
  },
  savedCopy: {
    ko: '💰 {cat} 정산을 저장했어요 — 앱에 없는 분들에게 받으시면 돼요 (총 {amount}) · {when} · {place}',
    en: '💰 {cat} settle-up saved — collect from the people outside the app ({amount} total) · {when} · {place}',
    es: '💰 Cuentas de {cat} guardadas: cóbralo a la gente de fuera de la app ({amount} en total) · {when} · {place}',
  },
  outsiderShare: {
    ko: '모임 밖 인원 1인당 {amount} — 아래를 그분들께 전달하세요',
    en: 'Each person outside the meetup owes {amount} — forward the details below',
    es: 'Cada persona de fuera debe {amount}: reenvíales los datos de abajo',
  },
};

function displayNameOf(row: NameRow | undefined, fallback: string, locale: Locale = DEFAULT_LOCALE): string {
  return nameOf(row, fallback, locale);
}

/**
 * 이 정산에서 돈을 나눠 낼 사람들 = 모임 참가자 + 정산에만 넣은 사람.
 *
 * "전원이 나눠요"의 전원이 이 명단이다. 넣어 놓고 전원 계산에서 빠지면
 * 왜 넣었는지 알 수 없게 된다.
 */
async function payerIds(postId: string, extras: string[]): Promise<string[]> {
  const inMeetup = await participantIds(postId);
  const seen = new Set(inMeetup);
  return [...inMeetup, ...extras.filter((id) => !seen.has(id))];
}

/** 이 정산을 볼 수 있는 사람 (참가자 + 정산에 들어간 사람). 라우트의 접근 확인에 쓴다 */
export async function settlementViewers(postId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: settlements.id })
    .from(settlements)
    .where(and(eq(settlements.postId, postId), isNull(settlements.deletedAt)));
  if (rows.length === 0) return payerIds(postId, []);
  /*
   * 정산이 여러 개면 **전부의 extras를 합친다.** 셋 중 하나에만 들어간 사람도 이 모임의
   * 정산 화면을 열 수 있어야 한다 — 자기가 낼 돈이 거기 있다.
   */
  const memberRows = await db
    .select({ userId: settlementMembers.userId })
    .from(settlementMembers)
    .where(inArray(settlementMembers.settlementId, rows.map((r) => r.id)));
  return payerIds(postId, [...new Set(memberRows.map((m) => m.userId))]);
}

async function extraMemberIds(settlementId: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ userId: settlementMembers.userId })
    .from(settlementMembers)
    .where(eq(settlementMembers.settlementId, settlementId));
  return rows.map((r) => r.userId);
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

/**
 * 모임의 정산들 — 만든 순서대로. 없으면 빈 배열.
 *
 * 한 모임에 여러 개다 (schema.ts의 settlements). 여행에서 한 사람이 여러 번 결제하고
 * 결제마다 나눠 내는 사람이 다르기 때문이다 — 숙소는 다섯 명, 렌터카는 셋.
 *
 * **개수와 무관하게 질의는 여섯 번이다.** 정산마다 따로 읽으면 세 개짜리 모임에서
 * 열여덟 번을 돈다 (neon-http는 왕복 하나가 곧 지연이다).
 */
export async function getSettlements(postId: string): Promise<SettlementView[]> {
  const locale = await getLocale();
  const db = await getDb();
  const rows = await db
    .select()
    .from(settlements)
    .where(and(eq(settlements.postId, postId), isNull(settlements.deletedAt)))
    .orderBy(asc(settlements.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const itemRows = await db
    .select()
    .from(settlementItems)
    .where(inArray(settlementItems.settlementId, ids))
    .orderBy(asc(settlementItems.sort));
  const memberRows = itemRows.length
    ? await db
        .select()
        .from(settlementItemMembers)
        .where(inArray(settlementItemMembers.itemId, itemRows.map((i) => i.id)))
    : [];
  const extraRows = await db
    .select()
    .from(settlementMembers)
    .where(inArray(settlementMembers.settlementId, ids));
  const userRows = await db.select().from(users);
  const inMeetup = await participantIds(postId);

  const membersByItem = new Map<string, string[]>();
  for (const m of memberRows) {
    if (!membersByItem.has(m.itemId)) membersByItem.set(m.itemId, []);
    membersByItem.get(m.itemId)!.push(m.userId);
  }
  const itemsBySettlement = new Map<string, typeof itemRows>();
  for (const i of itemRows) {
    if (!itemsBySettlement.has(i.settlementId)) itemsBySettlement.set(i.settlementId, []);
    itemsBySettlement.get(i.settlementId)!.push(i);
  }
  const extrasBySettlement = new Map<string, string[]>();
  for (const e of extraRows) {
    if (!extrasBySettlement.has(e.settlementId)) extrasBySettlement.set(e.settlementId, []);
    extrasBySettlement.get(e.settlementId)!.push(e.userId);
  }
  const userById = new Map(userRows.map((u) => [u.id, u]));

  /*
   * 「보냈다」 표시를 정산 전부에 대해 한 번에 읽는다 — 정산마다 부르면 한 모임에
   * 정산이 여섯 개일 때 질의가 여섯 번이 된다 (여행이 실제로 그렇다).
   */
  const paidRows = await db
    .select()
    .from(settlementPaid)
    .where(inArray(settlementPaid.settlementId, ids));
  const paidBy = new Map<string, Map<string, (typeof paidRows)[number]>>();
  for (const r of paidRows) {
    if (!paidBy.has(r.settlementId)) paidBy.set(r.settlementId, new Map());
    paidBy.get(r.settlementId)!.set(r.userId, r);
  }

  return rows.map((row) => {
    /*
     * 나눠 낼 사람은 **정산마다 다르다** — 참가자 전원 + 이 정산에만 넣은 사람.
     * 그래서 heads도 shares도 정산 안에서 계산한다.
     */
    const extras = extrasBySettlement.get(row.id) ?? [];
    const seen = new Set(inMeetup);
    const participants = [...inMeetup, ...extras.filter((id) => !seen.has(id))];

    const items = (itemsBySettlement.get(row.id) ?? []).map((i) => {
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

    const shares = [...computeShares(items, participants)]
      .filter(([, cents]) => cents > 0)
      .map(([userId, cents]) => {
        const mark = paidBy.get(row.id)?.get(userId);
        return {
          userId,
          name: displayNameOf(userById.get(userId), UNKNOWN_NAME, locale),
          avatar: userById.get(userId)?.avatar ?? null,
          cents,
          paid: mark ? { at: mark.markedAt.toISOString(), byPayee: mark.markedBy === row.payeeId } : null,
        };
      })
      .sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name));

    const payee = userById.get(row.payeeId);
    return {
      id: row.id,
      payee: {
        id: row.payeeId,
        name: displayNameOf(payee, UNKNOWN_NAME, locale),
        venmo: payee?.venmo ?? null,
        zelle: payee?.zelle ?? null,
      },
      items,
      shares,
      totalCents: items.reduce((n, i) => n + i.amountCents, 0),
      extraMembers: extras.map((id) => ({ id, name: displayNameOf(userById.get(id), UNKNOWN_NAME, locale) })),
      shortCode: row.shortCode ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  });
}

/** 정산 하나 — 없으면 null (알림·짧은 링크가 쓴다) */
export async function getSettlementById(settlementId: string): Promise<SettlementView | null> {
  const db = await getDb();
  const [row] = await db
    .select({ postId: settlements.postId })
    .from(settlements)
    .where(and(eq(settlements.id, settlementId), isNull(settlements.deletedAt)));
  if (!row) return null;
  return (await getSettlements(row.postId)).find((v) => v.id === settlementId) ?? null;
}

/**
 * 정산을 저장한다 — **settlementId를 주면 그것을 고치고, 안 주면 새로 만든다.**
 *
 * 예전에는 postId로 찾아 하나를 갈아끼웠다. 한 모임에 정산이 하나였기 때문인데,
 * 이제 여러 개라 「어느 정산인지」를 부르는 쪽이 말해 줘야 한다.
 *
 * 항목은 통째로 갈아끼운다 — 부분 수정보다 단순하고 규모가 작아 비용도 무시할 만하다.
 */
export async function saveSettlement(input: {
  postId: string;
  /** 있으면 그 정산을 고친다. 없으면 새 정산이다 */
  settlementId?: string;
  payeeId: string;
  items: SettlementItemInput[];
  /** 모임에 없지만 정산에 넣을 사람 (라우트에서 이미 "내 친구"로 걸러 온다) */
  extraMemberIds?: string[];
}): Promise<string> {
  const db = await getDb();
  /*
   * 고치는 경우에는 **그 정산이 이 모임 것인지** 확인한다. 부르는 쪽(라우트)도 보지만,
   * 여기서 한 번 더 보는 이유는 postId가 항목 계산의 기준이라서다 — 남의 모임 정산을
   * 이 모임 참가자로 다시 계산해 버리면 금액이 조용히 틀어진다.
   */
  const existing = input.settlementId
    ? (await db
        .select()
        .from(settlements)
        .where(and(eq(settlements.id, input.settlementId), eq(settlements.postId, input.postId))))[0]
    : undefined;
  if (input.settlementId && !existing) throw new Error('settlement not found');

  const settlementId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    // 항목은 cascade로 함께 지워진다
    await db.delete(settlementItems).where(eq(settlementItems.settlementId, settlementId));
    await db
      .update(settlements)
      // 예전에 만든 정산은 코드가 없다 — 저장할 때 채운다
      // deletedAt: null — 지웠던 정산을 다시 저장하면 되살아난다
      .set({ payeeId: input.payeeId, deletedAt: null, ...(existing.shortCode ? {} : { shortCode: shortCode() }) })
      .where(eq(settlements.id, settlementId));
  } else {
    await db.insert(settlements).values({
      id: settlementId,
      postId: input.postId,
      payeeId: input.payeeId,
      shortCode: shortCode(),
    });
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

  // 항목과 마찬가지로 통째로 갈아끼운다 (뺀 사람이 남아 있으면 계속 청구된다)
  await db.delete(settlementMembers).where(eq(settlementMembers.settlementId, settlementId));
  const extras = [...new Set(input.extraMemberIds ?? [])];
  if (extras.length > 0) {
    await db.insert(settlementMembers).values(extras.map((userId) => ({ settlementId, userId })));
  }
  return settlementId;
}

/**
 * 정산 하나 지우기 — 표시만 한다. 항목·명단은 그대로 붙어 있다.
 *
 * 정산이 여러 개라 **id로 지운다.** 예전에는 postId로 지웠는데, 그러면 모임의 정산이
 * 통째로 사라진다 — 남의 정산까지.
 */
export async function deleteSettlement(settlementId: string): Promise<void> {
  const db = await getDb();
  await db.update(settlements).set({ deletedAt: new Date() }).where(eq(settlements.id, settlementId));
}

/**
 * 그 정산을 받을 사람과 어느 모임 것인지 (수정·삭제 권한 확인용).
 *
 * 모임까지 함께 돌려주는 이유: 라우트는 주소의 모임 id와 본문의 정산 id를 둘 다 받는데,
 * 둘이 안 맞는 요청을 걸러야 한다 — 안 걸르면 남의 모임 정산을 고칠 수 있다.
 */
export async function settlementOwner(
  settlementId: string
): Promise<{ payeeId: string; postId: string } | null> {
  const db = await getDb();
  const [row] = await db
    .select({ payeeId: settlements.payeeId, postId: settlements.postId })
    .from(settlements)
    .where(and(eq(settlements.id, settlementId), isNull(settlements.deletedAt)));
  return row ?? null;
}

/**
 * 각자에게 "얼마 보내주세요" 알림.
 *
 * 금액이 사람마다 달라 문구를 한 번에 만들 수 없다 — 다른 알림들과 달리 사람 단위로 돈다.
 * 받을 사람 본인에게는 보내지 않는다.
 */
/**
 * 정산 알림.
 *
 * onlyUserIds를 주면 그 사람들에게만 다시 보낸다 — 「다시 알리기」다. 문구를 만드는 자리는
 * 하나뿐이어야 한다. 재발송용 함수를 따로 두면 금액 표시나 보낼 수단이 바뀔 때 한쪽만
 * 고치게 되고, 그건 받는 사람에게 서로 다른 두 문구가 도착한다는 뜻이다.
 */
export async function notifySettlement(
  /** 어느 정산인지 — 모임에 여러 개라 정산 단위로 알린다 */
  settlementId: string,
  /** 공개 주소를 못 정했을 때 쓸 요청 주소 — 링크는 그 모임의 지역 주소로 만든다 */
  originFallback: string,
  onlyUserIds?: string[]
): Promise<{ sent: number }> {
  const view = await getSettlementById(settlementId);
  if (!view) return { sent: 0 };

  const db = await getDb();
  const [owner] = await db
    .select({ postId: settlements.postId })
    .from(settlements)
    .where(eq(settlements.id, settlementId));
  if (!owner) return { sent: 0 };
  const postId = owner.postId;
  const [post] = await db.select().from(posts).where(and(eq(posts.id, postId), isNull(posts.deletedAt)));
  if (!post) return { sent: 0 };
  // 정산은 모임에 딸린다 — 그 모임의 지역 이름과 주소로 나간다
  const region = regionOfRow(post.region);
  const origin = siteUrl(region, originFallback);

  /*
   * 받을 사람 이름은 여기서 다시 짓는다.
   *
   * view.payee.name은 이 요청을 낸 사람(정산을 저장하거나 다시 보내기를 누른 호스트)의
   * 언어로 이미 정해져 있다. 그 이름이 그대로 실려 나가면, 영어로 보는 사람에게도
   * 호스트 화면에서 보이던 한글 이름이 간다 — 문구는 영어인데 이름만 한글인 줄이 된다.
   */
  const [payeeRow] = await db
    .select({ kakaoName: users.kakaoName, nickname: users.nickname, nameEn: users.nameEn })
    .from(users)
    .where(eq(users.id, view.payee.id));
  const payeeName = localName(payeeRow, view.payee.name);

  // 다시 보내는 것이면 받을 사람 사본은 안 나간다 — 처음 저장했을 때 이미 받았다
  const reminder = onlyUserIds !== undefined;
  const pick_ = reminder ? new Set(onlyUserIds) : null;
  const targets = view.shares.filter(
    (s) => s.userId !== view.payee.id && (!pick_ || pick_.has(s.userId))
  );
  // 알릴 사람이 없어도 여기서 멈추지 않는다 — 관리자 사본은 그때도 나가야 한다
  const payeeIsAdmin = !reminder && adminIds().includes(view.payee.id);
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
  // 정산 알림은 모임 화면의 정산 카드로 바로 보낸다 (app/settlement-panel.tsx의 #settle)
  const linkUrl = `${origin}/p/${postId}#settle`;
  const rows: {
    id: string;
    userId: string;
    postId: string;
    settlementId: string;
    kind: string;
    message: string;
  }[] = [];
  // 인앱·푸시는 plain, 카톡만 kakao (받을 계좌가 붙은 판)
  const messages = new Map<string, { plain: string; kakao: string; locale: Locale }>();

  /*
   * 이 메모는 「코드가 없는 옛 정산」에 쓰는 긴 Venmo 주소에만 들어간다 (아래 viaVenmoLink).
   * 앱 밖 인원용이라 그 사람이 걸린 항목만, 그 사람 몫으로 적는다 — /v/<code>와 같은 규칙이다.
   */
  const note = payNote(
    `${catName(post.category, DEFAULT_LOCALE)} ${whenLabelShort(post.date, post.startTime, DEFAULT_LOCALE)}`,
    view.items
      .filter((i) => i.extraPeople > 0 && i.heads > 0)
      .map((i) => ({ label: i.label, cents: Math.floor(i.amountCents / i.heads) }))
  );

  for (const target of targets) {
    const locale = localeById.get(target.userId) ?? 'ko';
    /*
     * 보낼 수단은 아이디만 적는다.
     * 알림을 눌러 모임에 들어가면 거기 금액이 채워진 Venmo 링크가 있으므로,
     * 여기에 긴 주소를 또 붙이면 문구만 길어진다.
     */
    const ways = [
      view.payee.venmo ? pick(locale, N.viaVenmo, { handle: view.payee.venmo }) : null,
      view.payee.zelle ? pick(locale, N.viaZelle, { handle: view.payee.zelle }) : null,
    ].filter(Boolean);

    const plain = `${cat?.emoji ?? ''} ${pick(locale, N.ask as Msg, {
      cat: catName(post.category, locale),
      payee: payeeName(locale),
      amount: formatCents(target.cents),
      when: whenLabelShort(post.date, post.startTime, locale),
      place: post.location,
    })}`.trim();
    /*
     * 받을 계좌는 카톡 본문에만 싣는다.
     * 인앱 알림과 푸시는 눌러서 정산 카드로 가고 거기에 보내기 수단이 이미 있다 —
     * 목록에 계좌가 늘어져 있으면 정작 읽어야 할 금액이 묻힌다.
     */
    rows.push({ id: crypto.randomUUID(), userId: target.userId, postId, settlementId, kind: 'settle', message: plain });
    messages.set(target.userId, {
      plain,
      kakao: ways.length ? `${plain}\n${ways.join('\n')}` : plain,
      locale,
    });
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
    const when = whenLabelShort(post.date, post.startTime, locale);
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
              ? pick(locale, N.viaVenmoLink, {
                  // 코드가 없는 옛 정산은 원래의 긴 주소로 (링크가 없는 것보다 낫다)
                  url: view.shortCode
                    ? `${origin}/v/${view.shortCode}`
                    : venmoLink(view.payee.venmo, perOutsider, note),
                })
              : null,
            view.payee.zelle ? pick(locale, N.viaZelle, { handle: view.payee.zelle }) : null,
          ].filter(Boolean)
        : [];

    rows.push({ id: crypto.randomUUID(), userId: view.payee.id, postId, settlementId, kind: 'settle', message: copy });
    messages.set(view.payee.id, {
      plain: copy,
      kakao: ways.length ? `${copy}\n${ways.join('\n')}` : copy,
      locale,
    });
  }

  if (rows.length > 0) await db.insert(notifications).values(rows);
  for (const [userId, { plain, kakao, locale }] of messages) {
    await sendPush([userId], { title: appName(region), body: plain, url: linkUrl, tag: `settle:${settlementId}` });
  }
  return { sent: targets.length };
}

/**
 * 이 정산으로 누구에게 언제 마지막으로 알렸는지.
 *
 * **정산 단위로 센다.** 모임 단위로 세면 같은 모임의 다른 정산에서 보낸 알림까지 섞여서,
 * 아직 안 알린 사람에게도 「방금 보냈다」고 나온다 (schema.ts의 notifications.settlementId).
 *
 * 새 칸을 두지 않고 알림 기록에서 뽑는다 — 알림을 보냈다는 사실은 이미 notifications에
 * 남아 있고, 같은 것을 두 곳에 적어 두면 언젠가 서로 어긋난다.
 *
 * 「다시 알리기」 화면이 사람마다 이 시각을 보여준다. 하루에 세 번 찌르는 일을 막는 건
 * 규칙이 아니라 이 한 줄이다 — 방금 보냈다는 게 보이면 대개 안 누른다.
 */
export async function settlementNotifiedAt(settlementId: string): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db
    .select({ userId: notifications.userId, at: notifications.createdAt })
    .from(notifications)
    .where(and(eq(notifications.settlementId, settlementId), eq(notifications.kind, NOTIF.settle)))
    .orderBy(desc(notifications.createdAt));

  const out: Record<string, string> = {};
  // 최신순이라 처음 만난 것이 곧 마지막으로 보낸 것이다
  for (const r of rows) if (!out[r.userId]) out[r.userId] = r.at.toISOString();
  return out;
}

/** 목록 화면(카드)에서 쓰는 요약 */
export interface SettlementSummary {
  /** 이 모임에 정산이 있는지 */
  exists: boolean;
  /**
   * 이 모임 정산이 몇 개인지. 하나면 1이다.
   *
   * 카드에 개수를 적는 이유: 「정산하기」만 있으면 세 개짜리 모임에서 하나만 보고 나간다.
   */
  count: number;
  /**
   * 보는 사람이 내야 할 금액 — **정산 전부를 합한 값**이다 (없거나 0이면 null).
   *
   * 정산마다 따로 보여주지 않는 이유: 카드에서 궁금한 것은 「이 모임에서 내가 내야 할
   * 돈이 얼마인가」 하나다. 누구에게 얼마씩인지는 모임 화면에서 갈라 보여준다.
   */
  myCents: number | null;
  /** 보는 사람이 **하나라도** 받을 사람인지 */
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
  const rows = await db
    .select()
    .from(settlements)
    .where(and(inArray(settlements.postId, postIds), isNull(settlements.deletedAt)));
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

  /*
   * 한 모임에 정산이 여러 개다 — **모임 단위로 합친다.**
   *
   * 예전에는 정산마다 out.set(postId, ...)을 해서 마지막 것만 남았다. 그러면 카드가
   * 세 정산 중 하나의 금액만 보여주고, 나머지는 조용히 사라진다.
   *
   * 정산에만 들어간 사람(extras)은 여기서 안 읽는다. 카드 요약은 목록을 그리는 자리라
   * 질의를 늘리지 않는 쪽을 골랐다 — 그 사람 카드에는 금액이 안 잡히지만, 모임 화면을
   * 열면 정확한 금액이 보인다. (모임 목록은 참가한 모임만 보여주므로 대개 참가자다)
   */
  for (const [settlementId, row] of byId) {
    const items = (itemsBySettlement.get(settlementId) ?? []).map((i) => ({
      amountCents: i.amountCents,
      scope: (i.scope === 'some' ? 'some' : 'all') as ItemScope,
      memberIds: membersByItem.get(i.id) ?? [],
      extraPeople: i.extraPeople,
    }));
    const shares = computeShares(items, participantsByPost.get(row.postId) ?? []);
    const cents = viewerId ? (shares.get(viewerId) ?? 0) : 0;

    const prev = out.get(row.postId);
    const mine = (prev?.myCents ?? 0) + cents;
    out.set(row.postId, {
      exists: true,
      count: (prev?.count ?? 0) + 1,
      myCents: mine > 0 ? mine : null,
      iAmPayee: (prev?.iAmPayee ?? false) || viewerId === row.payeeId,
    });
  }
  return out;
}

/**
 * 「보냈다」 표시를 켜고 끈다.
 *
 * 누를 수 있는 사람은 둘뿐이다 — **낸 본인**과 **받을 사람**. 본인이 누르는 것은
 * 「보냈어요」이고 받을 사람이 누르는 것은 「받았어요」인데, 표시는 하나만 두고
 * marked_by로 구분한다 (schema.ts의 settlementPaid).
 *
 * 남이 남의 줄을 켜지 못하게 하는 것이 이 함수의 핵심이다. 열 명이 나눠 내는 정산에서
 * 아무나 남의 줄을 체크할 수 있으면 「누가 안 냈나」가 그 순간 못 믿을 값이 된다.
 *
 * 그 정산에 낼 금액이 있는 사람인지도 본다. 금액이 0인 사람에게 표시가 붙으면
 * 화면에는 안 보이는 줄이 DB에만 남는다.
 */
export async function setSettlementPaid(
  settlementId: string,
  userId: string,
  paid: boolean,
  by: string
): Promise<{ ok: boolean; reason?: 'not-found' | 'forbidden' | 'no-share' }> {
  const db = await getDb();
  const [row] = await db
    .select({ id: settlements.id, payeeId: settlements.payeeId, postId: settlements.postId })
    .from(settlements)
    .where(and(eq(settlements.id, settlementId), isNull(settlements.deletedAt)));
  if (!row) return { ok: false, reason: 'not-found' };

  // 본인 줄이거나, 내가 받을 정산이거나
  if (by !== userId && by !== row.payeeId) return { ok: false, reason: 'forbidden' };

  const view = await getSettlementById(settlementId);
  const share = view?.shares.find((s) => s.userId === userId);
  // 받을 사람 자신은 스스로에게 보낼 것이 없다 — 자기 몫이 있어도 표시할 자리가 아니다
  if (!share || userId === row.payeeId) return { ok: false, reason: 'no-share' };

  if (paid) {
    await db
      .insert(settlementPaid)
      .values({ settlementId, userId, markedBy: by })
      /*
       * 이미 있으면 marked_by를 새로 누른 사람으로 덮는다. 낸 사람이 먼저 「보냈어요」를
       * 누른 뒤 받은 사람이 확인하면 그때부터 확인된 줄이 되어야 한다 — 아무것도 안 하면
       * 영영 「본인이 그렇다고 함」에 머문다.
       */
      .onConflictDoUpdate({
        target: [settlementPaid.settlementId, settlementPaid.userId],
        set: { markedBy: by, markedAt: new Date() },
      });
  } else {
    await db
      .delete(settlementPaid)
      .where(and(eq(settlementPaid.settlementId, settlementId), eq(settlementPaid.userId, userId)));
  }
  return { ok: true };
}
