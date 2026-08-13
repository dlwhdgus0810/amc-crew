import { del, issueSignedToken, presignUrl, type IssuedSignedToken } from '@vercel/blob';

/**
 * 저장소 다루기. 서버 전용.
 *
 * 스토어가 비공개다. 주소를 알아도 서명 없이는 403이라, 비공개 모임 사진이 링크만으로
 * 열리는 일이 없다 — 대신 화면에 그릴 때마다 서명한 주소를 만들어 줘야 한다.
 */

/**
 * 파일 지우기.
 *
 * 언제나 삼킨다. 사진 행은 이미 지워졌거나 모임이 사라진 뒤에 부르는 자리라, 여기서 던지면
 * 「지웠는데 실패했다고 나온다」가 된다. 못 지운 파일은 주인 없이 남고,
 * 그건 청소(app/api/admin/blob-sweep)가 걷어간다.
 *
 * 순서는 부르는 쪽이 지킨다: **행을 먼저 지우고 그다음 파일**이다. 반대로 하면 삭제가
 * 도중에 실패했을 때 없는 파일을 가리키는 행이 남아 영영 깨진 그림으로 보인다.
 */
export async function deleteBlobs(urls: string[]): Promise<void> {
  const list = urls.filter(Boolean);
  if (list.length === 0) return;
  try {
    await del(list);
  } catch (e) {
    console.error('[blob] 삭제 실패 (청소가 걷어간다):', e instanceof Error ? e.message : e);
  }
}

/*
 * 서명에 쓰는 위임 토큰.
 *
 * 발급은 네트워크를 타지만(재 보니 109ms) 한 번 받아 두면 그걸로 몇 장이든 로컬에서
 * 서명한다(장당 0.12ms). 그래서 토큰만 한 시간 가까이 들고 있는다 — 사진 한 장마다
 * 발급하면 목록 한 번에 열두 번씩 네트워크를 타게 된다.
 *
 * 프로세스 안에 두는 캐시라 서버 인스턴스마다 따로 받는다. 그 정도면 충분하다.
 */
const TOKEN_TTL_MS = 50 * 60 * 1000;
/** 서명 URL이 살아 있는 시간. 짧으면 열어 둔 화면의 사진이 금세 깨진다 */
const URL_TTL_MS = 6 * 60 * 60 * 1000;

let cached: { token: IssuedSignedToken; until: number } | null = null;

async function delegation(): Promise<IssuedSignedToken | null> {
  if (cached && cached.until > Date.now()) return cached.token;
  try {
    const token = await issueSignedToken({
      pathname: '*',
      operations: ['get'],
      validUntil: Date.now() + URL_TTL_MS,
    });
    cached = { token, until: Date.now() + TOKEN_TTL_MS };
    return token;
  } catch (e) {
    console.error('[blob] 서명 토큰 발급 실패:', e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 저장해 둔 pathname을 화면에서 열 수 있는 주소로 바꾼다.
 *
 * 못 만들면 null이다 — 그러면 화면은 사진 자리를 아예 그리지 않는다. 깨진 그림을 띄우는
 * 것보다 낫다.
 */
export async function signedUrls(pathnames: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(pathnames.filter(Boolean))];
  if (unique.length === 0) return out;

  const token = await delegation();
  if (!token) return out;

  for (const pathname of unique) {
    try {
      const r = await presignUrl(token, { operation: 'get', pathname, access: 'private' });
      if (r?.presignedUrl) out.set(pathname, r.presignedUrl);
    } catch {
      /* 한 장이 실패해도 나머지는 보여준다 */
    }
  }
  return out;
}

/** 한 장짜리 편의 함수 */
export async function signedUrl(pathname: string | null | undefined): Promise<string | null> {
  if (!pathname) return null;
  return (await signedUrls([pathname])).get(pathname) ?? null;
}
