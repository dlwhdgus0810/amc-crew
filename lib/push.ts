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
import { eq, inArray } from 'drizzle-orm';
import { getDb } from './db/index';
import { pushSubscriptions } from './db/schema';

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
 * 여러 사람의 모든 기기로 발송.
 * 개별 실패는 로그만 남기고 넘어간다 — 인앱 알림은 이미 저장돼 있고,
 * 알림 하나 때문에 모임 생성이 실패하면 안 된다.
 */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<void> {
  if (!configure() || userIds.length === 0) return;

  const db = await getDb();
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);
  // 죽은 구독은 모아서 한 번에 지운다 (발송 도중에 지우면 같은 트랜잭션을 여러 번 건드린다)
  const dead: string[] = [];

  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
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
