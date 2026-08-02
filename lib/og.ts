/**
 * 링크 미리보기 이미지(OG)용 공통 부분.
 *
 * 카톡·문자에 링크를 붙이면 뜨는 그 카드다. 화면에 쓰는 웹폰트는 브라우저용이라
 * 여기서는 못 쓴다 — 이미지를 그리는 쪽(satori)은 폰트 파일 자체를 받아야 한다.
 *
 * 한글 폰트는 통째로 받으면 몇 MB라 함수에 넣을 수 없다. 그래서 그릴 글자만 적어
 * 잘라 달라고 요청한다(Google Fonts의 text= 옵션) — 보통 몇 KB로 끝난다.
 */

/** 이미지 크기 — 카톡·트위터·슬랙이 다 쓰는 규격 */
export const OG_SIZE = { width: 1200, height: 630 };

/** 배경색 위에 얹는 글자색 (카테고리 fg를 그대로 쓴다) */
export interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: 'normal';
}

const FAMILY = 'IBM Plex Sans KR';

/**
 * 그릴 글자만 담은 폰트를 받아온다.
 *
 * 실패하면 null — 그때는 기본 폰트로 그려진다(한글은 네모로 보이지만, 이미지가
 * 통째로 안 나오는 것보다는 낫다). 링크 미리보기 때문에 공유 자체가 막히면 안 된다.
 */
export async function loadFont(text: string, weight: 400 | 700): Promise<OgFont | null> {
  try {
    // 중복 글자를 빼면 주소가 짧아진다 (URL 길이 제한에 걸리지 않게)
    const chars = [...new Set(text)].join('');
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(FAMILY)}:wght@${weight}&text=${encodeURIComponent(chars)}`;
    /*
     * User-Agent를 보내지 않으면 woff2 대신 ttf를 준다. satori는 woff2를 못 읽는다.
     * (문서화된 동작은 아니라, 어느 날 바뀌면 아래 정규식이 못 찾고 null로 떨어진다)
     */
    const css = await fetch(cssUrl, { next: { revalidate: 60 * 60 * 24 } }).then((r) => r.text());
    const url = css.match(/src:\s*url\(([^)]+)\)\s*format\('truetype'\)/)?.[1];
    if (!url) return null;
    const data = await fetch(url, { next: { revalidate: 60 * 60 * 24 } }).then((r) => r.arrayBuffer());
    return { name: FAMILY, data, weight, style: 'normal' };
  } catch {
    return null;
  }
}

/** 두 굵기를 한 번에 (제목은 굵게, 나머지는 보통) */
export async function loadFonts(text: string): Promise<OgFont[]> {
  const both = await Promise.all([loadFont(text, 700), loadFont(text, 400)]);
  return both.filter((f): f is OgFont => f !== null);
}
