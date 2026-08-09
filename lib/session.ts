import { cache } from 'react';
import { cookies } from 'next/headers';
import { getSessionUser, IMPERSONATOR_COOKIE, isAdmin, verifySessionToken } from './auth';
import { resolveDisplayName } from './store';
import { getLocale } from './locale';
import { dbGetUser } from './db/users';
import { toState, type BanState } from './db/bans';
import { unreadCount } from './db/posts';

/**
 * 화면을 그리는 데 필요한 「지금 보고 있는 사람」.
 *
 * 예전에는 /api/auth/me를 각자 불렀다 — 탭바, 정지 가리개, 대리 보기 띠, 알림 권유,
 * 그리고 페이지마다 하나씩. 한 번 열 때 여섯 번이 나갔고 답은 매번 같았다.
 * 이제 서버에서 한 번 읽어 레이아웃이 컨텍스트로 내려준다(app/session.tsx).
 *
 * cache로 감싸 두어서 레이아웃·페이지·generateMetadata가 같은 결과를 나눠 쓴다.
 */

export interface Viewer {
  user: { id: string; name: string } | null;
  nickname: string | null;
  /** 영어 이름 — 프로필에서 고치고, 한국어가 아닌 언어에서 이 이름이 먼저 나온다 */
  nameEn: string | null;
  avatar: string | null;
  venmo: string | null;
  zelle: string | null;
  kakaoName: string;
  birthday: string | null;
  gender: string | null;
  /** 생일이나 성별이 비어 있으면 온보딩(/welcome)으로 보낸다 */
  needsOnboarding: boolean;
  locale: string | null;
  isAdmin: boolean;
  /** 정지 중이면 남은 기간 — app/ban-screen.tsx가 이 값으로 타이머를 돌린다 */
  ban: BanState | null;
  /** 관리자가 테스트 계정으로 보는 중이면 원래 이름 */
  viewingAs?: { backTo: string };
  /** 안 읽은 알림 수 — 탭바 배지의 첫 값 */
  unread: number;
}

const EMPTY: Viewer = {
  user: null,
  nickname: null,
  nameEn: null,
  avatar: null,
  venmo: null,
  zelle: null,
  kakaoName: '',
  birthday: null,
  gender: null,
  needsOnboarding: false,
  locale: null,
  isAdmin: false,
  ban: null,
  unread: 0,
};

export const getViewer = cache(async (): Promise<Viewer> => {
  const user = await getSessionUser();
  // 관리자가 테스트 계정으로 보는 중이면 원래 세션이 쿠키에 남아 있다
  const realUser = verifySessionToken((await cookies()).get(IMPERSONATOR_COOKIE)?.value);
  if (!user) return EMPTY;

  const [row, unread, locale] = await Promise.all([dbGetUser(user.id), unreadCount(user.id), getLocale()]);
  const profile = row
    ? {
        kakaoName: row.kakaoName,
        ...(row.nickname ? { nickname: row.nickname } : {}),
        ...(row.nameEn ? { nameEn: row.nameEn } : {}),
        kakaoNameHistory: [],
      }
    : undefined;

  /*
   * 칸을 하나씩 골라 담는다. row를 그대로 펼치면 안 된다 —
   * 거기에는 카카오 액세스·리프레시 토큰이 들어 있고, 이 값은 RSC 페이로드로
   * 브라우저까지 그대로 간다. 칸이 늘어날 때마다 여기서 다시 정해야 한다.
   */
  return {
    user: { id: user.id, name: resolveDisplayName(profile, user.name, locale) },
    nickname: row?.nickname ?? null,
    nameEn: row?.nameEn ?? null,
    avatar: row?.avatar ?? null,
    venmo: row?.venmo ?? null,
    zelle: row?.zelle ?? null,
    kakaoName: row?.kakaoName || user.name,
    birthday: row?.birthday ?? null,
    gender: row?.gender ?? null,
    needsOnboarding: !row?.birthday || !row?.gender,
    locale: row?.locale ?? null,
    isAdmin: isAdmin(user),
    ban: toState(row?.bannedUntil ?? null, row?.banReason ?? null),
    ...(realUser ? { viewingAs: { backTo: realUser.name } } : {}),
    unread,
  };
});
