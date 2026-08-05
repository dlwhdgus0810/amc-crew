import { cache } from 'react';
import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { users } from './schema';
import { Profiles, UserProfile } from '../types';

const KAKAO_NAME_HISTORY_MAX = 50;

/**
 * 이름을 붙이는 데 쓰는 회원 명부.
 *
 * 세 칸만 읽는다. 예전에는 select *였는데, 소비자인 resolveDisplayName은 nickname과
 * kakaoName만 보면서 아바타(256px data URL)와 카카오 토큰까지 매번 끌고 왔다.
 * kakaoNameHistory는 보관용이라 화면에 쓰는 곳이 없다 — 이력이 필요한 dbUpdateProfile은
 * 자기 행을 따로 읽으므로 여기서 빠져도 이력은 그대로 쌓인다.
 *
 * 같은 요청 안에서 여러 번 불려도 한 번만 읽는다 (cache).
 */
export const dbGetProfiles = cache(async (): Promise<Profiles> => {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, kakaoName: users.kakaoName, nickname: users.nickname })
    .from(users);
  const out: Profiles = {};
  for (const row of rows) {
    out[row.id] = {
      kakaoName: row.kakaoName,
      ...(row.nickname ? { nickname: row.nickname } : {}),
      kakaoNameHistory: [],
    };
  }
  return out;
});

/** me 라우트용 단건 조회 — 같은 요청 안에서는 한 번만 읽는다 */
export const dbGetUser = cache(async (userId: string) => {
  const db = await getDb();
  return (await db.select().from(users).where(eq(users.id, userId)))[0];
});

/** 지난 비공개 모임을 캘린더·지난 모임 목록에 띄울지 (기본 꺼짐) */
export async function setShowPastPrivate(userId: string, on: boolean): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ showPastPrivate: on }).where(eq(users.id, userId));
}

/**
 * 친구들에게 "접속 중"으로 보일지 (기본 켜짐).
 *
 * 친구별 스위치와 달리 한 번에 전부 끈다. 신호는 그대로 쌓이므로 접속 기록은 남는다 —
 * 끄는 것은 남에게 보이는 표시뿐이다.
 */
export async function setShowPresence(userId: string, on: boolean): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ showPresence: on }).where(eq(users.id, userId));
}

/**
 * 프로필 upsert. nickname: null 이면 커스텀 닉네임 해제(카카오 닉네임 폴백 복귀).
 * kakaoName이 직전 이력과 다르면 kakaoNameHistory에 스냅샷을 쌓는다.
 */
export async function dbUpdateProfile(
  userId: string,
  patch: { kakaoName?: string; nickname?: string | null; birthday?: string; gender?: string; locale?: string; avatar?: string | null; venmo?: string | null; zelle?: string | null }
): Promise<UserProfile> {
  const db = await getDb();
  const existing = (await db.select().from(users).where(eq(users.id, userId)))[0];

  let kakaoName = existing?.kakaoName ?? '';
  let nickname: string | null = existing?.nickname ?? null;
  let history = existing?.kakaoNameHistory ?? [];
  const birthday = patch.birthday ?? existing?.birthday ?? null;
  const gender = patch.gender ?? existing?.gender ?? null;
  const locale = patch.locale ?? existing?.locale ?? null;
  const avatar = patch.avatar === undefined ? (existing?.avatar ?? null) : patch.avatar;
  // 준 것만 바꾼다 — 아래 upsert가 필드를 통째로 덮어쓰므로 안 주면 기존 값을 다시 넣어야 한다
  const venmo = patch.venmo === undefined ? (existing?.venmo ?? null) : patch.venmo;
  const zelle = patch.zelle === undefined ? (existing?.zelle ?? null) : patch.zelle;

  if (patch.kakaoName !== undefined) {
    kakaoName = patch.kakaoName;
    const last = history[history.length - 1];
    if (last?.name !== patch.kakaoName) {
      history = [...history, { name: patch.kakaoName, at: new Date().toISOString() }].slice(
        -KAKAO_NAME_HISTORY_MAX
      );
    }
  }
  if (patch.nickname === null) {
    nickname = null;
  } else if (patch.nickname !== undefined) {
    nickname = patch.nickname;
  }

  await db
    .insert(users)
    .values({ id: userId, kakaoName, nickname, kakaoNameHistory: history, birthday, gender, locale, avatar, venmo, zelle })
    .onConflictDoUpdate({
      target: users.id,
      set: { kakaoName, nickname, kakaoNameHistory: history, birthday, gender, locale, avatar, venmo, zelle },
    });

  return { kakaoName, ...(nickname ? { nickname } : {}), kakaoNameHistory: history };
}

/**
 * 신규 API가 FK insert 전에 users row 존재를 보장.
 * (users 테이블 도입 전에 발급된 세션이 남아있을 수 있으므로 콜백 upsert만으로는 부족)
 */
export async function ensureUser(user: { id: string; name: string }): Promise<void> {
  const db = await getDb();
  await db
    .insert(users)
    .values({ id: user.id, kakaoName: user.name, kakaoNameHistory: [{ name: user.name, at: new Date().toISOString() }] })
    .onConflictDoNothing();
}
