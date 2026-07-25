// 카카오톡 "나에게 보내기"(memo) 발송 — 모임 알림을 각자의 "나와의 채팅"으로 전달.
// talk_message 동의 + 저장된 토큰이 있는 사용자에게만 보내고, 실패해도 호출부 흐름을 막지 않는다.

import { dbGetUser, dbSaveKakaoTokens, dbSetTalkMessage } from './db/users';

interface KakaoTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/** 카카오 동의 상태: on=동의, off=미동의, unknown=확인 불가(토큰 없음/호출 실패) */
export type TalkMessageStatus = 'on' | 'off' | 'unknown';

const TALK_MESSAGE_SCOPE = 'talk_message';

/** 로그인 콜백의 토큰 응답을 저장. scope에 talk_message가 있는지도 함께 기록. */
export async function saveKakaoTokens(userId: string, token: KakaoTokenResponse): Promise<void> {
  const talkMessage =
    typeof token.scope === 'string' ? token.scope.split(' ').includes(TALK_MESSAGE_SCOPE) : undefined;
  await dbSaveKakaoTokens(userId, {
    accessToken: token.access_token,
    expiresAt: new Date(Date.now() + (token.expires_in ?? 0) * 1000),
    refreshToken: token.refresh_token,
    talkMessage,
  });
}

async function refreshAccessToken(userId: string, refreshToken: string): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: process.env.KAKAO_REST_API_KEY ?? '',
    refresh_token: refreshToken,
  });
  if (process.env.KAKAO_CLIENT_SECRET) body.set('client_secret', process.env.KAKAO_CLIENT_SECRET);

  const res = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body,
  });
  if (!res.ok) {
    console.error('[kakao-memo] token refresh failed:', userId.slice(-4), res.status, await res.text());
    return null;
  }
  const data: KakaoTokenResponse = await res.json();
  // 리프레시 토큰은 만료 임박 시에만 새로 내려온다
  await dbSaveKakaoTokens(userId, {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in ?? 0) * 1000),
    refreshToken: data.refresh_token,
  });
  return data.access_token;
}

type UserRow = Awaited<ReturnType<typeof dbGetUser>>;

/** 저장된 액세스 토큰을 쓰거나, 만료가 가까우면 리프레시한다. */
async function resolveAccessToken(userId: string, row: UserRow): Promise<string | null> {
  if (!row) return null;
  if (
    row.kakaoAccessToken &&
    row.kakaoTokenExpiresAt &&
    row.kakaoTokenExpiresAt.getTime() > Date.now() + 60_000
  ) {
    return row.kakaoAccessToken;
  }
  if (!row.kakaoRefreshToken) return null;
  return refreshAccessToken(userId, row.kakaoRefreshToken);
}

/** 발송용 토큰. 명시적 미동의(false)는 제외한다 (null=미확인은 시도 → 자기치유가 정정). */
async function getValidAccessToken(userId: string): Promise<string | null> {
  const row = await dbGetUser(userId);
  if (!row || row.kakaoTalkMessage === false) return null;
  return resolveAccessToken(userId, row);
}

/**
 * 동의 확인·철회용 토큰. 동의 플래그를 보지 않는다 —
 * false로 기록된 사용자도 상태를 재확인할 수 있어야 하기 때문.
 */
export async function getUsableAccessToken(userId: string): Promise<string | null> {
  return resolveAccessToken(userId, await dbGetUser(userId));
}

/**
 * 카카오에 등록된 동의 항목을 조회해 talk_message 동의 여부를 반환.
 * null이면 조회 실패(확인 불가). 항목 자체가 없으면(콘솔 미등록) false.
 */
export async function fetchTalkMessageAgreed(accessToken: string): Promise<boolean | null> {
  const res = await fetch('https://kapi.kakao.com/v2/user/scopes', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error('[kakao-memo] scopes lookup failed:', res.status, await res.text());
    return null;
  }
  const data = await res.json();
  const scopes: { id?: string; agreed?: boolean }[] = Array.isArray(data?.scopes) ? data.scopes : [];
  const entry = scopes.find((s) => s.id === TALK_MESSAGE_SCOPE);
  if (!entry) {
    // 카카오 콘솔 동의항목에 talk_message가 등록돼 있지 않은 상태
    console.warn('[kakao-memo] talk_message scope is not registered for this app');
    return false;
  }
  return entry.agreed === true;
}

/** 신선한 액세스 토큰이 있는 콜백에서 사용: 동의 상태 조회 후 DB에 기록. */
export async function recordTalkMessageConsent(
  userId: string,
  accessToken: string
): Promise<TalkMessageStatus> {
  const agreed = await fetchTalkMessageAgreed(accessToken);
  if (agreed === null) return 'unknown';
  await dbSetTalkMessage(userId, agreed);
  return agreed ? 'on' : 'off';
}

/** API 라우트용: 토큰 확보 → 동의 상태 조회 → DB 기록. */
export async function verifyTalkMessageConsent(
  userId: string
): Promise<{ status: TalkMessageStatus; reason?: 'token' | 'kakao' }> {
  const token = await getUsableAccessToken(userId);
  if (!token) return { status: 'unknown', reason: 'token' };
  const status = await recordTalkMessageConsent(userId, token);
  return status === 'unknown' ? { status, reason: 'kakao' } : { status };
}

/** talk_message 동의 철회 (앱 안에서 카톡 알림 끄기). */
export async function revokeTalkMessageConsent(
  userId: string
): Promise<{ ok: boolean; reason?: 'token' | 'kakao' }> {
  const token = await getUsableAccessToken(userId);
  if (!token) return { ok: false, reason: 'token' };

  const res = await fetch('https://kapi.kakao.com/v2/user/revoke/scopes', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({ scopes: JSON.stringify([TALK_MESSAGE_SCOPE]) }),
  });
  if (!res.ok) {
    console.error('[kakao-memo] revoke failed:', userId.slice(-4), res.status, await res.text());
    return { ok: false, reason: 'kakao' };
  }
  await dbSetTalkMessage(userId, false);
  return { ok: true };
}

/** 카카오 메모 버튼 기본 라벨 — 대부분의 알림이 모임으로 연결된다 */
const DEFAULT_BUTTON_TITLE = '모임 보기';

async function sendMemo(
  accessToken: string,
  text: string,
  linkUrl: string,
  buttonTitle: string
): Promise<Response> {
  const template = {
    object_type: 'text',
    text,
    link: { web_url: linkUrl, mobile_web_url: linkUrl },
    button_title: buttonTitle,
  };
  return fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
    },
    body: new URLSearchParams({ template_object: JSON.stringify(template) }),
  });
}

/** 카카오 에러 응답의 code 필드 (파싱 실패 시 null) */
function kakaoErrorCode(body: string): number | null {
  try {
    const code = JSON.parse(body)?.code;
    return typeof code === 'number' ? code : null;
  } catch {
    return null;
  }
}

/**
 * 여러 사용자에게 카톡 메모 발송. 토큰 없음/미동의는 건너뛰고,
 * 개별 실패는 로그만 남긴다 (인앱 알림은 이미 저장된 상태).
 * buttonTitle로 링크 버튼 문구를 맞출 수 있다 (기본: 모임 보기).
 */
export async function sendKakaoMemos(
  userIds: string[],
  text: string,
  linkUrl: string,
  buttonTitle: string = DEFAULT_BUTTON_TITLE
): Promise<void> {
  await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        const token = await getValidAccessToken(userId);
        if (!token) return;
        const res = await sendMemo(token, text, linkUrl, buttonTitle);
        if (res.ok) return;

        const body = await res.text();
        console.error('[kakao-memo] send failed:', userId.slice(-4), res.status, body);
        // 403 + code -402 = 동의(scope) 없음 → 상태를 정정해 UI가 실제와 맞게 한다.
        // 401(토큰 무효)·5xx·네트워크는 일시적일 수 있으므로 상태를 건드리지 않는다.
        if (res.status === 403 && kakaoErrorCode(body) === -402) {
          await dbSetTalkMessage(userId, false).catch((e) =>
            console.error('[kakao-memo] consent flag reset failed:', userId.slice(-4), e)
          );
        }
      } catch (e) {
        console.error('[kakao-memo] send error:', userId.slice(-4), e);
      }
    })
  );
}
