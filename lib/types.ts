export type Format = 'IMAX with Laser' | 'Dolby Cinema' | 'PRIME' | 'Laser';

export interface Showtime {
  id: string; // e.g. "2026-07-24_18:00_imax"
  date: string; // YYYY-MM-DD
  time: string; // HH:mm (24h)
  format: Format;
  note?: string; // e.g. "Almost Full"
}

export interface Selections {
  // userName -> array of showtime ids
  [userName: string]: string[];
}

export interface GroupResult {
  showtime: Showtime;
  members: string[];
}
