/**
 * 파일 받기 — **화면을 안 떠나고.**
 *
 * 주소를 그냥 눌러 열게 두면 폰에서 앱이 통째로 그 주소로 넘어간다. 홈 화면에 추가한
 * 앱에는 주소창도 뒤로가기도 없어서, 넘어간 뒤에는 돌아올 길이 없다 — 앱을 껐다 켜야
 * 한다. 저장소 주소든 우리 주소든 마찬가지다: 문제는 도메인이 아니라 **넘어간다는 것**이다.
 *
 * 그래서 누르는 것이 이동이 아니게 만든다. 파일을 먼저 받아 메모리에 들고,
 *
 *   1. 공유 시트가 있으면 그걸 연다 (아이폰). 시트는 앱 위에 뜨는 창이라 닫으면 제자리고,
 *      「이미지 저장」이면 사진 앱으로 바로 간다 — 폰에서 사람들이 원하는 게 이거다.
 *   2. 없으면 blob 주소를 만들어 <a download>를 눌러 준다 (데스크톱).
 *
 * 둘 다 페이지를 안 옮긴다.
 */

export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/** 이 기기가 파일 공유 시트를 열 수 있는지 — 아이폰·안드로이드는 되고 데스크톱은 대개 안 된다 */
function canShareFile(file: File): boolean {
  try {
    return typeof navigator !== 'undefined' && Boolean(navigator.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
}

/** blob 주소를 만들어 눌러 준다. 페이지는 그대로 있는다 */
function clickDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 곧바로 거두면 받기가 시작되기 전에 주소가 사라지는 브라우저가 있다
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

/** 받아서 저장한다. 던지면 부르는 쪽이 문구를 보여준다 */
export async function saveFile(url: string, fallbackName: string): Promise<SaveResult> {
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok) throw new Error(String(res.status));
  const filename = nameFromHeader(res, fallbackName);
  const blob = await res.blob();

  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      // 사용자가 시트를 닫은 것은 실패가 아니다 — 다시 받기로 밀어붙이지 않는다
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      /*
       * 그 밖의 실패는 대개 「누른 지 오래돼서 시트를 못 연다」다(파일을 받아오는 동안
       * 시간이 지난다). 그때는 아래 받기로 내려간다 — 아무 일도 안 일어나는 것보다 낫다.
       */
    }
  }

  clickDownload(blob, filename);
  return 'downloaded';
}
