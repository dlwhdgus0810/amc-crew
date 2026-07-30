export type Format = 'IMAX with Laser' | 'Dolby Cinema' | 'PRIME' | 'Laser';

export interface Movie {
  id: string; // AMC movie id (문자열로 통일)
  name: string;
  runtime?: number; // 분
  rating?: string; // 'R', 'PG-13' 등 관람등급 (AMC)
  posterUrl?: string;
  /** 눌러서 크게 볼 때 쓰는 같은 포스터의 큰 판 */
  posterLargeUrl?: string;
  // ── 아래는 TMDB에서 붙인다. AMC는 평점·감독·출연을 주지 않는다 ──
  /** TMDB 평점 (10점 만점, 소수 1자리) — 위의 rating(관람등급)과 다른 값이다 */
  score?: number;
  director?: string;
  cast?: string[];
}

export interface Showtime {
  id: string; // AMC showtime id
  movieId: string;
  movieName: string; // 스냅샷 — 그룹 화면이 AMC 조회 없이도 영화 이름을 보여줄 수 있게
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  format: Format;
  note?: string; // e.g. "Almost Full"
}

/** 하루치 상영표 — 영화별로 묶어 내려준다 */
export interface DaySchedule {
  date: string;
  movies: { movie: Movie; showtimes: Showtime[] }[];
  /** 실제 AMC 상영표가 아니라 예시 데이터임 — 화면에 반드시 표시한다 */
  sample?: boolean;
  /** AMC 사이트를 보고 손으로 옮겨 적은 상영표 — 실제 값이지만 갱신되지 않는다 */
  manual?: boolean;
}

export interface UserSelection {
  name: string; // 저장 시점 이름 스냅샷 (프로필이 없을 때 표시 폴백)
  /**
   * 고른 회차를 통째로 스냅샷으로 들고 있는다.
   * AMC 상영표는 날짜가 지나면 사라지므로 id만 저장하면 그룹 화면에서 렌더할 수 없다.
   */
  picks: Showtime[];
}

export interface UserProfile {
  kakaoName: string; // 최신 카카오 닉네임 (로그인마다 갱신)
  nickname?: string; // 사용자가 앱에서 설정한 닉네임 (있으면 표시에 우선 사용)
  kakaoNameHistory: { name: string; at: string }[]; // 카카오 닉네임 변경 이력 (보관용)
}

export interface Profiles {
  // 카카오 회원번호 -> 프로필
  [userId: string]: UserProfile;
}

export interface Selections {
  // 카카오 회원번호 -> 선택 정보
  [userId: string]: UserSelection;
}

export interface GroupResult {
  showtime: Showtime;
  members: string[];
}
