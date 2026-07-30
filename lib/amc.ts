import { DaySchedule, Format, Movie, Showtime } from './types';

/**
 * AMC 공식 Showtime API 연동.
 *
 * 환경변수
 *  - AMC_VENDOR_KEY (또는 AMC_API_KEY) — developers.amctheatres.com 에서 발급한 Vendor Key
 *  - AMC_THEATRE_ID — 극장 ID (미지정 시 Town Center 20)
 *  - AMC_API_BASE — 샌드박스로 바꿀 때 https://api.sandbox-amctheatres.com/v2
 *
 * 인증은 X-AMC-Vendor-Key 헤더.
 * 응답 필드가 문서와 다르면 mapShowtime()/mapMovie()만 고치면 된다.
 */

const API_BASE = process.env.AMC_API_BASE ?? 'https://api.amctheatres.com/v2';

/** AMC Town Center 20 (Leawood, KS) */
const DEFAULT_THEATRE_ID = '38';

/** 모임 장소로 쓰는 극장 이름 */
export const AMC_THEATRE_NAME = process.env.AMC_THEATRE_NAME ?? 'AMC Town Center 20';

/** 발급 포털이 부르는 이름이 제각각이라 둘 다 받는다 */
function vendorKey(): string | undefined {
  return process.env.AMC_VENDOR_KEY ?? process.env.AMC_API_KEY;
}

export function theatreId(): string {
  return process.env.AMC_THEATRE_ID ?? DEFAULT_THEATRE_ID;
}

export function amcConfigured(): boolean {
  return Boolean(vendorKey());
}

interface AmcShowtime {
  id: number | string;
  showDateTimeLocal: string; // "2026-07-24T18:00:00"
  movieId?: number | string;
  movieName?: string;
  attributes?: { code: string; name: string }[];
  isAlmostSoldOut?: boolean;
  isSoldOut?: boolean;
  isCanceled?: boolean;
  runTime?: number;
  mpaaRating?: string;
  // 실제 응답의 포스터 키는 posterDynamic 계열이다 (posterThumbnail/poster는 없다).
  // posterDynamic180X74는 가로로 긴 배너라 세로 포스터가 필요한 곳에는 맞지 않는다.
  media?: { posterDynamic?: string; posterAlternateDynamic?: string; posterIMAXDynamic?: string };
}

function detectFormat(attrs: AmcShowtime['attributes']): Format {
  const names = (attrs ?? []).map((a) => `${a.code} ${a.name}`.toLowerCase()).join(' ');
  if (names.includes('imax')) return 'IMAX with Laser';
  if (names.includes('dolby')) return 'Dolby Cinema';
  if (names.includes('prime')) return 'PRIME';
  return 'Laser';
}

function mapShowtime(s: AmcShowtime): Showtime | null {
  if (!s.showDateTimeLocal) return null;
  const [date, timeFull] = s.showDateTimeLocal.split('T');
  if (!date || !timeFull) return null;
  const movieName = s.movieName?.trim() || '(제목 없음)';
  return {
    id: String(s.id),
    // movieId가 없는 응답도 있어 이름으로 묶을 수 있게 폴백을 둔다
    movieId: s.movieId != null ? String(s.movieId) : movieName,
    movieName,
    date,
    time: timeFull.slice(0, 5),
    format: detectFormat(s.attributes),
    // 매진이 "거의 매진"보다 급한 정보라 먼저 본다
    ...(s.isSoldOut ? { note: 'Sold Out' } : s.isAlmostSoldOut ? { note: 'Almost Full' } : {}),
  };
}

/**
 * AMC 포스터 주소는 Cloudinary 원본을 그대로 가리킨다 — 한 장에 15MB짜리도 있다.
 * 도메인 뒤에 변환 파라미터를 끼워 넣으면 같은 그림이 5KB로 온다.
 * (AMC 자신도 posterDynamic180X74 같은 키에서 이 방식을 쓴다)
 */
const POSTER_TRANSFORM = 'w_240,q_auto,f_auto';

function sizedPoster(url: string | undefined): string | undefined {
  if (!url) return undefined;
  // 예상한 모양이 아니면 손대지 않는다 (건드려서 깨뜨리느니 원본이 낫다)
  return url.replace(/^(https:\/\/[^/]*cloudinary\.com)\/(v\d+\/)/, `$1/${POSTER_TRANSFORM}/$2`);
}

function mapMovie(s: AmcShowtime, showtime: Showtime): Movie {
  // 빈 문자열로 오는 키가 있어 ??가 아니라 falsy 폴백을 쓴다 (posterIMAXDynamic이 ''인 경우가 있다)
  const poster = sizedPoster(
    s.media?.posterDynamic || s.media?.posterAlternateDynamic || s.media?.posterIMAXDynamic
  );
  return {
    id: showtime.movieId,
    name: showtime.movieName,
    ...(s.runTime ? { runtime: s.runTime } : {}),
    ...(s.mpaaRating ? { rating: s.mpaaRating } : {}),
    ...(poster ? { posterUrl: poster } : {}),
  };
}

/** YYYY-MM-DD → AMC가 쓰는 MM-DD-YYYY */
function amcDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${m}-${d}-${y}`;
}

/** 영화별로 묶고, 영화는 이름순 · 회차는 시간순으로 정렬 */
export function groupByMovie(showtimes: Showtime[], movies: Map<string, Movie>): DaySchedule['movies'] {
  const byMovie = new Map<string, Showtime[]>();
  for (const s of showtimes) {
    if (!byMovie.has(s.movieId)) byMovie.set(s.movieId, []);
    byMovie.get(s.movieId)!.push(s);
  }
  return [...byMovie.entries()]
    .map(([movieId, list]) => ({
      movie: movies.get(movieId) ?? { id: movieId, name: list[0].movieName },
      // 날짜까지 넣어 정렬해야 심야 회차(다음 날 00:15)가 맨 앞이 아니라 맨 뒤로 간다
      showtimes: list.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    }))
    .sort((a, b) => a.movie.name.localeCompare(b.movie.name));
}

/** 하루치 상영표를 AMC에서 가져온다 (날짜: YYYY-MM-DD) */
export async function fetchAmcDay(date: string): Promise<DaySchedule> {
  const key = vendorKey();
  if (!key) throw new Error('AMC_VENDOR_KEY(또는 AMC_API_KEY) 환경변수가 설정되지 않았습니다.');

  const url = `${API_BASE}/theatres/${theatreId()}/showtimes/${amcDate(date)}?page-size=200`;
  const res = await fetch(url, {
    headers: { 'X-AMC-Vendor-Key': key, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`AMC API 오류 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  const raw: AmcShowtime[] = data?._embedded?.showtimes ?? data?.showtimes ?? [];

  const showtimes: Showtime[] = [];
  const movies = new Map<string, Movie>();
  const seen = new Set<string>();
  for (const r of raw) {
    // 취소된 회차로 모임을 잡으면 당일에 헛걸음한다
    if (r.isCanceled) continue;
    const s = mapShowtime(r);
    // 날짜로 거르지 않는다 — AMC는 목요일 심야(자정 넘은 00:15 등)를 목요일 영업일로 묶어 주고,
    // 그것들은 다음 날 조회에는 나오지 않는다. 걸러내면 어느 날짜로도 볼 수 없게 된다.
    // 회차 자체의 date는 실제 날짜(7/31)를 유지해야 모임도 그 날짜로 만들어진다.
    if (!s || seen.has(s.id)) continue;
    seen.add(s.id);
    showtimes.push(s);
    if (!movies.has(s.movieId)) movies.set(s.movieId, mapMovie(r, s));
  }

  return { date, movies: groupByMovie(showtimes, movies) };
}

/** 극장 검색 — 극장 ID를 찾을 때 쓴다 (관리자 도구) */
export async function searchAmcTheatres(name: string): Promise<{ id: string; name: string; city?: string }[]> {
  const key = vendorKey();
  if (!key) throw new Error('AMC_VENDOR_KEY(또는 AMC_API_KEY) 환경변수가 설정되지 않았습니다.');
  const url = `${API_BASE}/theatres?name=${encodeURIComponent(name)}&page-size=20`;
  const res = await fetch(url, {
    headers: { 'X-AMC-Vendor-Key': key, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`AMC API 오류 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const list = data?._embedded?.theatres ?? data?.theatres ?? [];
  return list.map((t: { id: number | string; name: string; location?: { city?: string } }) => ({
    id: String(t.id),
    name: t.name,
    ...(t.location?.city ? { city: t.location.city } : {}),
  }));
}
