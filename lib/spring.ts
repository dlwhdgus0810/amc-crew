import { REGIONS, type Region } from './region';

/**
 * 봄이 언제 오는가 — 홈 상태줄의 개화 값 (lib/statements.ts의 seasonStat).
 *
 * **USA-NPN의 Spring Index를 쓴다.** 라일락 하나와 인동 둘, 복제 품종 셋이 피는 날을
 * 평균한 값이다. 셋 다 전국 어디에 심어도 유전자가 같아서 피는 날짜 차이가 순전히 그
 * 자리의 기후 차이가 된다 — 그래서 「봄이 어디까지 왔나」를 재는 자로 쓴다.
 *
 * **벚나무가 아니다.** NPN에 벚나무 레이어는 없다(레이어 목록을 다 뒤졌다). 캔자스에서
 * 벚꽃은 이 셋보다 조금 이르다. 그래도 이걸 쓰는 값어치는 **해마다 봄이 이른지 늦은지를
 * 따라간다**는 것이다 — 날짜를 상수로 박으면 그게 없다.
 *
 * 출처를 밝혀야 한다. 프로필 맨 아래에 Open-Meteo와 나란히 적어 두었다.
 */

/** 올해 이 자리의 개화 예정일 (연중 몇 일째) */
const LAYER = 'si-x:average_bloom_ncep';

/**
 * 하루에 한 번만 받아 온다.
 *
 * NPN이 밤마다 다시 돌리는데, 나오는 값은 「올해 며칠째에 핀다」라 하루 안에서는 안
 * 바뀐다. 봄이 오는 동안에는 예보가 며칠씩 움직이므로 하루에 한 번은 물어본다.
 */
const REVALIDATE = 86400;
const TIMEOUT_MS = 2500;

/*
 * 점 하나를 물어보는 API가 따로 없어서 지도 조회(GetFeatureInfo)로 묻는다. 3×3 픽셀짜리
 * 그림을 요청하고 가운데 칸의 값을 받는 셈이다. 상자를 좌표 둘레로 아주 좁게 잡는다.
 */
const D = 0.02;
const url = (region: Region) => {
  const lat = Number(REGIONS[region].lat), lon = Number(REGIONS[region].lon);
  const q = new URLSearchParams({
    service: 'WMS',
    version: '1.1.1',
    request: 'GetFeatureInfo',
    layers: LAYER,
    query_layers: LAYER,
    srs: 'EPSG:4326',
    bbox: `${lon - D},${lat - D},${lon + D},${lat + D}`,
    width: '3',
    height: '3',
    x: '1',
    y: '1',
    info_format: 'application/json',
  });
  return `https://geoserver.usanpn.org/geoserver/wms?${q}`;
};

/**
 * 올해 개화 예정일 (연중 1~366). 못 받아 오면 null — 부르는 쪽이 고정값으로 돌아간다.
 *
 * 정식 API가 아니라 지도 조회라 응답 모양이 바뀔 수 있다. 그래서 값 하나까지 확인하고,
 * 조금이라도 어긋나면 null이다. 상태줄은 장식이라 이것 때문에 홈이 안 뜨면 안 된다.
 */
export async function springBloomDay(region: Region): Promise<number | null> {
  try {
    const res = await fetch(url(region), {
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { features?: { properties?: Record<string, unknown> }[] };
    const v = j.features?.[0]?.properties?.BLOOM_DAY;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 366) return null;
    return Math.round(v);
  } catch {
    return null;
  }
}
