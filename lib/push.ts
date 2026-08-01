// 웹 푸시(PWA 알림) 발송.
//
// 카카오톡 알림을 대체하지 않고 나란히 나간다 — 카톡 메시지 동의를 거부한 사람에게도
// 닿고, 홈 화면에 설치한 사람은 앱 아이콘 배지로 본다.
//
// 환경변수 (셋 다 있어야 켜진다)
//  - NEXT_PUBLIC_VAPID_PUBLIC_KEY — 브라우저가 구독할 때 쓰는 공개 키
//  - VAPID_PRIVATE_KEY            — 서버 서명용 (절대 노출 금지)
//  - VAPID_SUBJECT                — mailto:주소 (푸시 서비스가 문제 시 연락할 곳)

import webpush from 'web-push';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';
import { unbannedIds } from './db/bans';
import { getDb } from './db/index';
import { notifications, pushSubscriptions } from './db/schema';

/** 알림에 담아 보내는 내용 — 서비스 워커(public/sw.js)가 그대로 읽는다 */
export interface PushPayload {
  title: string;
  body: string;
  /** 알림을 눌렀을 때 열 주소 */
  url: string;
  /**
   * 같은 tag의 알림은 서로를 덮어쓴다.
   * 한 모임에서 댓글이 연달아 달릴 때 알림이 쌓이지 않게 하려고 쓴다.
   */
  tag?: string;
  /**
   * 홈 화면 아이콘에 찍을 숫자 = 받는 사람의 안 읽은 알림 수.
   * 사람마다 다르므로 호출부가 넣지 않는다 — sendPush가 각자 값을 채워 보낸다.
   */
  unread?: number;
}

function publicKey(): string | undefined {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
}

export function pushEnabled(): boolean {
  return Boolean(publicKey() && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function configure(): boolean {
  if (!pushEnabled()) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:admin@kansaskorean.com',
      publicKey()!,
      process.env.VAPID_PRIVATE_KEY!
    );
    configured = true;
  }
  return true;
}

/** 구독 저장 (같은 기기가 다시 구독하면 주인만 갱신한다) */
export async function saveSubscription(
  userId: string,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } }
): Promise<void> {
  const db = await getDb();
  await db
    .insert(pushSubscriptions)
    .values({ endpoint: sub.endpoint, userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  const db = await getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}

/**
 * 이 사람이 몇 대의 기기로 받고 있는지.
 * "이 기기가 켜져 있는지"는 브라우저의 pushManager.getSubscription()이 진짜 답이라
 * 화면 스위치는 그쪽을 보고, 이 값은 "다른 기기 2대에서도 받는 중" 같은 안내에만 쓴다.
 */
export async function subscriptionCount(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({ endpoint: pushSubscriptions.endpoint })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return rows.length;
}

/**
 * 안 읽은 알림 수를 사람별로 센다 (홈 화면 아이콘 숫자용).
 * 알림 행은 이 함수가 불리기 전에 이미 저장돼 있으므로 방금 것도 포함된다.
 */
async function unreadCounts(userIds: string[]): Promise<Map<string, number>> {
  const out = new Map(userIds.map((id) => [id, 0]));
  if (userIds.length === 0) return out;
  const db = await getDb();
  const rows = await db
    .select({ userId: notifications.userId, n: count() })
    .from(notifications)
    .where(
      and(
        inArray(notifications.userId, userIds),
        eq(notifications.read, false),
        isNull(notifications.deletedAt)
      )
    )
    .groupBy(notifications.userId);
  for (const r of rows) out.set(r.userId, Number(r.n));
  return out;
}

/**
 * 여러 사람의 모든 기기로 발송.
 * 개별 실패는 로그만 남기고 넘어간다 — 인앱 알림은 이미 저장돼 있고,
 * 알림 하나 때문에 모임 생성이 실패하면 안 된다.
 */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<void> {
  if (!configure() || userIds.length === 0) return;

  // 개발 중에는 실제 기기로 보내지 않는다. 카톡 발송(lib/kakao.ts)과 같은 규칙인데,
  // 여기에도 걸어두지 않으면 로컬에서 DATABASE_URL을 실제 DB로 두는 순간
  // 테스트 한 번이 진짜 사람들의 잠금화면을 울린다.
  if (process.env.NODE_ENV !== 'production' && process.env.PUSH_IN_DEV !== '1') {
    console.info('[push] 개발 환경이라 발송을 건너뜁니다:', userIds.length + '명', '|', payload.body.slice(0, 60));
    return;
  }

  // 정지된 사람은 받는 명단에서 뺀다 — 눌러도 정지 화면만 나오는 알림을 보낼 이유가 없다
  const targets = await unbannedIds(userIds);
  if (targets.length === 0) return;

  const db = await getDb();
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, targets));
  if (subs.length === 0) return;

  // 아이콘 숫자는 사람마다 다르므로 본문도 사람마다 만든다
  const unread = await unreadCounts([...new Set(subs.map((s) => s.userId))]);
  const bodyFor = new Map(
    [...unread].map(([userId, n]) => [userId, JSON.stringify({ ...payload, unread: n })])
  );
  // 죽은 구독은 모아서 한 번에 지운다 (발송 도중에 지우면 같은 트랜잭션을 여러 번 건드린다)
  const dead: string[] = [];

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          bodyFor.get(s.userId) ?? JSON.stringify(payload)
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = 브라우저가 구독을 버렸다. 다시 살아나지 않으므로 지운다.
        if (status === 404 || status === 410) {
          dead.push(s.endpoint);
        } else {
          console.error('[push] 발송 실패:', s.userId.slice(-4), status, e instanceof Error ? e.message : e);
        }
      }
    })
  );

  if (dead.length > 0) {
    await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.endpoint, dead));
    console.info('[push] 만료된 구독 정리:', dead.length + '건');
  }
}
