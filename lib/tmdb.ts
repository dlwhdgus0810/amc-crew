// TMDB(The Movie Database) 연동 — 무비나잇 제목 자동완성용.
// TMDB_API_KEY 미설정 시 기능이 조용히 꺼지고 제목은 일반 텍스트 입력으로 동작한다.

export interface TitleSearchResult {
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  year?: string;
  posterPath?: string; // TMDB 이미지 경로 (예: /abc.jpg)
  rating?: number; // 0~10, 소수 1자리
}

export interface TitleMeta extends TitleSearchResult {
  director?: string; // 영화: 감독, TV: 크리에이터
  cast?: string[];
}

export const TMDB_IMG = 'https://image.tmdb.org/t/p';

const API = 'https://api.themoviedb.org/3';

function apiKey(): string | undefined {
  return process.env.TMDB_API_KEY;
}

export function tmdbEnabled(): boolean {
  return Boolean(apiKey());
}

// v3 키(hex)는 api_key 파라미터, v4 토큰(eyJ…)은 Authorization 헤더 — 둘 다 수용
async function tmdbFetch(path: string, params: Record<string, string>): Promise<any> {
  const key = apiKey()!;
  const url = new URL(API + path);
  url.searchParams.set('language', 'ko-KR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if (key.startsWith('eyJ')) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

function round1(n: unknown): number | undefined {
  return typeof n === 'number' && n > 0 ? Math.round(n * 10) / 10 : undefined;
}

export async function searchTitles(query: string): Promise<TitleSearchResult[]> {
  const data = await tmdbFetch('/search/multi', { query, include_adult: 'false' });
  return (data.results ?? [])
    .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 8)
    .map((r: any): TitleSearchResult => ({
      tmdbId: r.id,
      mediaType: r.media_type,
      title: r.media_type === 'movie' ? r.title : r.name,
      year: (r.media_type === 'movie' ? r.release_date : r.first_air_date)?.slice(0, 4) || undefined,
      posterPath: r.poster_path ?? undefined,
      rating: round1(r.vote_average),
    }));
}

export async function getTitleMeta(mediaType: 'movie' | 'tv', tmdbId: number): Promise<TitleMeta> {
  const data = await tmdbFetch(`/${mediaType}/${tmdbId}`, { append_to_response: 'credits' });
  const director =
    mediaType === 'movie'
      ? data.credits?.crew?.find((c: any) => c.job === 'Director')?.name
      : data.created_by?.[0]?.name;
  return {
    tmdbId,
    mediaType,
    title: mediaType === 'movie' ? data.title : data.name,
    year: (mediaType === 'movie' ? data.release_date : data.first_air_date)?.slice(0, 4) || undefined,
    posterPath: data.poster_path ?? undefined,
    rating: round1(data.vote_average),
    director: director ?? undefined,
    cast: (data.credits?.cast ?? []).slice(0, 3).map((c: any) => c.name),
  };
}

/** 클라이언트가 보낸 titleMeta를 필드 화이트리스트로 정제. 형태가 어긋나면 null. */
export function sanitizeTitleMeta(raw: unknown): TitleMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const tmdbId = Number(r.tmdbId);
  const mediaType = r.mediaType === 'movie' || r.mediaType === 'tv' ? r.mediaType : null;
  const title = typeof r.title === 'string' ? r.title.trim().slice(0, 200) : '';
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !mediaType || !title) return null;
  const str = (v: unknown, max: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;
  const rating = round1(r.rating);
  const cast = Array.isArray(r.cast)
    ? r.cast.filter((c): c is string => typeof c === 'string').slice(0, 5).map((c) => c.slice(0, 100))
    : undefined;
  return {
    tmdbId,
    mediaType,
    title,
    year: str(r.year, 4),
    posterPath: str(r.posterPath, 100),
    rating,
    director: str(r.director, 100),
    ...(cast && cast.length > 0 ? { cast } : {}),
  };
}
