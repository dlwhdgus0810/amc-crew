import { and, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb } from './index';
import { friendships, postParticipants, users } from './schema';
import { resolveDisplayName } from '../store';
import { ONLINE_WINDOW_MINUTES } from './presence';
import { insertInAppNotice } from './posts';
import { NOTIF } from '../notif-kinds';
import { Locale, Msg, pick } from '../i18n';

/**
 * 친구 — 요청, 수락, 목록, 그리고 지금 접속 중인 친구.
 *
 * 친구 관계는 늘 쌍방이다. 한쪽만 친구인 상태는 없고, 줄도 한 쌍에 하나뿐이다.
 * 그래서 모든 질의는 pair()로 (작은 쪽, 큰 쪽) 순서를 맞춘 뒤에 들어간다.
 *
 * lib/db/posts.ts를 가져다 쓰지만 그 반대는 없다 — 모임 쪽은 친구를 모른 채로 두고,
 * 라우트가 friendIds()로 받은 명단을 넘겨 준다.
 */

const N = {
  reqLine: { ko: '{name}님이 친구 요청을 보냈어요', en: '{name} sent you a friend request' },
  okLine: { ko: '{name}님과 친구가 됐어요', en: 'You and {name} are now friends' },
};

/** 내 모임을 친구에게 어디까지 보여줄지 */
export const MEETUP_SCOPES = ['all', 'upcoming', 'none'] as const;
export type MeetupScope = (typeof MEETUP_SCOPES)[number];

export interface FriendView {
  id: string;
  name: string;
  avatar: string | null;
  /** friends = 맺어짐 · incoming = 내가 수락할 차례 · outgoing = 상대가 수락할 차례 */
  status: 'friends' | 'incoming' | 'outgoing';
  /**
   * 이 친구가 나를 접속 중으로 볼 수 있는지 — 내가 정한다.
   * 상대가 나를 숨겼는지는 내보내지 않는다. 그걸 알려주면 숨기는 의미가 없다.
   */
  showsPresence: boolean;
  /**
   * 이 친구에게 내 모임을 어디까지 보여줄지 — 내가 정한다.
   * (실제로 늘 내려보내고 있었는데 타입에만 빠져 있었다)
   */
  showsMeetups: MeetupScope;
  online: boolean;
  /** 접속 중이 아니면 null — 마지막 접속 시각 자체는 내보내지 않는다 */
  secondsAgo: number | null;
}

/** 늘 같은 순서로 — 이 한 곳에서만 정한다 */
function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

/** drizzle의 execute 반환 형태가 드라이버마다 다르다 (neon-http는 { rows }, 배열인 경우도 있다) */
function resultRows(res: unknown): Record<string, unknown>[] {
  return (Array.isArray(res) ? res : ((res as { rows?: unknown[] }).rows ?? [])) as Record<string, unknown>[];
}

/**
 * 친구 요청. 한 문장으로 끝낸다 — neon-http에는 트랜잭션이 없다.
 *
 * 두 사람이 같은 순간에 서로에게 요청하면 둘 다 같은 줄을 노리게 되고, 진 쪽의
 * ON CONFLICT가 그 자리에서 수락으로 바꾼다. 서로 원하는 걸 확인한 셈이니 맞는 결과다.
 *
 *  - 'requested' 새 요청이 생겼다
 *  - 'accepted'  반대편 요청이 있어서 바로 친구가 됐다
 *  - 'exists'    이미 친구이거나 내가 이미 보낸 요청이 있다
 */
export async function requestFriend(me: string, other: string): Promise<'requested' | 'accepted' | 'exists'> {
  const db = await getDb();
  const [lo, hi] = pair(me, other);
  const res = await db.execute(sql`
    INSERT INTO friendships (user_a, user_b, requested_by, status)
    VALUES (${lo}, ${hi}, ${me}, 'pending')
    ON CONFLICT (user_a, user_b) DO UPDATE
      SET status = 'accepted', accepted_at = now()
      WHERE friendships.status = 'pending' AND friendships.requested_by <> ${me}
    RETURNING status
  `);
  const rows = resultRows(res);
  if (rows.length === 0) return 'exists';
  return String(rows[0]!.status) === 'accepted' ? 'accepted' : 'requested';
}

/**
 * 요청 수락. 조건이 곧 권한 검사다 —
 * 아직 pending이고, 내가 건 요청이 아니어야 한다. 두 번 눌러도 두 번째는 0줄이라 알림이 겹치지 않는다.
 */
export async function acceptFriend(me: string, other: string): Promise<boolean> {
  const db = await getDb();
  const [lo, hi] = pair(me, other);
  const rows = await db
    .update(friendships)
    .set({ status: 'accepted', acceptedAt: new Date() })
    .where(
      and(
        eq(friendships.userA, lo),
        eq(friendships.userB, hi),
        eq(friendships.status, 'pending'),
        ne(friendships.requestedBy, me)
      )
    )
    .returning();
  return rows.length > 0;
}

/**
 * 거절 · 요청 취소 · 친구 끊기 — 셋 다 줄을 지우는 같은 동작이다.
 * 무엇을 지웠는지 알려줘서 화면이 알맞은 문구를 고를 수 있게 한다.
 */
export async function removeFriendship(
  me: string,
  other: string
): Promise<'friend' | 'incoming' | 'outgoing' | null> {
  const db = await getDb();
  const [lo, hi] = pair(me, other);
  const rows = await db
    .delete(friendships)
    .where(and(eq(friendships.userA, lo), eq(friendships.userB, hi)))
    .returning();
  const row = rows[0];
  if (!row) return null;
  if (row.status === 'accepted') return 'friend';
  return row.requestedBy === me ? 'outgoing' : 'incoming';
}

/**
 * 내 접속 상태를 이 친구에게 보여줄지 정한다.
 *
 * 내 쪽 칸만 건드린다 — 쌍마다 줄이 하나라서, 어느 칸이 내 것인지는 pair() 순서가 정한다.
 * 맺어진 친구에게만 의미가 있으므로 그 줄에만 쓴다.
 */
export async function setPresenceVisible(me: string, other: string, visible: boolean): Promise<boolean> {
  const db = await getDb();
  const [lo, hi] = pair(me, other);
  const rows = await db
    .update(friendships)
    .set(me === lo ? { aShowsPresence: visible } : { bShowsPresence: visible })
    .where(and(eq(friendships.userA, lo), eq(friendships.userB, hi), eq(friendships.status, 'accepted')))
    .returning();
  return rows.length > 0;
}

/** 내 모임을 이 친구에게 어디까지 보여줄지 정한다 (내 쪽 칸만 바뀐다) */
export async function setMeetupScope(me: string, other: string, scope: MeetupScope): Promise<boolean> {
  const db = await getDb();
  const [lo, hi] = pair(me, other);
  const rows = await db
    .update(friendships)
    .set(me === lo ? { aShowsMeetups: scope } : { bShowsMeetups: scope })
    .where(and(eq(friendships.userA, lo), eq(friendships.userB, hi), eq(friendships.status, 'accepted')))
    .returning();
  return rows.length > 0;
}

/**
 * 이 친구가 나에게 자기 모임을 어디까지 보여주는지 (내가 보는 쪽).
 * 친구가 아니면 null — 남의 모임 목록은 친구 사이에서만 열린다.
 */
export async function meetupScopeFor(viewer: string, owner: string): Promise<MeetupScope | null> {
  const db = await getDb();
  const [lo, hi] = pair(viewer, owner);
  const [row] = await db
    .select({ a: friendships.aShowsMeetups, b: friendships.bShowsMeetups, status: friendships.status })
    .from(friendships)
    .where(and(eq(friendships.userA, lo), eq(friendships.userB, hi), eq(friendships.status, 'accepted')));
  if (!row) return null;
  // owner 쪽 칸이 곧 "owner가 보여주기로 한 범위"다
  return (owner === lo ? row.a : row.b) as MeetupScope;
}

/** 맺어진 친구인지 (요청 중은 아무 권한도 주지 않는다) */
export async function areFriends(a: string, b: string): Promise<boolean> {
  const db = await getDb();
  const [lo, hi] = pair(a, b);
  const rows = await db
    .select({ status: friendships.status })
    .from(friendships)
    .where(and(eq(friendships.userA, lo), eq(friendships.userB, hi), eq(friendships.status, 'accepted')));
  return rows.length > 0;
}

/** 내 친구들의 id — 알림 수신자를 만들 때 쓴다 */
export async function friendIds(me: string): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ a: friendships.userA, b: friendships.userB })
    .from(friendships)
    .where(and(eq(friendships.status, 'accepted'), or(eq(friendships.userA, me), eq(friendships.userB, me))));
  return rows.map((r) => (r.a === me ? r.b : r.a));
}

/** 나와 얽힌 모든 줄 — 친구, 받은 요청, 보낸 요청을 한 번에 */
export async function listFriendships(me: string): Promise<FriendView[]> {
  const db = await getDb();
  const links = await db
    .select({
      a: friendships.userA,
      b: friendships.userB,
      status: friendships.status,
      requestedBy: friendships.requestedBy,
      aShows: friendships.aShowsPresence,
      bShows: friendships.bShowsPresence,
      aScope: friendships.aShowsMeetups,
      bScope: friendships.bShowsMeetups,
    })
    .from(friendships)
    .where(or(eq(friendships.userA, me), eq(friendships.userB, me)));
  if (links.length === 0) return [];

  const otherIds = links.map((l) => (l.a === me ? l.b : l.a));
  const people = await db
    .select({
      id: users.id,
      kakaoName: users.kakaoName,
      nickname: users.nickname,
      avatar: users.avatar,
      lastSeen: users.lastSeen,
      showPresence: users.showPresence,
    })
    .from(users)
    .where(inArray(users.id, otherIds));
  const byId = new Map(people.map((p) => [p.id, p]));

  const now = Date.now();
  const onlineFrom = now - ONLINE_WINDOW_MINUTES * 60_000;

  return links.flatMap((l) => {
    const otherId = l.a === me ? l.b : l.a;
    const p = byId.get(otherId);
    if (!p) return []; // users 행이 없으면 보여줄 것이 없다
    const seen = p.lastSeen ? new Date(p.lastSeen).getTime() : 0;
    // 상대가 나에게 접속을 감췄으면 그냥 접속 중이 아닌 것으로 보인다 (감췄다는 사실도 표시하지 않는다)
    // 감추는 방법이 둘이다 — 나에게만(친구별 스위치), 모두에게(users.showPresence). 어느 쪽이든 결과는 같다.
    const meIsA = l.a === me;
    const otherShowsMe = (meIsA ? l.bShows : l.aShows) && p.showPresence;
    const online = otherShowsMe && seen >= onlineFrom;
    return [
      {
        id: p.id,
        name: resolveDisplayName(
          { kakaoName: p.kakaoName, ...(p.nickname ? { nickname: p.nickname } : {}), kakaoNameHistory: [] },
          p.kakaoName
        ),
        avatar: p.avatar,
        status:
          l.status === 'accepted' ? ('friends' as const) : l.requestedBy === me ? ('outgoing' as const) : ('incoming' as const),
        showsPresence: meIsA ? l.aShows : l.bShows,
        showsMeetups: (meIsA ? l.aScope : l.bScope) as MeetupScope,
        online,
        secondsAgo: online ? Math.max(0, Math.round((now - seen) / 1000)) : null,
      },
    ];
  });
}

/** 지금 접속 중인 친구 (최근 신호순) */
export function onlineOf(list: FriendView[]): FriendView[] {
  return list
    .filter((f) => f.status === 'friends' && f.online)
    .sort((x, y) => (x.secondsAgo ?? 0) - (y.secondsAgo ?? 0));
}

/** 이름순 친구 목록 — 접속 중인 사람이 앞으로 */
export function friendsOf(list: FriendView[]): FriendView[] {
  return list
    .filter((f) => f.status === 'friends')
    .sort((x, y) => Number(y.online) - Number(x.online) || x.name.localeCompare(y.name));
}

export function incomingOf(list: FriendView[]): FriendView[] {
  return list.filter((f) => f.status === 'incoming');
}

export function outgoingOf(list: FriendView[]): FriendView[] {
  return list.filter((f) => f.status === 'outgoing');
}

/** 내가 수락할 차례인 요청 수 — 알림 화면의 배지 */
export async function pendingIncomingCount(me: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'pending'),
        ne(friendships.requestedBy, me),
        or(eq(friendships.userA, me), eq(friendships.userB, me))
      )
    );
  return row?.n ?? 0;
}

/**
 * 같은 모임에 있었던 사이인지 — 친구 요청을 보낼 수 있는 유일한 조건이다.
 * 지난 모임도 센다. 주최자는 모임을 만들 때 참가자로 들어가므로 자동으로 포함된다.
 */
export async function sharesMeetup(a: string, b: string): Promise<boolean> {
  const db = await getDb();
  const mine = alias(postParticipants, 'mine');
  const theirs = alias(postParticipants, 'theirs');
  const rows = await db
    .select({ postId: mine.postId })
    .from(mine)
    .innerJoin(theirs, eq(theirs.postId, mine.postId))
    .where(and(eq(mine.userId, a), eq(theirs.userId, b)))
    .limit(1);
  return rows.length > 0;
}

function line(msg: Msg, name: string) {
  return (locale: Locale) => `🤝 ${pick(locale, msg, { name })}`;
}

/** 요청이 왔다고 알린다 (인앱 한 줄, 폰은 울리지 않는다) */
export async function notifyFriendRequest(toId: string, fromName: string): Promise<void> {
  await insertInAppNotice([toId], null, NOTIF.friendReq, line(N.reqLine, fromName));
}

/** 친구가 됐다고 알린다 */
export async function notifyFriendAccepted(toId: string, byName: string): Promise<void> {
  await insertInAppNotice([toId], null, NOTIF.friendOk, line(N.okLine, byName));
}
