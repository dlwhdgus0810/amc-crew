// 모임 정산 — 한 모임에 하나. 돈을 받을 사람이 항목을 적으면 각자 낼 금액이 계산되고 알림이 나간다.

import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from './index';
import {
  notifications,
  postParticipants,
  posts,
  settlementItemMembers,
  settlementItems,
  settlements,
  settlementMembers,
  users,
} from './schema';
import { resolveDisplayName } from '../store';
import { catName, getCategory } from '../categories';
import { adminIds } from '../auth';
import { formatCents, payNote, shortCode, splitWithExtras, venmoLink } from '../money';
import { sendPush } from '../push';
import { dateLabelShort, timeLabel } from '../datefmt';
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
  },
  btn: { ko: '정산 보기', en: 'See the split' },
  viaVenmo: { ko: 'Venmo: {handle}', en: 'Venmo: {handle}' },
  /*
   * 외부인 전달용에만 주소를 붙인다. 이 사람들은 앱에 없어서 모임 화면을 열 수 없고,
   * 그래서 금액이 채워진 링크가 여기 말고는 갈 곳이 없다.
   */
  viaVenmoLink: { ko: 'Venmo로 보내기: {url}', en: 'Pay with Venmo: {url}' },
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
  const [row] = await db.select({ id: settlements.id }).from(settlements).where(eq(settlements.postId, postId));
  const extras = row ? await extraMemberIds(row.id) : [];
  return payerIds(postId, extras);
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

  const extras = await extraMemberIds(row.id);
  const participants = await payerIds(postId, extras);
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
    extraMembers: extras.map((id) => ({ id, name: displayNameOf(userById.get(id), '알 수 없음') })),
    shortCode: row.shortCode ?? null,
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
  /** 모임에 없지만 정산에 넣을 사람 (라우트에서 이미 "내 친구"로 걸러 온다) */
  extraMemberIds?: string[];
}): Promise<void> {
  const db = await getDb();
  const [existing] = await db.select().from(settlements).where(eq(settlements.postId, input.postId));

  const settlementId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    // 항목은 cascade로 함께 지워진다
    await db.delete(settlementItems).where(eq(settlementItems.settlementId, settlementId));
    await db
      .update(settlements)
      // 예전에 만든 정산은 코드가 없다 — 저장할 때 채운다
      .set({ payeeId: input.payeeId, ...(existing.shortCode ? {} : { shortCode: shortCode() }) })
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
/**
 * 정산 알림.
 *
 * onlyUserIds를 주면 그 사람들에게만 다시 보낸다 — 「다시 알리기」다. 문구를 만드는 자리는
 * 하나뿐이어야 한다. 재발송용 함수를 따로 두면 금액 표시나 보낼 수단이 바뀔 때 한쪽만
 * 고치게 되고, 그건 받는 사람에게 서로 다른 두 문구가 도착한다는 뜻이다.
 */
export async function notifySettlement(
  postId: string,
  origin: string,
  onlyUserIds?: string[]
): Promise<{ sent: number }> {
  const view = await getSettlement(postId);
  if (!view) return { sent: 0 };

  const db = await getDb();
  const [post] = await db.select().from(posts).where(eq(posts.id, postId));
  if (!post) return { sent: 0 };

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
  const rows: { id: string; userId: string; postId: string; kind: string; message: string }[] = [];
  // 인앱·푸시는 plain, 카톡만 kakao (받을 계좌가 붙은 판)
  const messages = new Map<string, { plain: string; kakao: string; locale: Locale }>();

  /*
   * 이 메모는 「코드가 없는 옛 정산」에 쓰는 긴 Venmo 주소에만 들어간다 (아래 viaVenmoLink).
   * 앱 밖 인원용이라 그 사람이 걸린 항목만, 그 사람 몫으로 적는다 — /v/<code>와 같은 규칙이다.
   */
  const note = payNote(
    `${catName(post.category, DEFAULT_LOCALE)} ${dateLabelShort(post.date, DEFAULT_LOCALE)}`,
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
      payee: view.payee.name,
      amount: formatCents(target.cents),
      when: `${dateLabelShort(post.date, locale)} ${timeLabel(post.startTime, locale)}`,
      place: post.location,
    })}`.trim();
    /*
     * 받을 계좌는 카톡 본문에만 싣는다.
     * 인앱 알림과 푸시는 눌러서 정산 카드로 가고 거기에 보내기 수단이 이미 있다 —
     * 목록에 계좌가 늘어져 있으면 정작 읽어야 할 금액이 묻힌다.
     */
    rows.push({ id: crypto.randomUUID(), userId: target.userId, postId, kind: 'settle', message: plain });
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

    rows.push({ id: crypto.randomUUID(), userId: view.payee.id, postId, kind: 'settle', message: copy });
    messages.set(view.payee.id, {
      plain: copy,
      kakao: ways.length ? `${copy}\n${ways.join('\n')}` : copy,
      locale,
    });
  }

  if (rows.length > 0) await db.insert(notifications).values(rows);
  for (const [userId, { plain, kakao, locale }] of messages) {
    await sendPush([userId], { title: 'Kansas Korean', body: plain, url: linkUrl, tag: `settle:${postId}` });
  }
  return { sent: targets.length };
}

/**
 * 이 정산으로 누구에게 언제 마지막으로 알렸는지.
 *
 * 새 칸을 두지 않고 알림 기록에서 뽑는다 — 알림을 보냈다는 사실은 이미 notifications에
 * 남아 있고, 같은 것을 두 곳에 적어 두면 언젠가 서로 어긋난다.
 *
 * 「다시 알리기」 화면이 사람마다 이 시각을 보여준다. 하루에 세 번 찌르는 일을 막는 건
 * 규칙이 아니라 이 한 줄이다 — 방금 보냈다는 게 보이면 대개 안 누른다.
 */
export async function settlementNotifiedAt(postId: string): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db
    .select({ userId: notifications.userId, at: notifications.createdAt })
    .from(notifications)
    .where(and(eq(notifications.postId, postId), eq(notifications.kind, NOTIF.settle)))
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
