/**
 * 파일 받기 — **화면을 안 떠나고.**
 *
 * 주소를 그냥 눌러 열게 두면 폰에서 앱이 통째로 그 주소로 넘어간다. 홈 화면에 추가한
 * 앱에는 주소창도 뒤로가기도 없어서, 넘어간 뒤에는 돌아올 길이 없다 — 앱을 껐다 켜야
 * 한다. 저장소 주소든 우리 주소든 마찬가지고, <a download>도 거기서는 무시된다.
 * 문제는 도메인이 아니라 **넘어간다는 것**이다.
 *
 * 그래서 누르는 것이 이동이 아니게 만든다. 파일을 먼저 받아 메모리에 들고,
 *
 *   1. 공유 시트가 있으면 그걸 연다 (폰). 시트는 앱 위에 뜨는 창이라 닫으면 제자리고,
 *      「이미지 저장」이면 사진 앱으로 바로 간다 — 폰에서 사진에 대해 원하는 게 이거다.
 *      여러 장이면 「n장의 이미지 저장」이 되어 한 번에 사진 앱으로 들어간다.
 *   2. 없으면 blob 주소를 만들어 눌러 준다 (데스크톱). 여러 장이면 여러 번 누른다.
 *
 * 둘 다 페이지를 안 옮긴다.
 */

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/** 공유 시트를 못 열었다 — 부르는 쪽이 「저장하기」를 한 번 더 내밀어야 한다 */
export class ShareNotAllowedError extends Error {}

/** 이 기기가 이 파일들로 공유 시트를 열 수 있는지 — 폰은 되고 데스크톱은 대개 안 된다 */
export function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator !== 'undefined' && Boolean(navigator.canShare?.({ files }));
  } catch {
    return false;
  }
}

/**
 * 서버가 적어 보낸 파일 이름. 이름을 아는 것은 서버뿐이다 — 확장자가 jpg인지 png인지도,
 * 어느 모임 사진인지도 거기서 정한다. 공유 시트로 갈 때는 이 헤더를 아무도 안 읽으므로
 * (File에 적힌 이름만 쓰인다) 여기서 꺼내 옮겨 준다.
 */
function nameFromHeader(res: Response, fallback: string): string {
  const cd = res.headers.get('content-disposition');
  const m = cd ? /filename="([^"]+)"/.exec(cd) : null;
  return m?.[1] || fallback;
}

/**
 * 주소들을 파일로 받아 온다.
 *
 * **한 장씩 차례로 받는다.** 서른 장을 한꺼번에 던지면 폰 회선에서 서로 막혀 진행률이
 * 거짓말이 되고, 어디까지 됐는지도 알 수 없다 (사진 올리기가 같은 이유로 그렇게 한다).
 */
export async function fetchFiles(
  urls: string[],
  fallbackName: (i: number) => string,
  onProgress?: (done: number, total: number) => void
): Promise<File[]> {
  const out: File[] = [];
  for (let i = 0; i < urls.length; i++) {
    const res = await fetch(urls[i]!, { credentials: 'same-origin' });
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    out.push(
      new File([blob], nameFromHeader(res, fallbackName(i)), {
        type: blob.type || 'application/octet-stream',
      })
    );
    onProgress?.(i + 1, urls.length);
  }
  return out;
}

/**
 * 공유 시트를 연다.
 *
 * 시트는 **누른 직후에만** 열 수 있다(브라우저가 그렇게 막는다). 사진을 여러 장 받아
 * 오느라 몇 초가 지나면 그 자격이 풀려서 거부당하는데, 그건 고장이 아니라 규칙이다 —
 * 그때는 ShareNotAllowedError로 알리고, 부르는 쪽이 「저장하기」를 한 번 더 내민다.
 * 그 두 번째 누름은 갓 누른 것이라 시트가 열린다.
 */
export async function shareFiles(files: File[]): Promise<SaveResult> {
  try {
    await navigator.share({ files });
    return 'shared';
  } catch (e) {
    // 사용자가 시트를 닫은 것은 실패가 아니다 — 다시 받기로 밀어붙이지 않는다
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
    throw new ShareNotAllowedError();
  }
}

/**
 * blob 주소를 만들어 눌러 준다. 페이지는 그대로 있는다.
 *
 * 여러 장이면 사이를 조금 띄운다. 붙여서 쏘면 브라우저가 뒤엣것을 「원치 않는 받기」로
 * 보고 조용히 버린다.
 */
export function downloadFiles(files: File[]): void {
  files.forEach((file, i) => {
    setTimeout(() => {
      const url = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // 곧바로 거두면 받기가 시작되기 전에 주소가 사라지는 브라우저가 있다
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }, i * 250);
  });
}

/** 한 장 — 받아서 공유 시트나 받기로 넘긴다. 한 장은 금세 받아 와서 시트가 그대로 열린다 */
export async function saveFile(url: string, fallbackName: string): Promise<SaveResult> {
  const files = await fetchFiles([url], () => fallbackName);
  if (canShareFiles(files)) {
    try {
      return await shareFiles(files);
    } catch {
      /* 시트를 못 열면 아래 받기로 내려간다 — 아무 일도 안 일어나는 것보다 낫다 */
    }
  }
  downloadFiles(files);
  return 'downloaded';
}
