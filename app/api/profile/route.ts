import { NextRequest, NextResponse } from 'next/server';
import { E, errJson } from '@/lib/apierr';
import { banGuard } from '@/lib/guard';
import { getSessionUser } from '@/lib/auth';
import { resolveDisplayName } from '@/lib/store';
import { dbGetUser, dbUpdateProfile, ensureUser } from '@/lib/db/users';
import { todayLocal } from '@/lib/dates';
import { isLocale, Locale, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/** 브라우저에서 줄여 보낸 사진만 받는다 (형식·크기 모두 서버에서 다시 확인) */
const AVATAR_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
/** base64 기준 상한 — 256px로 줄이면 보통 30KB 안쪽이라 넉넉하다 */
const AVATAR_MAX_CHARS = 400_000;

/** 프로필 부분 업데이트: 생년월일 / 성별 / 언어 / 사진 / 송금 정보 (이름은 카카오톡 것을 쓴다) */
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

  const patch: { birthday?: string; gender?: string; locale?: Locale; avatar?: string | null; venmo?: string | null; zelle?: string | null } = {};

  if (body.venmo !== undefined) {
    const venmo = typeof body.venmo === 'string' ? body.venmo.trim().replace(/^@/, '') : '';
    // 딥링크 주소에 그대로 들어가는 값이라 문자 종류를 좁게 잡는다
    if (venmo && !/^[A-Za-z0-9_-]{1,30}$/.test(venmo)) {
      return await errJson(E.venmoId, 400);
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

  if (body.birthday !== undefined) {
    const birthday = typeof body.birthday === 'string' ? body.birthday : '';
    const [y, m, d] = birthday.split('-').map(Number);
    const parsed = new Date(y, (m ?? 1) - 1, d ?? 1);
    const isRealDate =
      /^\d{4}-\d{2}-\d{2}$/.test(birthday) &&
      parsed.getFullYear() === y &&
      parsed.getMonth() === m - 1 &&
      parsed.getDate() === d;
    if (!isRealDate || birthday < '1900-01-01' || birthday > todayLocal()) {
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
    name: resolveDisplayName(profile, user.name),
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
