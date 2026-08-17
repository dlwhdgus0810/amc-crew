/**
 * 좌표와 주소를 서로 바꾼다 — OpenStreetMap의 Nominatim에 물어서. 서버 전용.
 *
 * 왜 Nominatim인가: 키도 결제 계정도 없이 쓴다. 이 앱이 물어볼 양이 여행 한 번에
 * 자리 일곱 개 남짓이라(사진 낱장이 아니라 자리마다 한 번), 1년에 스무 번을 가도 이백 번이다.
 * 그 정도에 결제 계정을 만들고 키를 굴릴 이유가 없다. 나중에 가게 이름이 더 필요해지면
 * 이 파일만 갈아끼우면 된다 — 부르는 쪽은 「좌표 주면 이름」밖에 모른다.
 *
 * **묻는 자리는 백필 하나뿐이다** (app/api/admin/photo-place). 화면을 그리면서 여기를
 * 부르면 안 된다: 초당 한 번 제한이 있고, 무엇보다 좌표는 안 변하니 한 번 묻고 DB에
 * 적어 두면 영영 다시 물을 일이 없다.
 *
 * 무엇이 나가는가: 좌표(사진에서 읽은 것)와 숙소 주소(사람이 쓴 것)가 OSM 서버로 나간다.
 * 그래서 여행 카테고리에서만, 관리자가 눌렀을 때만 부른다.
 */

import { SITE_URL } from './site';

const BASE = 'https://nominatim.openstreetmap.org';

/**
 * Nominatim 이용 정책이 요구하는 신원 표시. 이게 없으면 막힌다 — 선택이 아니다.
 * 남의 무료 서비스라 누가 쓰는지 밝히고 쓴다.
 */
const UA = `KansasKorean/1.0 (${SITE_URL ?? 'https://github.com/dlwhdgus0810/amc-crew'})`;

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
export async function placeName(lat: number, lon: number): Promise<string | null> {
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
