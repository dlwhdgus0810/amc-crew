import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { resolveDisplayName } from '@/lib/store';
import { dbGetUser, dbUpdateProfile, ensureUser } from '@/lib/db/users';
import { todayLocal } from '@/lib/dates';
import { regionOfRequest } from '@/lib/region-server';
import { isLocale, Locale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/lib/i18n';
import { getLocale } from '@/lib/locale';

export const dynamic = 'force-dynamic';

/** 브라우저에서 줄여 보낸 사진만 받는다 (형식·크기 모두 서버에서 다시 확인) */
const AVATAR_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
/** base64 기준 상한 — 256px로 줄이면 보통 30KB 안쪽이라 넉넉하다 */
const AVATAR_MAX_CHARS = 400_000;

/** 영어 이름에 허용하는 글자 — 로마자와 이름에 실제로 쓰이는 구두점만 */
const NAME_EN = /^[A-Za-z][A-Za-z .'-]*$/;

/**
 * Venmo 아이디 자리에 들어오면 안 되는 말들.
 *
 * Venmo를 안 쓰는 분이 이 칸에 「Zelle」이라고 적은 일이 있었다. 아이디로서는 멀쩡한
 * 글자라 형식 검사를 그대로 통과했고, 정산 알림의 보내기 링크가 venmo.com/Zelle —
 * 즉 그 아이디를 쓰는 남의 계정으로 갔다. 돈이 잘못 갈 수 있는 자리라 이름 몇 개는 막는다.
 *
 * 비교는 소문자 + 밑줄·하이픈을 뗀 뒤에 한다(Zelle_, zelle-pay 아닌 z_e 같은 변형).
 * 한국어로 「없음」이라고 적는 경우는 위 형식 검사에서 이미 걸리므로 여기 없다.
 *
 * 목록은 짧게 둔다 — 결제 앱 이름과 「없다」는 말뿐이다. 넓힐수록 진짜 자기 아이디가
 * 그 단어인 사람을 막게 되고, 그건 이 검사가 막으려던 것보다 더 나쁘다.
 */
const NOT_A_VENMO_ID = new Set([
  'zelle', 'venmo', 'paypal', 'cashapp', 'applepay',
  'none', 'na', 'null', 'nothing', 'noaccount',
]);

/** 프로필 부분 업데이트: 닉네임·영어 이름(빈 값이면 해제) / 생년월일 / 성별 / 언어 */
export async function PUT(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return await errJson(E.loginRequired, 401);
  }
  const banned = await banGuard(user);
  if (banned) return banned;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return await errJson(E.badRequest, 400);
  }

  const patch: { nickname?: string | null; nameEn?: string | null; birthday?: string; gender?: string; locale?: Locale; avatar?: string | null; venmo?: string | null; zelle?: string | null } = {};

  if (body.venmo !== undefined) {
    const venmo = typeof body.venmo === 'string' ? body.venmo.trim().replace(/^@/, '') : '';
    // 딥링크 주소에 그대로 들어가는 값이라 문자 종류를 좁게 잡는다
    if (venmo && !/^[A-Za-z0-9_-]{1,30}$/.test(venmo)) {
      return await errJson(E.venmoId, 400);
    }
    /*
     * 아이디 대신 「Zelle」·「없음」 같은 말을 적는 경우를 막는다.
     * 글자로는 멀쩡한 아이디라 위 검사를 통과하는데, 그 값으로 만든 정산 링크는
     * 실제로 그 아이디를 쓰는 남의 Venmo 계정으로 간다 (실제로 한 번 그랬다).
     */
    if (venmo && NOT_A_VENMO_ID.has(venmo.toLowerCase().replace(/[_-]/g, ''))) {
      return await errJson(E.venmoNotId, 400);
    }
    patch.venmo = venmo || null;
  }

  if (body.zelle !== undefined) {
    const zelle = typeof body.zelle === 'string' ? body.zelle.trim() : '';
    // 전화번호나 이메일 — 화면에 띄워 복사시키는 값이라 형식만 느슨하게 본다
    if (zelle && (zelle.length > 60 || !/^[\w.@+\-() ]+$/.test(zelle))) {
      return await errJson(E.zelleId, 400);
    }
    patch.zelle = zelle || null;
  }

  if (body.nickname !== undefined) {
    if (typeof body.nickname !== 'string') {
      return await errJson(E.nicknameBad, 400);
    }
    const nickname = body.nickname.trim();
    if (nickname.length > 20) {
      return await errJson(E.nickname, 400);
    }
    patch.nickname = nickname || null;
  }

  /*
   * 영어 이름.
   *
   * 글자 종류를 좁게 잡는다 — 한글을 여기에 적어 두면 영어로 보는 사람 화면에서
   * 이 칸이 하려던 일을 정확히 못 하게 된다. 빈 값이면 지운다.
   */
  if (body.nameEn !== undefined) {
    if (typeof body.nameEn !== 'string') {
      return await errJson(E.nameEnBad, 400);
    }
    // 가운데 두 칸 띄어쓰기 같은 것은 조용히 한 칸으로 모은다
    const nameEn = body.nameEn.trim().replace(/\s+/g, ' ');
    if (nameEn.length > 30) {
      return await errJson(E.nameEn, 400);
    }
    if (nameEn && !NAME_EN.test(nameEn)) {
      return await errJson(E.nameEnBad, 400);
    }
    patch.nameEn = nameEn || null;
  }

  if (body.birthday !== undefined) {
    const birthday = typeof body.birthday === 'string' ? body.birthday : '';
    const [y, m, d] = birthday.split('-').map(Number);
    const parsed = new Date(y, (m ?? 1) - 1, d ?? 1);
    const isRealDate =
      /^\d{4}-\d{2}-\d{2}$/.test(birthday) &&
      parsed.getFullYear() === y &&
      parsed.getMonth() === m - 1 &&
      parsed.getDate() === d;
    if (!isRealDate || birthday < '1900-01-01' || birthday > todayLocal(regionOfRequest(req))) {
      return await errJson(E.birthday, 400);
    }
    patch.birthday = birthday;
  }

  if (body.gender !== undefined) {
    if (body.gender !== 'male' && body.gender !== 'female') {
      return await errJson(E.gender, 400);
    }
    patch.gender = body.gender;
  }

  if (body.locale !== undefined) {
    if (!isLocale(body.locale)) {
      return await errJson(E.locale, 400);
    }
    patch.locale = body.locale;
  }

  if (body.avatar !== undefined) {
    // 빈 값이면 사진을 내린다
    if (body.avatar === null || body.avatar === '') {
      patch.avatar = null;
    } else if (typeof body.avatar !== 'string' || !AVATAR_DATA_URL.test(body.avatar)) {
      return await errJson(E.avatarType, 400);
    } else if (body.avatar.length > AVATAR_MAX_CHARS) {
      return await errJson(E.avatarSize, 400);
    } else {
      patch.avatar = body.avatar;
    }
  }

  if (Object.keys(patch).length === 0) {
    return await errJson(E.noChange, 400);
  }

  await ensureUser(user); // 프로필 row가 없으면 세션의 카카오 닉네임으로 생성
  const profile = await dbUpdateProfile(user.id, patch);
  const row = await dbGetUser(user.id);
  const res = NextResponse.json({
    ok: true,
    /*
     * 방금 언어를 바꿨다면 그 언어로 답한다 — 쿠키는 이 응답에 실려 나가는 참이라
     * getLocale()이 읽으면 아직 바꾸기 전 값이다.
     */
    name: resolveDisplayName(profile, user.name, patch.locale ?? (await getLocale())),
    nickname: profile.nickname ?? null,
    nameEn: profile.nameEn ?? null,
    kakaoName: profile.kakaoName || user.name,
    birthday: row?.birthday ?? null,
    gender: row?.gender ?? null,
    locale: row?.locale ?? null,
    avatar: row?.avatar ?? null,
    venmo: row?.venmo ?? null,
    zelle: row?.zelle ?? null,
  });
  // 서버 렌더가 첫 화면부터 맞는 언어로 그려지도록 쿠키에도 반영
  if (patch.locale) {
    res.cookies.set(LOCALE_COOKIE, patch.locale, {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: LOCALE_COOKIE_MAX_AGE,
      path: '/',
    });
  }
  return res;
}
