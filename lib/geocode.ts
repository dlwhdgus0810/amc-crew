/**
 * 좌표와 주소를 이름으로 바꾼다. 서버 전용.
 *
 * **두 길이 있고, 키가 있으면 좋은 길로 간다.**
 *
 *   GOOGLE_MAPS_API_KEY 있음 → 구글 Places에 「이 점에 뭐가 있나」를 묻는다. 가게 이름이
 *                              나온다 (「SomiSomi」). 못 찾으면 아래로 떨어진다.
 *   없음                    → OpenStreetMap Nominatim. 키도 결제 계정도 없이 쓰지만,
 *                              가게가 등록돼 있을 때만 이름이 나오고 대개 도시가 나온다.
 *
 * 구글에서 못 찾은 자리의 도시 이름은 그대로 Nominatim에서 받는다 — 구글 Nearby는
 * 「이 근처 업소」를 주는 것이라 허허벌판에서는 아무것도 안 준다. 두 길이 서로를 메운다.
 *
 * 물어보는 양이 작아서 어느 쪽이든 값이 안 든다: 여행 한 번에 자리 일곱 개 남짓이고
 * (사진 낱장이 아니라 자리마다 한 번), 1년에 스무 번을 가도 이백 번이다.
 *
 * **묻는 자리는 백필 하나뿐이다** (app/api/admin/photo-place). 화면을 그리면서 여기를
 * 부르면 안 된다: 초당 한 번 제한이 있고, 무엇보다 좌표는 안 변하니 한 번 묻고 DB에
 * 적어 두면 영영 다시 물을 일이 없다.
 *
 * 무엇이 나가는가: 좌표(사진에서 읽은 것)와 숙소 주소(사람이 쓴 것)가 OSM 서버로 나간다.
 * 그래서 여행 카테고리에서만, 관리자가 눌렀을 때만 부른다.
 */

import { configuredSiteUrl } from './site';

const BASE = 'https://nominatim.openstreetmap.org';
const GOOGLE_NEARBY = 'https://places.googleapis.com/v1/places:searchNearby';

/**
 * 이 이름을 어느 길로 얻었는지. DB의 place_source에 그대로 들어간다.
 *
 * 「어느 API가 이 글자를 만들었나」가 아니라 **「어느 파이프라인이 이 자리를 다 봤나」**다.
 * 구글에서 못 찾아 Nominatim의 도시 이름으로 떨어진 것도 'google'이다 — 구글까지
 * 물어본 자리라는 뜻이라야, 키가 생겼을 때 다시 물어볼 자리를 고를 수 있다.
 */
export type PlaceSource = 'osm' | 'google';

const googleKey = () => process.env.GOOGLE_MAPS_API_KEY?.trim() || null;

/** 지금 어느 길로 물어보는지 — 백필이 「다시 물어볼 자리」를 고를 때 쓴다 */
export function placePipeline(): PlaceSource {
  return googleKey() ? 'google' : 'osm';
}

/**
 * Nominatim 이용 정책이 요구하는 신원 표시. 이게 없으면 막힌다 — 선택이 아니다.
 * 남의 무료 서비스라 누가 쓰는지 밝히고 쓴다.
 */
// 운영자 식별용 — 어느 지역에서 부르든 같은 운영자다
const UA = `KansasKorean/1.0 (${configuredSiteUrl('kansas') ?? 'https://github.com/dlwhdgus0810/amc-crew'})`;

/** 정책상 초당 한 번. 넉넉히 잡는다 — 서두를 일이 아니다 */
const MIN_GAP_MS = 1_200;
/** 한 번 물어보고 이만큼 넘게 안 오면 포기한다. 백필이 통째로 멈추는 것보다 낫다 */
const TIMEOUT_MS = 8_000;

let lastCall = 0;

async function ask(path: string): Promise<unknown | null> {
  /*
   * 부르는 쪽이 순서대로 부른다는 전제다 (백필이 그렇다). 동시에 여러 개를 던지면
   * 이 간격이 안 지켜진다 — 그래서 아래 함수들을 Promise.all에 넣지 말 것.
   */
  const wait = lastCall + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[geocode] 응답이 안 좋다:', res.status);
      return null;
    }
    return await res.json();
  } catch (e) {
    // 못 물어본 것은 이름이 없는 것이다. 백필은 다음 자리로 넘어간다
    console.warn('[geocode] 못 물어봤다:', e instanceof Error ? e.message : e);
    return null;
  }
}

/* ── 좌표 → 이름 ────────────────────────────────────────────────────── */

/**
 * 「이름」으로 받아 줄 종류.
 *
 * 여기 없는 것에서 name을 가져오면 **길 이름이 딸려 온다.** 실제로 캔자스 시골에서
 * 「Texas Road」가 나왔다 — 진짜 있는 길 이름인데, 8/16 밤 자리에 그게 붙으면 아직
 * 텍사스에 있었다는 말이 된다. 없느니만 못한 이름이 어떻게 생기는지의 표본이라 적어 둔다.
 */
const NAMED_KINDS = new Set([
  'amenity',
  'shop',
  'tourism',
  'leisure',
  'historic',
  'office',
  'craft',
  'building',
  'club',
  'healthcare',
]);

interface NominatimAddress {
  shop?: string;
  amenity?: string;
  tourism?: string;
  leisure?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  suburb?: string;
  neighbourhood?: string;
  county?: string;
  state?: string;
  country_code?: string;
  ['ISO3166-2-lvl4']?: string;
}

/**
 * 좌표 하나의 이름. 못 찾으면 null.
 *
 * 두 가지 중 하나가 나온다:
 *  - 그 점이 가게·공원 같은 것 위에 떨어졌으면 그 이름 (「SomiSomi」)
 *  - 아니면 도시 (「The Colony, TX」)
 *
 * 가게 이름을 억지로 끌어오지 않는다. GPS가 50~100m씩 튀는데 반경을 넓혀 가장 가까운
 * 가게를 집으면 **옆 가게 이름이 붙는다.** 틀린 이름은 이름이 없느니만 못하다 —
 * 「어디였더라」는 사진을 보면 되지만 「Chase Bank에서 찍었네」는 기억을 덮어쓴다.
 * 그래서 그 점 위에 실제로 무엇이 있을 때만 이름을 받는다 (zoom=18).
 */
export async function placeName(lat: number, lon: number): Promise<{ name: string | null; source: PlaceSource }> {
  if (googleKey()) {
    const hit = await googlePlaceName(lat, lon);
    /*
     * **못 물어본 것과 못 찾은 것은 다르다.**
     *
     * 키가 막혀 있으면(웹사이트 제한이 걸린 키가 그렇다 — 서버 호출에는 리퍼러가 없다)
     * 구글은 한 자리도 못 본 것이다. 그걸 'google'로 적어 두면 키를 고친 뒤에 다시
     * 물어볼 자리가 하나도 안 남는다. 그래서 'osm'으로 적어 다음에 또 걸리게 둔다.
     *
     * 물어봤는데 없는 것(null)은 진짜 없는 것이다 — 고속도로 한복판이 그렇다.
     * 그건 'google'로 적어야 그 자리를 붙들고 영영 다시 묻지 않는다.
     */
    if (hit !== FAILED) {
      // 구글이 못 찾았으면 도시 이름이라도 — 허허벌판에서는 업소가 아예 없다
      return { name: hit ?? (await osmPlaceName(lat, lon)), source: 'google' };
    }
  }
  return { name: await osmPlaceName(lat, lon), source: 'osm' };
}

async function osmPlaceName(lat: number, lon: number): Promise<string | null> {
  const q = new URLSearchParams({
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'en',
  });
  const data = (await ask(`/reverse?${q}`)) as
    | { name?: string; category?: string; address?: NominatimAddress }
    | null;
  if (!data) return null;
  return shortLabel(data);
}

function shortLabel(d: { name?: string; category?: string; address?: NominatimAddress }): string | null {
  const a = d.address;
  /*
   * 점 위에 있는 것의 이름 — 있으면 이게 제일 좋다.
   * name은 종류를 확인하고 받는다(위 NAMED_KINDS). address 쪽 칸들은 이름이 있을 때만
   * 채워지므로 그대로 믿어도 된다 — 이름 없는 주차장은 amenity 칸 자체가 안 온다.
   */
  const poi =
    (d.category && NAMED_KINDS.has(d.category) ? trim(d.name) : null) ??
    trim(a?.shop) ??
    trim(a?.amenity) ??
    trim(a?.tourism) ??
    trim(a?.leisure);
  if (poi) return poi;

  /*
   * 도시가 없으면 동네, 그것도 없으면 군(county)까지 내려간다. 고속도로 한복판에서
   * 찍은 사진이 그렇다 — 「Montgomery County, KS」는 밋밋해도 「돌아오는 길이었다」를
   * 말해 준다. 이름을 아예 안 붙이면 그 하루가 어디였는지가 사라진다.
   */
  const where =
    trim(a?.city) ?? trim(a?.town) ?? trim(a?.village) ?? trim(a?.hamlet) ?? trim(a?.suburb) ??
    trim(a?.neighbourhood) ?? trim(a?.county);
  if (!where) return null;

  /*
   * 미국이면 「The Colony, TX」로 줄인다. 주 이름을 다 쓰면(「The Colony, Texas」)
   * 시각 옆 한 줄에 안 들어간다. ISO 코드가 "US-TX"로 오므로 뒤 두 글자를 쓴다.
   */
  const iso = a?.['ISO3166-2-lvl4'];
  const st = a?.country_code === 'us' && iso?.length === 5 ? iso.slice(-2) : null;
  return st ? `${where}, ${st}` : where;
}

/** 빈 문자열·너무 긴 이름은 없는 것으로 친다. 한 줄에 들어가야 쓸모가 있다 */
function trim(v: string | undefined): string | null {
  const s = v?.trim();
  return s && s.length <= 40 ? s : null;
}

/* ── 구글 Places: 이 점에 뭐가 있나 ─────────────────────────────────── */

/**
 * 반경. **좁게 잡는다.**
 *
 * GPS가 50~100m씩 튀는데 여기를 넓히면 가장 가까운 업소를 집게 되고, 그건 옆 가게다.
 * 「어디였더라」는 사진을 보면 되지만 「Chase Bank에서 찍었네」는 기억을 덮어쓴다.
 * 60m면 그 건물 안에 있을 때만 걸린다.
 */
const NEARBY_RADIUS_M = 60;

/**
 * 이름으로 안 쓸 종류.
 *
 * 가장 가까운 것을 집기 때문에 주차장·ATM·정류장이 자꾸 1등이 된다. 「그 식당 주차장」은
 * 식당이 아니고, 그 이름이 붙으면 그 자리에 대해 아무것도 안 알려 준다.
 */
const NOISE_TYPES = new Set([
  'parking',
  'atm',
  'bus_stop',
  'transit_station',
  'bus_station',
  'train_station',
  'subway_station',
  'electric_vehicle_charging_station',
  'rest_stop',
]);

/** 아예 못 물어봤다 — 키가 막혔거나 응답이 안 왔다. 「물어봤는데 없다」(null)와 다르다 */
const FAILED = Symbol('geocode-failed');

/**
 * 구글에 물어본다.
 *   string  찾았다
 *   null    물어봤는데 그 점에 업소가 없다
 *   FAILED  못 물어봤다 (키가 막혔거나 응답이 안 왔다)
 */
async function googlePlaceName(lat: number, lon: number): Promise<string | null | typeof FAILED> {
  const key = googleKey();
  if (!key) return FAILED;
  try {
    const res = await fetch(GOOGLE_NEARBY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        // 안 쓸 칸까지 받으면 비싼 등급으로 올라간다 — 이름과 종류만 받는다
        'X-Goog-FieldMask': 'places.displayName,places.primaryType,places.types',
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lon }, radius: NEARBY_RADIUS_M },
        },
        // 가까운 순으로 몇 개 받아서 잡음을 건너뛴다 — 1개만 받으면 주차장에 걸린다
        maxResultCount: 5,
        rankPreference: 'DISTANCE',
        languageCode: 'en',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.warn('[geocode] 구글이 거절했다:', res.status, (await res.text()).slice(0, 300));
      return FAILED;
    }
    const data = (await res.json()) as {
      places?: { displayName?: { text?: string }; primaryType?: string; types?: string[] }[];
    };
    for (const p of data.places ?? []) {
      if (p.primaryType && NOISE_TYPES.has(p.primaryType)) continue;
      if (p.types?.some((t) => NOISE_TYPES.has(t))) continue;
      const name = trim(p.displayName?.text);
      if (name) return name;
    }
    return null;
  } catch (e) {
    console.warn('[geocode] 구글에 못 물어봤다:', e instanceof Error ? e.message : e);
    return FAILED;
  }
}

/* ── 주소 → 좌표 ────────────────────────────────────────────────────── */

/**
 * 주소 한 줄의 좌표. 못 찾으면 null.
 *
 * 숙소 칸에 쓴 것을 좌표로 바꿔 두려고 있다 — 모임당 한 번만 부른다.
 * 「오스틴 에어비앤비」처럼 검색이 안 되는 표현이면 null이고, 그러면 「숙소」 라벨이
 * 안 붙을 뿐 나머지는 그대로다.
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  const q = new URLSearchParams({ q: address.trim(), format: 'jsonv2', limit: '1' });
  const data = (await ask(`/search?${q}`)) as { lat?: string; lon?: string }[] | null;
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit) return null;
  const lat = Number(hit.lat);
  const lon = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return null;
  }
  return { lat, lon };
}
