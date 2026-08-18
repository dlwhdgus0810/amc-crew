import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { users } from './schema';
import { allBoardCounts } from './hosting';
import { insertPushNotice } from './posts';
import { BOARD_LABEL, BOARDS, BOARD_TIERS, Board, tierOf } from '../hosting';
import { Locale, Msg, pick } from '../i18n';
import { NOTIF } from '../notif-kinds';

/**
 * 등급이 오른 사람에게 알린다 — 하루 한 번, 크론에서 (app/api/cron/reminders).
 *
 * **왜 크론인가.** 등급이 오르는 순간이 사람이 누르는 순간이 아니다. 주최·참여 점수는
 * 모임이 **끝나야** 오르는데(lib/db/hosting.ts의 endedSql) 끝나는 것은 아무도 안 누른다.
 * 사진과 댓글은 누르는 순간이 있지만, 거기에 매달면 사진 열 장을 올리면서 점수가 세 번
 * 지나가고 알림도 세 번 간다. 하루에 한 번 모아 보면 두 문제가 같이 없어진다.
 *
 * **처음 도는 날은 아무에게도 안 알린다.** 지금 등급이 있는 사람이 이미 스무 명이 넘어서,
 * 켜자마자 훑으면 반년 전에 받은 등급으로 폰이 스무 번 울린다. 그래서 users.tier_seen이
 * **비어 있으면** 지금 등급을 조용히 적어 두기만 한다. 알림은 그 다음부터 — 적어 둔 값을
 * 넘어설 때만 나간다.
 *
 * **내려간 것은 안 적는다.** 모임이 지워지면 점수가 내려갈 수 있는데, 적어 둔 값을 같이
 * 내리면 그 자리를 다시 넘을 때 같은 등급이 또 울린다. 한 번 알린 등급은 그대로 둔다.
 */

const T = {
  /** 여러 표에서 한꺼번에 오르는 날이 있다 — 한 줄에 모아 보낸다 (푸시가 서로를 덮어쓴다) */
  up: {
    ko: '🎉 등급이 올랐어요 — {list}',
    en: '🎉 You moved up — {list}',
    es: '🎉 Subiste de nivel — {list}',
  } satisfies Msg,
  item: {
    ko: '{board} 「{tier}」',
    en: '{board}: {tier}',
    es: '{board}: {tier}',
  } satisfies Msg,
};

/** 등급이 없으면 0 — 「아직 못 받았다」도 적어 둬야 첫 등급을 알릴 수 있다 */
function tierMin(board: Board, count: number): number {
  return tierOf(BOARD_TIERS[board], count)?.min ?? 0;
}

export async function announceTierUps(
  origin: string
): Promise<{ ups: number; seeded: number; notified: number }> {
  const counts = await allBoardCounts();
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, tierSeen: users.tierSeen, bannedUntil: users.bannedUntil })
    .from(users);

  const now = Date.now();
  let ups = 0;
  let seeded = 0;
  let notified = 0;

  for (const row of rows) {
    const seen = row.tierSeen ?? null;
    const next: Record<string, number> = { ...(seen ?? {}) };
    const risen: Board[] = [];
    let changed = false;

    for (const board of BOARDS) {
      const cur = tierMin(board, counts[board].get(row.id) ?? 0);
      const prev = seen?.[board];
      if (prev === undefined) {
        // 처음 재 보는 칸 — 조용히 적어만 둔다
        next[board] = cur;
        changed = true;
        seeded++;
      } else if (cur > prev) {
        next[board] = cur;
        changed = true;
        risen.push(board);
      }
    }
    if (!changed) continue;

    /*
     * 알림을 먼저 보내고 적는다. 반대로 하면 보내다 실패했을 때 「이미 알렸다」고 적힌
     * 채로 남아서 그 등급은 영영 안 알려진다. 이 순서면 최악이 두 번 가는 것이다.
     */
    const banned = row.bannedUntil != null && row.bannedUntil.getTime() > now;
    if (risen.length > 0 && !banned) {
      const render = (locale: Locale) =>
        pick(locale, T.up, {
          list: risen
            .map((b) =>
              pick(locale, T.item, {
                board: pick(locale, BOARD_LABEL[b]),
                tier: pick(locale, tierOf(BOARD_TIERS[b], counts[b].get(row.id) ?? 0)!.label),
              })
            )
            .join(', '),
        });
      await insertPushNotice([row.id], null, NOTIF.tier, `${origin}/leaderboard`, render);
      notified++;
      ups += risen.length;
    }

    await db.update(users).set({ tierSeen: next }).where(eq(users.id, row.id));
  }

  // 크론 응답에 남는다 — 처음 도는 날은 seeded만 크고 notified가 0이어야 맞다
  return { ups, seeded, notified };
}
