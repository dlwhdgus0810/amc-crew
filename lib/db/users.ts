import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { users } from './schema';
import { Profiles, UserProfile } from '../types';

const KAKAO_NAME_HISTORY_MAX = 50;

export async function dbGetProfiles(): Promise<Profiles> {
  const db = await getDb();
  const rows = await db.select().from(users);
  const out: Profiles = {};
  for (const row of rows) {
    out[row.id] = {
      kakaoName: row.kakaoName,
      ...(row.nickname ? { nickname: row.nickname } : {}),
      kakaoNameHistory: row.kakaoNameHistory ?? [],
    };
  }
  return out;
}

/** me 라우트용 단건 조회 */
export async function dbGetUser(userId: string) {
  const db = await getDb();
  return (await db.select().from(users).where(eq(users.id, userId)))[0];
}

/**
 * 프로필 upsert. nickname: null 이면 커스텀 닉네임 해제(카카오 닉네임 폴백 복귀).
 * kakaoName이 직전 이력과 다르면 kakaoNameHistory에 스냅샷을 쌓는다.
 */
export async function dbUpdateProfile(
  userId: string,
  patch: { kakaoName?: string; nickname?: string | null; birthday?: string; gender?: string; locale?: string; avatar?: string | null }
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
    .values({ id: userId, kakaoName, nickname, kakaoNameHistory: history, birthday, gender, locale, avatar })
    .onConflictDoUpdate({
      target: users.id,
      set: { kakaoName, nickname, kakaoNameHistory: history, birthday, gender, locale, avatar },
    });

  return { kakaoName, ...(nickname ? { nickname } : {}), kakaoNameHistory: history };
}

/** 카카오 토큰 보관 (로그인 콜백·리프레시 시). refreshToken/talkMessage는 준 것만 갱신. */
export async function dbSaveKakaoTokens(
  userId: string,
  t: { accessToken: string; expiresAt: Date; refreshToken?: string; talkMessage?: boolean }
): Promise<void> {
  const db = await getDb();
  await db
    .update(users)
    .set({
      kakaoAccessToken: t.accessToken,
      kakaoTokenExpiresAt: t.expiresAt,
      ...(t.refreshToken ? { kakaoRefreshToken: t.refreshToken } : {}),
      ...(t.talkMessage !== undefined ? { kakaoTalkMessage: t.talkMessage } : {}),
    })
    .where(eq(users.id, userId));
}

/**
 * talk_message 동의 여부만 갱신 (동의 확인·철회·발송 실패 자기치유용).
 * update-only이므로 row가 없으면 no-op — 호출 전에 ensureUser/updateProfile로 row를 보장할 것.
 */
export async function dbSetTalkMessage(userId: string, agreed: boolean): Promise<void> {
  const db = await getDb();
  await db.update(users).set({ kakaoTalkMessage: agreed }).where(eq(users.id, userId));
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
