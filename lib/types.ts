export type Format = 'IMAX with Laser' | 'Dolby Cinema' | 'PRIME' | 'Laser';

export interface Movie {
  id: string; // AMC movie id (문자열로 통일)
  name: string;
  runtime?: number; // 분
  rating?: string; // 'R', 'PG-13' 등
  posterUrl?: string;
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
