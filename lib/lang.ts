import { Locale } from './i18n';

/**
 * 「이 글이 읽는 사람의 언어와 다른가」를 눈대중으로 가린다.
 *
 * 언어 감지 API를 따로 부르지 않는다. 이 앱에 올라오는 글은 한국어 아니면 로마자 둘 중
 * 하나이고, 한글은 유니코드 블록 하나로 딱 떨어진다 — 그걸 보는 것만으로 「번역 보기」를
 * 띄울지 말지는 충분히 정해진다. 틀려도 손해가 크지 않다: 없어야 할 줄이 하나 뜨거나,
 * 있어야 할 줄이 안 뜨거나다. 값을 치르는 것은 사람이 그 줄을 눌렀을 때뿐이다.
 *
 * DB를 import하지 않는다 — 화면(클라이언트 컴포넌트)이 읽는다.
 */

/** 한글 음절·자모 (가~힣, ㄱ~ㆍ) */
const HANGUL = /[가-힣ㄱ-ㆎ]/;
/** 로마자 */
const LATIN = /[A-Za-z]/;

/**
 * 번역 줄을 띄울 만한 글인가.
 *
 * 한국어로 보는 사람에게는 한글이 없고 로마자가 있는 글에, 그 밖의 언어로 보는 사람에게는
 * 한글이 있는 글에 띄운다. 「7시 OK」처럼 둘이 섞였으면 한글 쪽으로 친다 — 읽는 데
 * 걸리는 것은 한글이라서다.
 *
 * 숫자·이모지·기호만 있는 글("👍", "6:30")은 번역할 것이 없으므로 뺀다.
 */
export function translatable(text: string | null | undefined, viewer: Locale): boolean {
  if (!text) return false;
  const t = text.trim();
  if (t.length < 2) return false;
  const hangul = HANGUL.test(t);
  const latin = LATIN.test(t);
  if (viewer === 'ko') return !hangul && latin;
  return hangul;
}
