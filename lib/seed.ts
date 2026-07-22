import { Showtime, Format } from './types';

// 2026-07-22 에 AMC 공식 사이트에서 직접 수집한 The Odyssey 실제 상영 스케줄.
// (AMC Town Center 20, Leawood KS)
// 7/26(일)은 7/25(토)와 동일 패턴으로 추정 — 관리자 페이지에서 수정 가능.

const FORMAT_SLUG: Record<Format, string> = {
  'IMAX with Laser': 'imax',
  'Dolby Cinema': 'dolby',
  PRIME: 'prime',
  Laser: 'laser',
};

function make(date: string, format: Format, times: string[], notes: Record<string, string> = {}): Showtime[] {
  return times.map((time) => ({
    id: `${date}_${time}_${FORMAT_SLUG[format]}`,
    date,
    time,
    format,
    ...(notes[time] ? { note: notes[time] } : {}),
  }));
}

const WEEKDAY_LASER = ['11:30', '12:00', '13:00', '15:30', '16:00', '19:30', '20:00', '21:00'];
const WEEKEND_LASER = [
  '09:00', '09:30', '11:30', '12:00', '12:30', '13:00', '13:30',
  '15:30', '16:00', '16:30', '17:00', '18:20', '19:15', '19:30',
  '20:00', '20:30', '21:00', '22:15',
];

export const SEED_SCHEDULE: Showtime[] = [
  // ── 수요일 7/22 (수집 확정) ──
  ...make('2026-07-22', 'IMAX with Laser', ['10:00', '14:00', '18:00', '22:00'], { '18:00': 'Almost Full' }),
  ...make('2026-07-22', 'Dolby Cinema', ['11:00', '15:00', '19:00']),
  ...make('2026-07-22', 'PRIME', ['18:30', '22:30']),
  ...make('2026-07-22', 'Laser', ['10:30', '11:30', '12:00', '14:30', '15:30', '16:00', '17:00', '19:30', '19:45', '20:00', '20:30', '21:35']),

  // ── 목요일 7/23 (수집 확정) ──
  ...make('2026-07-23', 'IMAX with Laser', ['10:00', '14:00', '18:00', '22:00'], { '18:00': 'Almost Full' }),
  ...make('2026-07-23', 'Dolby Cinema', ['11:00', '15:00', '19:00']),
  ...make('2026-07-23', 'PRIME', ['10:30', '14:30', '18:30', '22:30']),
  ...make('2026-07-23', 'Laser', WEEKDAY_LASER),

  // ── 금요일 7/24 (수집 확정) ──
  ...make('2026-07-24', 'IMAX with Laser', ['10:00', '14:00', '18:00', '22:00'], { '18:00': 'Almost Full' }),
  ...make('2026-07-24', 'Dolby Cinema', ['11:00', '15:00', '19:00', '23:00']),
  ...make('2026-07-24', 'PRIME', ['10:30', '14:30', '18:30', '22:30']),
  ...make('2026-07-24', 'Laser', WEEKEND_LASER),

  // ── 토요일 7/25 (수집 확정) ──
  ...make('2026-07-25', 'IMAX with Laser', ['10:00', '14:00', '18:00', '22:00'], { '18:00': 'Almost Full' }),
  ...make('2026-07-25', 'Dolby Cinema', ['11:00', '15:00', '19:00', '23:00']),
  ...make('2026-07-25', 'PRIME', ['10:30', '14:30', '18:30', '22:30']),
  ...make('2026-07-25', 'Laser', WEEKEND_LASER),

  // ── 일요일 7/26 (7/25 패턴 기반 추정) ──
  ...make('2026-07-26', 'IMAX with Laser', ['10:00', '14:00', '18:00', '22:00']),
  ...make('2026-07-26', 'Dolby Cinema', ['11:00', '15:00', '19:00', '23:00']),
  ...make('2026-07-26', 'PRIME', ['10:30', '14:30', '18:30', '22:30']),
  ...make('2026-07-26', 'Laser', WEEKEND_LASER),
];

export const MOVIE = {
  title: 'The Odyssey',
  runtime: '2시간 52분',
  rating: 'R',
  theatre: 'AMC Town Center 20',
  theatreAddress: '11701 Nall Ave, Leawood, KS 66211',
};
