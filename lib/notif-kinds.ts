/**
 * 알림 종류 — notifications.kind에 들어가는 값.
 *
 * 눌렀을 때 어디로 보낼지를 정하는 데만 쓴다. 문자열 컬럼이라 오타 하나면
 * 알림이 조용히 안 눌리는 줄이 되므로, 쓰는 쪽도 읽는 쪽도 반드시 여기를 거친다.
 *
 * DB를 import하지 않는다 — 알림 화면(app/notifications/page.tsx)이 클라이언트
 * 컴포넌트라, lib/db/* 에 두면 drizzle과 PGlite가 브라우저 번들에 딸려 온다.
 */
export const NOTIF = {
  /** 정산 — 모임 화면의 정산 카드로 */
  settle: 'settle',
  /** 친구 요청이 왔다 */
  friendReq: 'friend_req',
  /** 친구가 됐다 */
  friendOk: 'friend_ok',
  /** 친구가 어떤 모임에 참가했다 */
  friendJoin: 'friend_join',
  /** 누가 나를 모임에 넣었다 */
  added: 'added',
  /** 비공개 모임에 초대받았다 */
  invite: 'invite',
} as const;

/** 모임 화면(/p/<id>)으로 보내는 종류 */
export const POST_KINDS: string[] = [NOTIF.friendJoin, NOTIF.added, NOTIF.invite];

/** 친구 화면(/friends)으로 보내는 종류 */
export const FRIEND_KINDS: string[] = [NOTIF.friendReq, NOTIF.friendOk];
