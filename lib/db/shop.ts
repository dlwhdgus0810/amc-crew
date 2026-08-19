import { and, eq, sql } from 'drizzle-orm';
import { getDb } from './index';
import { themePurchases, users } from './schema';
import { unstable_cache } from 'next/cache';
import { allBoardScores, boardScoresFor } from './hosting';
import { coinsEarned, priceOf } from '../shop';
import { nameOf, UNKNOWN_NAME } from '../store';
import type { Locale } from '../i18n';

/**
 * 테마 상점 — 코인 셈과 사기.
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
  /** 지금 프로필 사진이 있는지 — 있으면 코인 20이 붙어 있다 (lib/shop.ts의 COIN.avatar) */
  avatar: boolean;
  /** 활동으로 번 코인 */
  earned: number;
  /** 여태 쓴 코인 */
  spent: number;
  /**
   * 지금 쓸 수 있는 코인. **마이너스로 내려갈 수 있다.**
   *
   * 사진 20으로 테마를 산 다음 사진을 내리면 번 값만 20 줄고 산 값은 그대로라 여기가
   * 음수가 된다. 0으로 자르지 않는 것이 요점이다 — 자르면 「사고 나서 내리기」가
   * 공짜가 된다. 음수인 동안은 산 테마도 잠긴다 (themeAllowed).
   */
  left: number;
  owned: string[];
}

/** 사진 데이터를 안 읽는다 — 데이터 URL이라 쉰 명치를 끌어오면 그것만 몇 MB다 */
const hasAvatar = sql<boolean>`(${users.avatar} IS NOT NULL)`;

export async function walletOf(userId: string): Promise<Wallet> {
  const db = await getDb();
  const [scores, rows, me] = await Promise.all([
    boardScoresFor(userId),
    db.select().from(themePurchases).where(eq(themePurchases.userId, userId)),
    db.select({ avatar: hasAvatar }).from(users).where(eq(users.id, userId)),
  ]);
  const avatar = me[0]?.avatar ?? false;
  const earned = coinsEarned({ ...scores, avatar });
  const spent = rows.reduce((n, r) => n + r.coins, 0);
  return {
    ...scores,
    avatar,
    earned,
    spent,
    left: earned - spent,
    owned: rows.map((r) => r.theme),
  };
}

/**
 * 이 사람이 지금 이 테마를 쓸 수 있나 — **레이아웃이 화면마다 묻는다.**
 *
 * 고른 테마는 쿠키에 있어서(lib/card-theme.ts) 서버가 확인하지 않으면 산 적 없는
 * 테마도 손으로 넣어 쓸 수 있고, 사진을 내려 코인이 마이너스가 된 뒤에도 계속 쓰게
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
 * **한 번도 활동이 없는 사람도 넣는다.** 코인 0으로 명단에 있어야 「이 사람은 왜 없지」가
 * 안 생긴다 — 관리자 화면은 전체를 보는 자리다.
 */
export async function allWallets(locale: Locale): Promise<WalletRow[]> {
  const db = await getDb();
  const [scores, buys, people] = await Promise.all([
    allBoardScores(),
    db.select().from(themePurchases),
    db
      .select({ id: users.id, kakaoName: users.kakaoName, nickname: users.nickname, nameEn: users.nameEn, avatar: hasAvatar })
      .from(users),
  ]);

  const boughtBy = new Map<string, { theme: string; coins: number }[]>();
  for (const b of buys) {
    if (!boughtBy.has(b.userId)) boughtBy.set(b.userId, []);
    boughtBy.get(b.userId)!.push({ theme: b.theme, coins: b.coins });
  }

  return people
    .map((p) => {
      const s = scores.get(p.id) ?? { host: 0, join: 0, contrib: 0 };
      const mine = boughtBy.get(p.id) ?? [];
      const avatar = p.avatar ?? false;
      const earned = coinsEarned({ ...s, avatar });
      const spent = mine.reduce((n, r) => n + r.coins, 0);
      return {
        id: p.id,
        name: nameOf(p, UNKNOWN_NAME, locale),
        ...s,
        avatar,
        earned,
        spent,
        left: earned - spent,
        owned: mine.map((r) => r.theme),
      };
    })
    /* 산 사람을 먼저, 그다음 코인 많은 순 — 관리자가 보러 오는 이유가 그 둘이다 */
    .sort((a, b) => b.owned.length - a.owned.length || b.left - a.left || a.name.localeCompare(b.name));
}
