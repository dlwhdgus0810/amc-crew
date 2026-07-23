export type Format = 'IMAX with Laser' | 'Dolby Cinema' | 'PRIME' | 'Laser';

export interface Showtime {
  id: string; // e.g. "2026-07-24_18:00_imax"
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  format: Format;
  note?: string; // e.g. "Almost Full"
}

export interface UserSelection {
  name: string; // 저장 시점 이름 스냅샷 (프로필이 없을 때 표시 폴백)
  showtimeIds: string[];
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
