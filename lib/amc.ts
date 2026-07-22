import { Showtime, Format } from './types';

/**
 * AMC 공식 Showtime API 연동 (선택 기능).
 *
 * 사용하려면:
 *  1. https://developers.amctheatres.com 에서 Vendor Key 신청/발급
 *  2. 환경변수 AMC_VENDOR_KEY 에 키 입력
 *  3. 환경변수 AMC_THEATRE_ID 에 AMC Town Center 20 극장 ID 입력
 *     (키 발급 후 GET https://api.amctheatres.com/v2/theatres 로 조회 가능)
 *
 * API 문서: https://developers.amctheatres.com/ApiReference/showtime-api-v2
 * 인증: X-AMC-Vendor-Key 헤더
 *
 * 참고: 아래 엔드포인트/응답 필드는 공개 문서 기준으로 작성했습니다.
 * 실제 키 발급 후 응답 구조가 다르면 mapAmcShowtime() 만 수정하면 됩니다.
 */

// AMC_API_BASE 환경변수로 샌드박스 전환 가능:
//   샌드박스: https://api.sandbox-amctheatres.com/v2 (테스트 극장 5곳의 시뮬레이션 데이터)
//   프로덕션: https://api.amctheatres.com/v2 (기본값, 실제 데이터 — 승인된 키 필요)
const API_BASE = process.env.AMC_API_BASE ?? 'https://api.amctheatres.com/v2';

// 샌드박스에는 The Odyssey가 없을 수 있으므로, AMC_MOVIE_MATCH로 필터를 바꿀 수 있음
// (예: AMC_MOVIE_MATCH=".*" 로 설정하면 모든 영화 회차를 가져와 연동 테스트 가능)
const MOVIE_MATCH = new RegExp(process.env.AMC_MOVIE_MATCH ?? 'odyssey', 'i');

interface AmcShowtime {
  id: number;
  showDateTimeLocal: string; // e.g. "2026-07-24T18:00:00"
  movieName: string;
  attributes?: { code: string; name: string }[];
  isAlmostSoldOut?: boolean;
}

function detectFormat(attrs: { code: string; name: string }[] | undefined): Format {
  const names = (attrs ?? []).map((a) => `${a.code} ${a.name}`.toLowerCase()).join(' ');
  if (names.includes('imax')) return 'IMAX with Laser';
  if (names.includes('dolby')) return 'Dolby Cinema';
  if (names.includes('prime')) return 'PRIME';
  return 'Laser';
}

function mapAmcShowtime(s: AmcShowtime): Showtime {
  const [date, timeFull] = s.showDateTimeLocal.split('T');
  const time = timeFull.slice(0, 5);
  const format = detectFormat(s.attributes);
  const slug = { 'IMAX with Laser': 'imax', 'Dolby Cinema': 'dolby', PRIME: 'prime', Laser: 'laser' }[format];
  return {
    id: `${date}_${time}_${slug}`,
    date,
    time,
    format,
    ...(s.isAlmostSoldOut ? { note: 'Almost Full' } : {}),
  };
}

export function amcConfigured(): boolean {
  return Boolean(process.env.AMC_VENDOR_KEY && process.env.AMC_THEATRE_ID);
}

/** 오늘부터 days일치 The Odyssey 스케줄을 AMC API에서 가져온다. */
export async function fetchAmcSchedule(days = 7): Promise<Showtime[]> {
  if (!amcConfigured()) {
    throw new Error('AMC_VENDOR_KEY / AMC_THEATRE_ID 환경변수가 설정되지 않았습니다.');
  }

  const headers = {
    'X-AMC-Vendor-Key': process.env.AMC_VENDOR_KEY!,
    Accept: 'application/json',
  };
  const theatreId = process.env.AMC_THEATRE_ID!;
  const results: Showtime[] = [];

  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    // AMC API 날짜 형식: MM-DD-YYYY
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateParam = `${mm}-${dd}-${d.getFullYear()}`;

    const url = `${API_BASE}/theatres/${theatreId}/showtimes/${dateParam}?page-size=100`;
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`AMC API 오류 (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    const showtimes: AmcShowtime[] = data?._embedded?.showtimes ?? data?.showtimes ?? [];
    for (const s of showtimes) {
      if (MOVIE_MATCH.test(s.movieName ?? '')) {
        results.push(mapAmcShowtime(s));
      }
    }
  }

  // 중복 제거 + 정렬
  const seen = new Set<string>();
  return results
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
