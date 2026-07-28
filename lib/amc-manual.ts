import { DaySchedule, Format, Movie, Showtime } from './types';
import { groupByMovie } from './amc';

/**
 * AMC 사이트에서 직접 옮겨 적은 상영표.
 *
 * AMC Vendor Key가 아직 활성화되지 않아 lib/seed.ts의 가짜 상영표가 나가는데,
 * 그걸로는 실제 약속을 잡을 수 없다. 그래서 실제로 모이기로 한 날짜만
 * amctheatres.com 상영표를 보고 손으로 넣어 둔다.
 *
 * 회차 id는 AMC가 쓰는 진짜 id라, 나중에 키가 열려도 같은 회차를 가리킨다.
 * 대신 사람이 옮겨 적은 값이라 AMC가 시간표를 바꾸면 여기만 옛날 값으로 남는다 —
 * 화면에서 manual 플래그로 "직접 옮겨 적었으니 예매 전 확인하세요"라고 밝힌다.
 *
 * 키가 활성화되면 이 파일은 통째로 지운다 (store.ts의 분기도 함께).
 */

interface ManualMovie extends Movie {
  showtimes: { id: string; time: string; format: Format; note?: string }[];
}

/** 출처: https://www.amctheatres.com/movie-theatres/kansas-city/amc-town-center-20/showtimes */
const MANUAL_DAYS: Record<string, ManualMovie[]> = {
  // 2026-07-29 (수) — 2026-07-28에 옮겨 적음
  '2026-07-29': [
    {
      id: 'the-odyssey',
      name: 'The Odyssey',
      runtime: 172,
      rating: 'R',
      showtimes: [
        { id: '143797136', time: '10:00', format: 'IMAX with Laser' },
        { id: '143797137', time: '14:00', format: 'IMAX with Laser' },
        { id: '143797138', time: '18:00', format: 'IMAX with Laser', note: 'Almost Full' },
        { id: '143797139', time: '22:00', format: 'IMAX with Laser' },
        { id: '145071998', time: '11:00', format: 'Dolby Cinema' },
        { id: '145071997', time: '15:00', format: 'Dolby Cinema' },
        { id: '145071999', time: '22:30', format: 'Dolby Cinema' },
        { id: '145428992', time: '10:30', format: 'PRIME' },
        { id: '145428991', time: '14:30', format: 'PRIME' },
        { id: '145428989', time: '18:30', format: 'PRIME' },
        { id: '145428990', time: '22:20', format: 'PRIME' },
        { id: '144113575', time: '12:00', format: 'Laser' },
        { id: '145428951', time: '12:30', format: 'Laser' },
        { id: '145429043', time: '13:00', format: 'Laser' },
        { id: '145428983', time: '13:30', format: 'Laser' },
        { id: '144113574', time: '16:00', format: 'Laser' },
        { id: '145428948', time: '16:30', format: 'Laser' },
        { id: '145429002', time: '17:00', format: 'Laser' },
        { id: '145429023', time: '18:20', format: 'Laser' },
        { id: '145428926', time: '19:15', format: 'Laser' },
        { id: '144113573', time: '20:00', format: 'Laser' },
        { id: '145428949', time: '20:30', format: 'Laser' },
        { id: '145428982', time: '21:30', format: 'Laser' },
      ],
    },
    {
      id: 'moana',
      name: 'Moana',
      runtime: 115,
      rating: 'PG',
      showtimes: [
        { id: '145429004', time: '10:45', format: 'Laser' },
        { id: '145429008', time: '12:45', format: 'Laser' },
        { id: '145429007', time: '15:45', format: 'Laser' },
        { id: '145428940', time: '18:45', format: 'Laser' },
        { id: '145428945', time: '21:45', format: 'Laser' },
      ],
    },
    {
      id: 'minions-monsters',
      name: 'Minions & Monsters',
      runtime: 90,
      rating: 'PG',
      showtimes: [
        { id: '145428967', time: '12:00', format: 'Laser', note: '3D' },
        { id: '145428966', time: '14:30', format: 'Laser', note: '3D' },
        { id: '145428965', time: '17:00', format: 'Laser', note: '3D' },
        { id: '145429024', time: '22:10', format: 'Laser', note: '3D' },
        { id: '145429038', time: '10:30', format: 'Laser' },
        { id: '145429034', time: '13:00', format: 'Laser' },
        { id: '145429033', time: '15:30', format: 'Laser' },
        { id: '145429010', time: '18:45', format: 'Laser' },
      ],
    },
    {
      id: 'toy-story-5',
      name: 'Toy Story 5',
      runtime: 102,
      rating: 'PG',
      showtimes: [
        { id: '145429022', time: '10:30', format: 'Laser', note: '3D' },
        { id: '145429021', time: '13:10', format: 'Laser', note: '3D' },
        { id: '145429020', time: '15:45', format: 'Laser', note: '3D' },
        { id: '145428958', time: '11:35', format: 'Laser' },
        { id: '145428957', time: '14:10', format: 'Laser' },
        { id: '145428956', time: '16:45', format: 'Laser' },
        { id: '145428955', time: '19:20', format: 'Laser' },
        { id: '145429025', time: '19:50', format: 'Laser' },
        { id: '145429009', time: '21:15', format: 'Laser' },
      ],
    },
    {
      id: 'hadestown-the-musical',
      name: 'Hadestown: The Musical',
      runtime: 141,
      rating: 'NR',
      showtimes: [
        { id: '145428929', time: '11:00', format: 'Laser' },
        { id: '144540515', time: '12:00', format: 'Laser' },
        { id: '145428978', time: '13:00', format: 'Laser' },
        { id: '145428932', time: '14:30', format: 'Laser' },
        { id: '144540514', time: '15:30', format: 'Laser' },
        { id: '145429040', time: '16:50', format: 'Laser' },
        { id: '145052561', time: '18:00', format: 'Laser' },
        { id: '144540513', time: '19:00', format: 'Laser' },
        { id: '145428968', time: '19:30', format: 'Laser' },
        { id: '145429037', time: '21:20', format: 'Laser' },
      ],
    },
    {
      id: 'motor-city',
      name: 'Motor City',
      runtime: 103,
      rating: 'R',
      showtimes: [
        { id: '145429041', time: '10:20', format: 'Laser' },
        { id: '144721565', time: '19:15', format: 'Laser' },
      ],
    },
    {
      id: 'the-invite',
      name: 'The Invite',
      runtime: 107,
      rating: 'R',
      showtimes: [
        { id: '145429005', time: '10:00', format: 'Laser' },
        { id: '145428941', time: '13:00', format: 'Laser' },
        { id: '145428925', time: '16:30', format: 'Laser' },
        { id: '145428931', time: '18:00', format: 'Laser' },
        { id: '145429027', time: '22:30', format: 'Laser' },
      ],
    },
    {
      id: 'evil-dead-burn',
      name: 'Evil Dead Burn',
      runtime: 110,
      rating: 'R',
      showtimes: [
        { id: '145428946', time: '10:15', format: 'Laser' },
        { id: '145429003', time: '20:50', format: 'Laser' },
        { id: '145476379', time: '22:30', format: 'Laser' },
      ],
    },
    {
      id: 'the-bad-guys-2',
      name: 'The Bad Guys 2',
      runtime: 104,
      rating: 'PG',
      showtimes: [
        { id: '142848182', time: '11:00', format: 'Laser' },
        { id: '142848183', time: '13:45', format: 'Laser' },
      ],
    },
    {
      id: 'young-washington',
      name: 'Young Washington',
      runtime: 125,
      rating: 'PG13',
      showtimes: [
        { id: '145428927', time: '13:30', format: 'Laser' },
        { id: '145429026', time: '16:30', format: 'Laser' },
      ],
    },
    {
      id: 'her-private-hell',
      name: 'Her Private Hell',
      runtime: 110,
      rating: 'R',
      showtimes: [
        { id: '145429051', time: '11:30', format: 'Laser' },
        { id: '145429050', time: '14:15', format: 'Laser' },
        { id: '144953093', time: '17:00', format: 'Laser' },
        { id: '144953092', time: '19:45', format: 'Laser' },
        { id: '144953095', time: '22:30', format: 'Laser' },
      ],
    },
    {
      id: 'obsession',
      name: 'Obsession',
      runtime: 108,
      rating: 'R',
      showtimes: [
        { id: '145428979', time: '16:30', format: 'Laser' },
        { id: '145428964', time: '22:00', format: 'Laser' },
      ],
    },
    {
      id: 'haunted-heist',
      name: 'Haunted Heist',
      runtime: 88,
      rating: 'R',
      showtimes: [
        { id: '145428947', time: '10:10', format: 'Laser' },
        { id: '145428936', time: '22:20', format: 'Laser' },
      ],
    },
    {
      id: 'disclosure-day',
      name: 'Disclosure Day',
      runtime: 145,
      rating: 'PG13',
      showtimes: [
        { id: '145428928', time: '10:10', format: 'Laser' },
        { id: '145429001', time: '13:40', format: 'Laser' },
      ],
    },
    {
      id: 'jana-nayagan',
      name: 'Jana Nayagan',
      runtime: 186,
      rating: 'NR',
      showtimes: [
        { id: '145428930', time: '20:45', format: 'Laser' },
      ],
    },
    {
      id: 'backrooms-everything-must-go-edition-w-b',
      name: 'Backrooms: Everything Must Go Edition w/ Bonus Footage',
      runtime: 127,
      rating: 'R',
      showtimes: [
        { id: '145428942', time: '15:45', format: 'Laser' },
        { id: '145428980', time: '22:00', format: 'Laser' },
      ],
    },
    {
      id: 'above-and-below',
      name: 'Above and Below',
      runtime: 96,
      rating: 'NR',
      showtimes: [
        { id: '145265650', time: '20:05', format: 'Laser' },
      ],
    },
  ],
};

export function hasManualDay(date: string): boolean {
  return date in MANUAL_DAYS;
}

/** 손으로 넣어 둔 날이면 그 상영표를, 없으면 null */
export function manualDay(date: string): DaySchedule | null {
  const list = MANUAL_DAYS[date];
  if (!list) return null;

  const showtimes: Showtime[] = [];
  const movies = new Map<string, Movie>();
  for (const { showtimes: times, ...movie } of list) {
    movies.set(movie.id, movie);
    for (const slot of times) {
      showtimes.push({
        id: slot.id,
        movieId: movie.id,
        movieName: movie.name,
        date,
        time: slot.time,
        format: slot.format,
        ...(slot.note ? { note: slot.note } : {}),
      });
    }
  }
  return { date, movies: groupByMovie(showtimes, movies), manual: true };
}
