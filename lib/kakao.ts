// 카카오톡 "나에게 보내기"(memo) 발송 — 모임 알림을 각자의 "나와의 채팅"으로 전달.
// talk_message 동의 + 저장된 토큰이 있는 사용자에게만 보내고, 실패해도 호출부 흐름을 막지 않는다.

import { dbGetUser, dbSaveKakaoTokens } from './db/users';

interface KakaoTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

/** 로그인 콜백의 토큰 응답을 저장. scope에 talk_message가 있는지도 함께 기록. */
export async function saveKakaoTokens(userId: string, token: KakaoTokenResponse): Promise<void> {
  const talkMessage =
    typeof token.scope === 'string' ? token.scope.split(' ').includes('talk_message') : undefined;
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

async function getValidAccessToken(userId: string): Promise<string | null> {
  const row = await dbGetUser(userId);
  if (!row || row.kakaoTalkMessage === false) return null; // 명시적 미동의만 제외
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

async function sendMemo(accessToken: string, text: string, linkUrl: string): Promise<Response> {
  const template = {
    object_type: 'text',
    text,
    link: { web_url: linkUrl, mobile_web_url: linkUrl },
    button_title: '모임 보기',
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

/**
 * 여러 사용자에게 카톡 메모 발송. 토큰 없음/미동의는 건너뛰고,
 * 개별 실패는 로그만 남긴다 (인앱 알림은 이미 저장된 상태).
 */
export async function sendKakaoMemos(userIds: string[], text: string, linkUrl: string): Promise<void> {
  await Promise.allSettled(
    userIds.map(async (userId) => {
      try {
        const token = await getValidAccessToken(userId);
        if (!token) return;
        const res = await sendMemo(token, text, linkUrl);
        if (!res.ok) {
          console.error('[kakao-memo] send failed:', userId.slice(-4), res.status, await res.text());
        }
      } catch (e) {
        console.error('[kakao-memo] send error:', userId.slice(-4), e);
      }
    })
  );
}
