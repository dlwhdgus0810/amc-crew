import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { getDb } from './index';
import { themePurchases, users } from './schema';
import { unstable_cache } from 'next/cache';
import { allBoardScores, allReviewedShares, boardScoresFor, reviewedSharesFor } from './hosting';
import { APOLOGY_BEFORE, coinsEarned, priceOf } from '../shop';
import { areFriends } from './friends';
import { nameOf, UNKNOWN_NAME } from '../store';
import type { Locale } from '../i18n';

/**
 * 테마 상점 — 달란트 셈과 사기.
 *
 * **잔액이라는 칸은 없다.** 활동에서 번 값을 매번 계산하고 산 값을 뺀다. 잔액을 들고
 * 있으면 모임이 지워지거나 점수 규칙이 바뀔 때(실제로 정성 점수를 10·5에서 7·3으로
 * 내린 적이 있다) 그 칸과 활동이 어긋나고, 어긋난 뒤에는 무엇이 맞는지 알 방법이 없다.
 *
 * 대신 산 줄에 **그때 낸 값**을 적어 둔다 — 값을 나중에 바꿔도 이미 산 사람의 잔액이
 * 따라 움직이면 안 되기 때문이다.
 */

export interface Wallet {
  host: number;
  join: number;
  contrib: number;
  /**
   * 지금 켜 둔 것들 — 각각 달란트 20이 붙어 있다 (lib/shop.ts의 COIN).
   *
   * 활동이 아니라 상태다. 끄면 그만큼 도로 빠지고, 잔액이 음수가 되면 산 테마도 잠긴다.
   */
  avatar: boolean;
  push: boolean;
  news: boolean;
  /** 장애를 겪은 회원인지 — lib/shop.ts의 APOLOGY_BEFORE 참고 */
  apology: boolean;
  /** 손님이 전원 후기를 쓴 모임의 손님 수 — 한 명당 COIN.reviewedAll이 붙는다 */
  reviewed: number;
  /** 활동으로 번 달란트 */
  earned: number;
  /** 여태 쓴 달란트 */
  spent: number;
  /**
   * 지금 쓸 수 있는 달란트. **마이너스로 내려갈 수 있다.**
   *
   * 사진 20으로 테마를 산 다음 사진을 내리면 번 값만 20 줄고 산 값은 그대로라 여기가
   * 음수가 된다. 0으로 자르지 않는 것이 요점이다 — 자르면 「사고 나서 내리기」가
   * 공짜가 된다. 음수인 동안은 산 테마도 잠긴다 (themeAllowed).
   */
  left: number;
  owned: string[];
  /** 그중 선물로 받은 것 */
  gifts: string[];
}

/** 사진 데이터를 안 읽는다 — 데이터 URL이라 쉰 명치를 끌어오면 그것만 몇 MB다 */
const hasAvatar = sql<boolean>`(${users.avatar} IS NOT NULL)`;
/** 기기가 몇이든 하나라도 켜 뒀으면 켠 것이다 */
const hasPush = sql<boolean>`EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = ${users.id})`;
/** 장애가 나기 전에 들어온 회원 — 그때 있던 사람에게만 보상이 붙는다 */
const wasHere = sql<boolean>`(${users.createdAt} < ${APOLOGY_BEFORE})`;

export async function walletOf(userId: string): Promise<Wallet> {
  const db = await getDb();
  const [scores, reviewed, rows, gifted, me] = await Promise.all([
    boardScoresFor(userId),
    reviewedSharesFor(userId),
    db.select().from(themePurchases).where(eq(themePurchases.userId, userId)),
    /* 내가 남에게 사 준 것 — 값은 내 지갑에서 나갔지만 테마는 그 사람 것이다 */
    db.select().from(themePurchases).where(eq(themePurchases.gifterId, userId)),
    db
      .select({ avatar: hasAvatar, push: hasPush, news: users.newsAlerts, apology: wasHere })
      .from(users)
      .where(eq(users.id, userId)),
  ]);
  const avatar = me[0]?.avatar ?? false;
  const push = me[0]?.push ?? false;
  const news = me[0]?.news ?? false;
  const apology = me[0]?.apology ?? false;
  const earned = coinsEarned({ ...scores, reviewed, avatar, push, news, apology });
  /*
   * 쓴 값 = 내가 산 것 + 내가 사 준 것.
   *
   * 받은 것(gifterId가 있는 내 줄)은 안 센다 — 그 값은 사 준 사람이 냈다. 안 거르면
   * 선물을 받는 순간 받은 사람의 잔액이 깎인다.
   */
  const spent =
    rows.reduce((n, r) => n + (r.gifterId ? 0 : r.coins), 0) + gifted.reduce((n, r) => n + r.coins, 0);
  return {
    ...scores,
    reviewed,
    avatar,
    push,
    news,
    apology,
    earned,
    spent,
    left: earned - spent,
    owned: rows.map((r) => r.theme),
    /** 그중 선물로 받은 것 */
    gifts: rows.filter((r) => r.gifterId).map((r) => r.theme),
  };
}

/**
 * 이 사람이 지금 이 테마를 쓸 수 있나 — **레이아웃이 화면마다 묻는다.**
 *
 * 고른 테마는 쿠키에 있어서(lib/card-theme.ts) 서버가 확인하지 않으면 산 적 없는
 * 테마도 손으로 넣어 쓸 수 있고, 사진을 내려 달란트가 마이너스가 된 뒤에도 계속 쓰게
 * 된다 — 그러면 잠근다는 말이 아무것도 안 잠근다.
 *
 * 값이 붙은 테마일 때만 부른다. 기본 테마인 사람은 여기까지 오지 않는다.
 *
 * 1분 담아 둔다. 지갑을 세는 데 다섯 번을 물어보는데 그걸 화면마다 하면 테마를 산
 * 사람만 앱이 느려진다. 사진을 내린 뒤 잠기기까지 최대 1분인데, 잠그는 목적이
 * 「이득이 없게 하는 것」이지 「1초 안에 막는 것」이 아니라 그 정도면 된다.
 */
export const themeAllowed = unstable_cache(
  async (userId: string, theme: string): Promise<boolean> => {
    const w = await walletOf(userId);
    return w.owned.includes(theme) && w.left >= 0;
  },
  ['theme-allowed'],
  { revalidate: 60 }
);

export type BuyResult = { ok: true; left: number } | { ok: false; reason: 'not-for-sale' | 'owned' | 'short' };

export async function buyTheme(userId: string, theme: string): Promise<BuyResult> {
  const price = priceOf(theme);
  if (price == null) return { ok: false, reason: 'not-for-sale' };

  const wallet = await walletOf(userId);
  if (wallet.owned.includes(theme)) return { ok: false, reason: 'owned' };
  if (wallet.left < price) return { ok: false, reason: 'short' };

  const db = await getDb();
  /*
   * 같은 사람이 같은 테마를 두 번 사는 것은 기본키가 막는다. 서로 **다른** 테마를
   * 동시에 눌러 잔액을 넘기는 것은 막지 않는다 — 사람이 손으로 누르는 화면이고
   * 회원이 열댓이라, 그걸 막자고 트랜잭션을 걸 값이 아니다.
   */
  await db.insert(themePurchases).values({ userId, theme, coins: price }).onConflictDoNothing();
  return { ok: true, left: wallet.left - price };
}

/**
 * 이 사람이 **선물로 받은** 테마와 준 사람의 이름.
 *
 * 지갑의 gifts는 테마 이름뿐이라 「누가 줬는지」가 없다. 프로필에서 「○○님이 준 선물」로
 * 적으려면 이름이 필요한데, 지갑은 관리자 표도 쓰는 값이라 거기까지 이름을 실어 나르면
 * 쉰 명 몫의 이름을 늘 같이 읽게 된다. 필요한 화면에서만 따로 묻는다.
 */
export async function giftsFor(userId: string, locale: Locale): Promise<{ theme: string; from: string }[]> {
  const db = await getDb();
  const rows = await db
    .select({ theme: themePurchases.theme, gifterId: themePurchases.gifterId })
    .from(themePurchases)
    .where(and(eq(themePurchases.userId, userId), isNotNull(themePurchases.gifterId)));
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r.gifterId!))];
  const people = await db
    .select({ id: users.id, kakaoName: users.kakaoName, nickname: users.nickname, nameEn: users.nameEn })
    .from(users)
    .where(inArray(users.id, ids));
  const byId = new Map(people.map((p) => [p.id, p]));
  return rows.map((r) => ({ theme: r.theme, from: nameOf(byId.get(r.gifterId!), UNKNOWN_NAME, locale) }));
}

export type GiftResult =
  | { ok: true; left: number }
  | { ok: false; reason: 'not-for-sale' | 'self' | 'not-friend' | 'owned' | 'short' };

/**
 * 친구에게 테마를 사 준다.
 *
 * 값은 **주는 사람 지갑에서** 빠지고, 테마는 받는 사람 것이 된다. 한 줄로 둘 다
 * 적는다 — 받는 사람 이름으로 줄을 넣고 gifterId에 주는 사람을 적으면, walletOf가
 * 값은 주는 쪽에서 빼고 소유는 받는 쪽에 준다.
 *
 * **친구에게만.** 이 앱은 모임에서 만난 사람만 친구가 되므로(lib/db/friends.ts),
 * 선물도 서로 아는 사이로 좁혀진다. 모르는 사람에게 알림이 가는 일이 없다.
 *
 * 이미 가진 사람에게는 못 보낸다. 열쇠가 (사람, 테마)라 넣어도 묻히는데, 그러면
 * 값만 나가고 아무 일도 안 일어난다 — 미리 막고 알려 준다.
 */
export async function giftTheme(gifterId: string, toId: string, theme: string): Promise<GiftResult> {
  const price = priceOf(theme);
  if (price == null) return { ok: false, reason: 'not-for-sale' };
  if (gifterId === toId) return { ok: false, reason: 'self' };
  if (!(await areFriends(gifterId, toId))) return { ok: false, reason: 'not-friend' };

  const [mine, theirs] = await Promise.all([walletOf(gifterId), walletOf(toId)]);
  if (theirs.owned.includes(theme)) return { ok: false, reason: 'owned' };
  if (mine.left < price) return { ok: false, reason: 'short' };

  const db = await getDb();
  /*
   * 같은 사람에게 같은 테마를 두 번 보내는 것은 기본키가 막는다. 값이 나갔는데 줄이
   * 안 들어가는 일을 막으려고 넣은 줄 수를 보고 판정한다 — 사는 쪽(buyTheme)과 달리
   * 여기서는 낸 사람과 받은 사람이 달라서, 묻히면 값만 나간 꼴이 된다.
   */
  const put = await db
    .insert(themePurchases)
    .values({ userId: toId, theme, coins: price, gifterId })
    .onConflictDoNothing()
    .returning();
  if (put.length === 0) return { ok: false, reason: 'owned' };
  return { ok: true, left: mine.left - price };
}

/** 관리자 화면의 한 줄 */
export interface WalletRow extends Wallet {
  id: string;
  name: string;
}

/**
 * 회원 전부의 지갑 — 관리자 화면이 쓴다.
 *
 * walletOf를 사람마다 부르면 쉰 명에 이백 번 넘게 물어보게 된다. 여기서는 사람 수와
 * 무관하게 다섯 번이다 (점수 셋 + 산 기록 + 이름).
 *
 * **한 번도 활동이 없는 사람도 넣는다.** 달란트 0으로 명단에 있어야 「이 사람은 왜 없지」가
 * 안 생긴다 — 관리자 화면은 전체를 보는 자리다.
 */
export async function allWallets(locale: Locale): Promise<WalletRow[]> {
  const db = await getDb();
  const [scores, reviewedAll, buys, people] = await Promise.all([
    allBoardScores(),
    allReviewedShares(),
    db.select().from(themePurchases),
    db
      .select({
        id: users.id,
        kakaoName: users.kakaoName,
        nickname: users.nickname,
        nameEn: users.nameEn,
        avatar: hasAvatar,
        push: hasPush,
        news: users.newsAlerts,
        apology: wasHere,
      })
      .from(users),
  ]);

  /* 가진 것은 받는 사람 밑에, 낸 값은 낸 사람 밑에 — 선물이면 그 둘이 다르다 */
  const boughtBy = new Map<string, { theme: string; coins: number; gifted: boolean }[]>();
  const paidBy = new Map<string, number>();
  for (const b of buys) {
    if (!boughtBy.has(b.userId)) boughtBy.set(b.userId, []);
    boughtBy.get(b.userId)!.push({ theme: b.theme, coins: b.coins, gifted: Boolean(b.gifterId) });
    const payer = b.gifterId ?? b.userId;
    paidBy.set(payer, (paidBy.get(payer) ?? 0) + b.coins);
  }

  return people
    .map((p) => {
      const s = scores.get(p.id) ?? { host: 0, join: 0, contrib: 0 };
      const mine = boughtBy.get(p.id) ?? [];
      const avatar = p.avatar ?? false;
      const push = p.push ?? false;
      const news = p.news ?? false;
      const apology = p.apology ?? false;
      const reviewed = reviewedAll.get(p.id) ?? 0;
      const earned = coinsEarned({ ...s, reviewed, avatar, push, news, apology });
      const spent = paidBy.get(p.id) ?? 0;
      return {
        id: p.id,
        name: nameOf(p, UNKNOWN_NAME, locale),
        ...s,
        reviewed,
        avatar,
        push,
        news,
        apology,
        earned,
        spent,
        left: earned - spent,
        owned: mine.map((r) => r.theme),
        gifts: mine.filter((r) => r.gifted).map((r) => r.theme),
      };
    })
    /* 산 사람을 먼저, 그다음 달란트 많은 순 — 관리자가 보러 오는 이유가 그 둘이다 */
    .sort((a, b) => b.owned.length - a.owned.length || b.left - a.left || a.name.localeCompare(b.name));
}
