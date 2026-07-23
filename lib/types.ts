export type Format = 'IMAX with Laser' | 'Dolby Cinema' | 'PRIME' | 'Laser';

export interface Showtime {
  id: string; // e.g. "2026-07-24_18:00_imax"
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  format: Format;
  note?: string; // e.g. "Almost Full"
}

export interface UserSelection {
  name: string; // 카카오 닉네임 (표시용)
  showtimeIds: string[];
}

export interface Selections {
  // 카카오 회원번호 -> 선택 정보
  [userId: string]: UserSelection;
}

export interface GroupResult {
  showtime: Showtime;
  members: string[];
}
