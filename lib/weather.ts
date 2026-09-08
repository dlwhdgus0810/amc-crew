import { REGIONS, type Region } from './region';

/**
 * 지금 날씨 — 홈 상태줄의 여름·겨울 값 (lib/statements.ts의 seasonStat).
 *
 * **Open-Meteo를 쓴다.** 키도 가입도 없고, 기온·체감·강수확률·습도 넷이 한 번에 온다.
 * 대신 출처를 밝혀야 한다 (CC BY 4.0) — 프로필 맨 아래에 한 줄 적어 두었다.
 *
 * 봄은 여기가 아니라 lib/spring.ts가 받아 온다 (USA-NPN). 가을은 날짜 하나라 안 부른다.
 *
 * 어디 날씨인가는 지역이 정한다 (lib/region.ts의 lat·lon — 캔자스는 오버랜드파크,
 * 펜는 시내). 상태줄에 쓰는 값이라 도시 하나면 충분하다 — 회원마다 자리를 물어보는
 * 것은 이 한 줄이 받을 값이 아니다.
 */

/** 30분에 한 번만 받아 온다. 상태줄의 값은 분 단위로 움직이지 않는다 */
const REVALIDATE = 1800;
/** 이만큼 안 오면 포기한다 — 날씨 하나 때문에 홈이 늦게 뜨면 안 된다 */
const TIMEOUT_MS = 2500;

export interface Weather {
  /** 섭씨 */
  temp: number;
  /** 체감, 섭씨 */
  feels: number;
  /** 강수 확률 % */
  rain: number;
  /** 습도 % */
  humidity: number;
}

/* 주소에 좌표가 들어가므로 지역마다 다른 주소 = 지역마다 따로 담긴다 (fetch 캐시) */
const urlFor = (region: Region) =>
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${REGIONS[region].lat}&longitude=${REGIONS[region].lon}` +
  '&current=temperature_2m,apparent_temperature,precipitation_probability,relative_humidity_2m' +
  '&timezone=auto';

/**
 * 못 받아 오면 null이다 — 부르는 쪽이 고정값으로 돌아간다.
 *
 * 던지지 않는 이유는 이 값이 없어도 화면이 멀쩡해야 하기 때문이다. 상태줄은 장식이고,
 * 날씨가 안 와서 홈이 안 뜨는 것이 훨씬 나쁘다.
 */
export async function currentWeather(region: Region): Promise<Weather | null> {
  try {
    const res = await fetch(urlFor(region), {
      next: { revalidate: REVALIDATE },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as { current?: Record<string, unknown> };
    const c = j.current;
    if (!c) return null;
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
    const temp = num(c.temperature_2m);
    const feels = num(c.apparent_temperature);
    const rain = num(c.precipitation_probability);
    const humidity = num(c.relative_humidity_2m);
    if (temp == null || feels == null || rain == null || humidity == null) return null;
    return { temp, feels, rain, humidity };
  } catch {
    /* 시간 초과·네트워크·형식이 바뀐 것 — 어느 쪽이든 고정값으로 돌아간다 */
    return null;
  }
}
