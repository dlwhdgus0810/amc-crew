import { and, asc, eq } from 'drizzle-orm';
import { getDb } from './index';
import { categorySignups, users } from './schema';
import { resolveDisplayName } from '../store';
import { catName, getCategory } from '../categories';
import { sendPush } from '../push';
import { insertInAppNotice } from './posts';
import { Locale, Msg, pick, toLocale } from '../i18n';
import { NOTIF } from '../notif-kinds';

/**
 * 카테고리 참가신청 — 「사람이 먼저, 모임은 그다음」인 카테고리.
 *
 * 독서나눔은 번개로 시작할 수 없다. 누가 호스트로 나서서 날짜를 잡는 게 아니라,
 * 할 사람이 몇 명 모이고 나서 그 사람들끼리 상의해 모임을 만든다.
 * 그래서 이 명단은 모임이 아니라 카테고리에 붙는다.
 *
 * 목표 인원은 lib/categories.ts의 signup.target이 정한다 — 몇 명이 있어야 굴러가는지는
 * 종목마다 다르고, 그건 코드가 아니라 그 종목을 아는 사람이 정할 값이다.
 */

const N = {
  reached: {
    ko: '📚 {cat} {n}명이 모였어요! 이제 모임 날짜를 정해봐요',
    en: '📚 {cat} — {n} people are in! Time to pick a date',
  },
  btn: { ko: '모임 만들기', en: 'Create the meetup' },
};

export interface SignupView {
  userId: string;
  name: string;
  avatar: string | null;
  createdAt: string;
}

/** 이 카테고리에 신청한 사람들 (신청한 순서대로) */
export async function listSignups(category: string): Promise<SignupView[]> {
  const db = await getDb();
  const rows = await db
    .select({
      userId: categorySignups.userId,
      createdAt: categorySignups.createdAt,
      kakaoName: users.kakaoName,
      nickname: users.nickname,
      avatar: users.avatar,
    })
    .from(categorySignups)
    .innerJoin(users, eq(users.id, categorySignups.userId))
    .where(eq(categorySignups.category, category))
    .orderBy(asc(categorySignups.createdAt));

  return rows.map((r) => ({
    userId: r.userId,
    name: resolveDisplayName(
      { kakaoName: r.kakaoName, ...(r.nickname ? { nickname: r.nickname } : {}), kakaoNameHistory: [] },
      r.kakaoName
    ),
    avatar: r.avatar,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * 신청 (이미 했으면 아무 일도 없다).
 *
 * 이 신청으로 목표 인원을 **처음 채웠을 때만** 알린다 — 그 뒤로 한 명 더 들어올 때마다
 * 「다 모였어요」가 또 가면 그 말이 아무 뜻도 없어진다.
 */
export async function addSignup(
  category: string,
  userId: string
): Promise<{ count: number; reached: boolean; full: boolean }> {
  const db = await getDb();
  const cfg = getCategory(category)?.signup;
  const before = await listSignups(category);

  /*
   * 정원을 넘겨 받지 않는다. 아홉 명이 신청해 두고 모임 정원이 일곱이면 두 명은
   * 모아 놓고 못 들어가는 셈이 된다 — 그건 명단이 할 일이 아니다.
   * 이미 신청한 사람이 또 눌렀을 때는 마감이어도 그대로 통과시킨다 (바뀌는 게 없다).
   */
  const already = before.some((s) => s.userId === userId);
  if (!already && cfg && before.length >= cfg.limit) {
    return { count: before.length, reached: false, full: true };
  }

  await db.insert(categorySignups).values({ category, userId }).onConflictDoNothing();
  const list = await listSignups(category);
  const target = cfg?.target ?? 0;
  return { count: list.length, reached: target > 0 && list.length === target, full: false };
}

export async function removeSignup(category: string, userId: string): Promise<number> {
  const db = await getDb();
  await db
    .delete(categorySignups)
    .where(and(eq(categorySignups.category, category), eq(categorySignups.userId, userId)));
  return (await listSignups(category)).length;
}

/**
 * 「다 모였어요」 알림 — 신청한 사람 전원에게.
 *
 * 구독자가 아니라 **신청한 사람들**에게 간다. 이건 「새 모임이 열렸다」가 아니라
 * 「당신이 신청한 그 일이 이제 굴러갈 수 있다」는 소식이라, 받을 사람이 다르다.
 */
export async function notifySignupReached(category: string, origin: string): Promise<number> {
  const db = await getDb();
  const list = await listSignups(category);
  if (list.length === 0) return 0;

  const localeRows = await db.select({ id: users.id, locale: users.locale }).from(users);
  const localeById = new Map(localeRows.map((r) => [r.id, toLocale(r.locale)]));
  const url = `${origin}/c/${category}`;

  // 언어별로 묶는다 — 인앱 문구는 insertInAppNotice가 알아서 하지만 푸시는 한 덩어리에 한 문장이다
  const byLocale = new Map<Locale, string[]>();
  for (const s of list) {
    const loc = localeById.get(s.userId) ?? 'ko';
    byLocale.set(loc, [...(byLocale.get(loc) ?? []), s.userId]);
  }

  /*
   * kind에 카테고리를 실어 보낸다 — 눌렀을 때 그 카테고리 화면으로 보내야 하는데,
   * 이 알림에는 걸어 둘 모임(postId)이 없다. kind는 자유 문자열 칸이라 이렇게 쓴다.
   */
  const kind = `${NOTIF.signup}:${category}`;

  let sent = 0;
  for (const [locale, userIds] of byLocale) {
    const message = pick(locale, N.reached as Msg, { cat: catName(category, locale), n: String(list.length) });
    await insertInAppNotice(userIds, null, kind, () => message);
    await sendPush(userIds, { title: 'Kansas Korean', body: message, url, tag: `signup:${category}` });
    sent += userIds.length;
  }
  return sent;
}
