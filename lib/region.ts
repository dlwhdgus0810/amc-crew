import type { Msg } from './i18n';

/**
 * 지역 — 같은 앱·같은 DB 위에서 **도메인으로** 갈라 보는 동네들.
 *
 * kansaskorean.com으로 들어오면 캔자스, pennkorean.com으로 들어오면 펜다. 계정은
 * 하나다(카카오 앱이 같아서 회원번호가 같다) — 프로필·친구·테마·달란트는 어디서 열든
 * 그대로고, 모임·구독·명단·순위표만 지역별로 갈린다 (posts.region 등).
 *
 * 이 파일은 **서버와 브라우저가 같이 읽는다.** 비밀은 여기 두지 않는다. 지역 자체는
 * 늘 요청 때 정하고(lib/region-server.ts), 여기 있는 것은 지역마다 다른 **상수**뿐이다 —
 * 그래서 NEXT_PUBLIC_*가 빌드 때 박혀도 괜찮다.
 *
 * 지역은 권한 경계가 아니다. 다른 지역 글을 id로 열면 그 글이 그대로 열린다 — 공유
 * 링크가 살아야 해서다. 목록에만 안 뜬다.
 */
export const REGION_IDS = ['kansas', 'penn'] as const;
export type Region = (typeof REGION_IDS)[number];
export const DEFAULT_REGION: Region = 'kansas';

/** localhost·*.vercel.app처럼 지역을 모르는 호스트에서만 듣는 쿠키. 실제 도메인에선 무시한다 */
export const REGION_COOKIE = 'region';

/**
 * 카테고리 문구 중 동네에 묶인 것 — 장소 예시, 여행지 보기, 제안한 사람.
 * lib/categories.ts의 캔자스 값은 그대로 두고, 다른 지역은 여기서 덮어쓴다 (regionCategory).
 */
export interface CategoryHintOverride {
  locationHint?: Msg;
  lodgingHint?: Msg;
  titleOptions?: Msg[];
  /** null이면 지운다 — 캔자스 분들 이름이 펜 화면에 나오면 안 된다 */
  proposedBy?: string | null;
}

export interface RegionConfig {
  id: Region;
  /** 'Kansas Korean' — 헤더·<title>·OG·알림 제목·ICS */
  name: string;
  /** 소문자, 포트 없이. 첫 번째가 대표 주소다 */
  hosts: string[];
  /** 밖으로 나가는 링크의 공개 주소 (없으면 null → 요청 호스트로 떨어진다, lib/site.ts) */
  siteUrl: string | null;
  timeZone: string;
  /** Open-Meteo·USA-NPN이 볼 자리 */
  lat: string;
  lon: string;
  /** 도시 이름이 빠진 장소에 붙여 줄 지역과, 이미 적혀 있는지 보는 규칙 (lib/maps.ts) */
  mapsRegion: string;
  hasRegion: RegExp;
  /** 단풍이 제일 짙은 날 (lib/statements.ts) */
  leafPeak: { month: number; day: number };
  /** 문구·번역 프롬프트에 쓰는 동네 이름 */
  placeKo: string;
  placeEn: string;
  categoryHints: Partial<Record<string, CategoryHintOverride>>;
  /** 이 시각 이후의 새 소식만 보여준다. ''이면 전부 — 캔자스 이야기가 펜에 안 뜨게 */
  changelogSince: string;
}

const trimSlash = (v: string | undefined) => v?.replace(/\/+$/, '') || null;

export const REGIONS: Record<Region, RegionConfig> = {
  kansas: {
    id: 'kansas',
    name: 'Kansas Korean',
    hosts: ['kansaskorean.com', 'www.kansaskorean.com'],
    siteUrl: trimSlash(process.env.NEXT_PUBLIC_SITE_URL),
    timeZone: 'America/Chicago',
    /* 오버랜드파크 — 캔자스시티 광역의 캔자스 쪽 */
    lat: '38.98',
    lon: '-94.67',
    mapsRegion: 'Kansas City',
    hasRegion: /\b(KS|MO|Kansas|Missouri|Overland Park|Leawood|Olathe|Lenexa|Shawnee|Prairie Village|Merriam)\b/i,
    /* 캔자스는 10월 하순 */
    leafPeak: { month: 10, day: 25 },
    placeKo: '캔자스',
    placeEn: 'Kansas',
    /* 비어 있다 — lib/categories.ts에 적힌 값이 곧 캔자스 값이다 */
    categoryHints: {},
    changelogSince: '',
  },
  penn: {
    id: 'penn',
    name: 'Penn Korean',
    hosts: ['pennkorean.com', 'www.pennkorean.com'],
    siteUrl: trimSlash(process.env.NEXT_PUBLIC_SITE_URL_PENN),
    timeZone: 'America/New_York',
    /* 필라델피아 시내 */
    lat: '39.95',
    lon: '-75.17',
    mapsRegion: 'Philadelphia',
    hasRegion:
      /\b(PA|NJ|DE|Pennsylvania|Philadelphia|Philly|Center City|Fishtown|Rittenhouse|Cherry Hill|King of Prussia|Upper Darby|Elkins Park|Conshohocken|Blue Bell)\b/i,
    /* 필라델피아는 캔자스보다 한 주쯤 이르다 */
    leafPeak: { month: 10, day: 18 },
    placeKo: '필라델피아',
    placeEn: 'Philadelphia',
    /*
     * 장소 예시 초안 — 실제 모임 자리에 맞게 고쳐 쓰면 된다. proposedBy는 전부 뺀다:
     * 캔자스에서 제안한 분들 이름이라 펜 화면에 적을 이유가 없다.
     */
    categoryHints: {
      reading: {
        locationHint: { ko: '예: La Colombe, Fishtown', en: 'e.g. La Colombe, Fishtown', es: 'p. ej. La Colombe, Fishtown' },
        proposedBy: null,
      },
      cafe: {
        locationHint: { ko: '예: 스타벅스 Rittenhouse', en: 'e.g. Starbucks, Rittenhouse', es: 'p. ej. Starbucks, Rittenhouse' },
      },
      trip: {
        titleOptions: [
          { ko: '뉴욕', en: 'New York', es: 'Nueva York' },
          { ko: '워싱턴 DC', en: 'Washington, DC', es: 'Washington, DC' },
          { ko: '포코노', en: 'The Poconos', es: 'Los Poconos' },
        ],
        locationHint: {
          ko: '예: H Mart Upper Darby 주차장',
          en: 'e.g. H Mart parking lot, Upper Darby',
          es: 'p. ej. aparcamiento de H Mart, Upper Darby',
        },
        lodgingHint: { ko: '예: 포코노 에어비앤비', en: 'e.g. Airbnb in the Poconos', es: 'p. ej. Airbnb en los Poconos' },
        proposedBy: null,
      },
      gym: {
        locationHint: { ko: '예: Lifetime King of Prussia', en: 'e.g. Lifetime, King of Prussia', es: 'p. ej. Lifetime, King of Prussia' },
      },
      tennis: {
        locationHint: { ko: '예: FDR Park 테니스 코트', en: 'e.g. FDR Park tennis courts', es: 'p. ej. canchas de tenis de FDR Park' },
        proposedBy: null,
      },
      camping: {
        locationHint: { ko: '예: French Creek State Park', en: 'e.g. French Creek State Park', es: 'p. ej. French Creek State Park' },
        proposedBy: null,
      },
      baking: {
        locationHint: { ko: '예: 우리집', en: 'e.g. my place', es: 'p. ej. mi casa' },
      },
      moving: {
        locationHint: {
          ko: '예: Center City 아파트 3층',
          en: 'e.g. Center City apartment, 3rd floor',
          es: 'p. ej. apartamento en Center City, 3.º piso',
        },
        lodgingHint: { ko: '예: Cherry Hill 타운홈', en: 'e.g. townhome in Cherry Hill', es: 'p. ej. casa adosada en Cherry Hill' },
        proposedBy: null,
      },
      running: {
        locationHint: { ko: '예: Schuylkill River Trail', en: 'e.g. Schuylkill River Trail', es: 'p. ej. Schuylkill River Trail' },
        proposedBy: null,
      },
      stargazing: {
        locationHint: {
          ko: '예: French Creek State Park 주차장',
          en: 'e.g. French Creek State Park parking lot',
          es: 'p. ej. aparcamiento de French Creek State Park',
        },
      },
      game: { proposedBy: null },
      outing: {
        locationHint: { ko: '예: Fairmount Park', en: 'e.g. Fairmount Park', es: 'p. ej. Fairmount Park' },
        proposedBy: null,
      },
      birthday: {
        locationHint: {
          ko: '예: 우리집 / Seorabol Center City',
          en: 'e.g. my place / Seorabol, Center City',
          es: 'p. ej. mi casa / Seorabol, Center City',
        },
        proposedBy: null,
      },
      meal: {
        locationHint: { ko: '예: Seorabol Center City', en: 'e.g. Seorabol, Center City', es: 'p. ej. Seorabol, Center City' },
      },
    },
    /* 문을 여는 날 — 그 전의 소식은 캔자스 이야기다 */
    changelogSince: '2026-09-08T00:00',
  },
};

export function isRegion(v: unknown): v is Region {
  return typeof v === 'string' && (REGION_IDS as readonly string[]).includes(v);
}

/** 아는 도메인이면 그 지역, 아니면 null (localhost·미리보기 주소) */
export function regionFromHost(host: string | null | undefined): Region | null {
  if (!host) return null;
  // 개발 서버는 ':3000'이 붙어 온다
  const h = host.toLowerCase().replace(/:\d+$/, '');
  return REGION_IDS.find((r) => REGIONS[r].hosts.includes(h)) ?? null;
}

/**
 * 호스트 → 쿠키 → DEFAULT_REGION env → 캔자스.
 *
 * 쿠키와 env는 **모르는 호스트에서만** 본다. 실제 도메인에선 도메인이 곧 지역이라,
 * 쿠키로 다른 지역을 걸어 봐야 소용없다 — 걸리게 두면 한 도메인에 두 지역이 섞여 보인다.
 */
export function resolveRegion(host: string | null | undefined, cookie: string | undefined): Region {
  const fromHost = regionFromHost(host);
  if (fromHost) return fromHost;
  if (isRegion(cookie)) return cookie;
  const env = process.env.DEFAULT_REGION;
  return isRegion(env) ? env : DEFAULT_REGION;
}

/**
 * DB 행의 region 칸을 타입으로 좁힌다. 글자로 들어 있어서 아는 값이 아니면 캔자스로 본다 —
 * 지역을 지우거나 이름을 바꾼 뒤에도 옛 행이 화면을 깨뜨리지 않게.
 */
export function regionOfRow(v: string | null | undefined): Region {
  return isRegion(v) ? v : DEFAULT_REGION;
}

/** 지금 지역이 아닌 쪽 — 프로필의 「다른 지역」 링크가 쓴다 (둘뿐이라 이걸로 충분하다) */
export function otherRegion(region: Region): Region {
  return region === 'kansas' ? 'penn' : 'kansas';
}
