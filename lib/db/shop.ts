import { and, eq } from 'drizzle-orm';
import { getDb } from './index';
import { themePurchases, users } from './schema';
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
  /** 활동으로 번 코인 */
  earned: number;
  /** 여태 쓴 코인 */
  spent: number;
  /** 지금 쓸 수 있는 코인 */
  left: number;
  owned: string[];
}

export async function walletOf(userId: string): Promise<Wallet> {
  const db = await getDb();
  const [scores, rows] = await Promise.all([
    boardScoresFor(userId),
    db.select().from(themePurchases).where(eq(themePurchases.userId, userId)),
  ]);
  const earned = coinsEarned(scores);
  const spent = rows.reduce((n, r) => n + r.coins, 0);
  return {
    ...scores,
    earned,
    spent,
    left: earned - spent,
    owned: rows.map((r) => r.theme),
  };
}

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
      .select({ id: users.id, kakaoName: users.kakaoName, nickname: users.nickname, nameEn: users.nameEn })
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
      const earned = coinsEarned(s);
      const spent = mine.reduce((n, r) => n + r.coins, 0);
      return {
        id: p.id,
        name: nameOf(p, UNKNOWN_NAME, locale),
        ...s,
        earned,
        spent,
        left: earned - spent,
        owned: mine.map((r) => r.theme),
      };
    })
    /* 산 사람을 먼저, 그다음 코인 많은 순 — 관리자가 보러 오는 이유가 그 둘이다 */
    .sort((a, b) => b.owned.length - a.owned.length || b.left - a.left || a.name.localeCompare(b.name));
}
