/**
 * 장소 텍스트를 지도 검색 링크로.
 *
 * 장소는 자유 입력이라("Monarch Coffee", "Swope Soccer Village Field 12", "우리집")
 * 좌표가 없다. 구글 지도 검색 URL은 키도 과금도 없이 이 문자열을 그대로 받아주고,
 * 폰에서는 지도 앱이 대신 열려 바로 길찾기로 넘어간다.
 */

/** 도시 이름이 빠진 장소에 붙여 줄 지역 (검색이 엉뚱한 주로 새지 않게) */
const REGION = process.env.NEXT_PUBLIC_MAPS_REGION ?? 'Kansas City';

/** 이미 지역이 적혀 있으면 REGION을 덧붙이지 않는다 — "대장금 Overland Park Kansas City"가 되면 오히려 안 나온다 */
const HAS_REGION =
  /\b(KS|MO|Kansas|Missouri|Overland Park|Leawood|Olathe|Lenexa|Shawnee|Prairie Village|Merriam)\b/i;

/**
 * 지도에서 열 수 있는 장소인지.
 * "우리집"처럼 개인적인 표현은 검색해 봐야 엉뚱한 곳이 나와서 링크를 걸지 않는다.
 */
const PERSONAL = /^(우리\s*집|저희\s*집|집|our place|my place|home)$/i;

export function isMappable(location: string): boolean {
  const s = location.trim();
  return s.length >= 2 && !PERSONAL.test(s);
}

/** 구글 지도 검색 URL (설치돼 있으면 지도 앱이 받아간다) */
export function mapsUrl(location: string): string {
  const s = location.trim();
  const query = HAS_REGION.test(s) ? s : `${s} ${REGION}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * 좌표 하나를 지도에서 여는 주소.
 *
 * 위의 mapsUrl은 사람이 쓴 장소 이름을 검색시키는 것이고, 이건 사진에 박혀 있던 좌표를
 * 그대로 찍어 준다 (여행 타임라인). 검색이 아니라 지점이라 REGION을 안 붙인다 —
 * 좌표에는 헤맬 여지가 없다.
 *
 * 소수점 다섯 자리면 1m 남짓이다. 그 아래는 GPS 자체가 못 맞추는 자리라 자릿수만 는다.
 */
export function mapsPointUrl(lat: number, lon: number, name?: string | null): string {
  const at = `${lat.toFixed(5)},${lon.toFixed(5)}`;
  /*
   * 이름을 아는 자리는 **이름으로 열되 그 점을 중심에 두고** 연다.
   *
   * 좌표만 주면 지도가 이름 없는 핀 하나를 떨어뜨린다 — 정확하긴 한데 「거기가 뭐였지」에
   * 답을 안 한다. 그렇다고 이름만 검색시키면 같은 이름의 다른 지점이 나온다.
   * @좌표를 붙이면 그 점 근처에서 그 이름을 찾으므로 둘 다 지킨다.
   */
  if (name?.trim()) return `https://www.google.com/maps/search/${encodeURIComponent(name.trim())}/@${at},17z`;
  return `https://www.google.com/maps/search/?api=1&query=${at}`;
}
