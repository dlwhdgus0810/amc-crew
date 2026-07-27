import { DaySchedule, Format, Movie, Showtime } from './types';
import { groupByMovie } from './amc';
import { addDays } from './dates';

/**
 * AMC 키가 없을 때 쓰는 로컬 개발용 상영표.
 * 날짜를 고정하면 금방 과거가 되므로 요청한 날짜에 맞춰 그때그때 만든다.
 */

const SEED_MOVIES: (Movie & { showtimes: { time: string; format: Format }[] })[] = [
  {
    id: 'seed-odyssey',
    name: 'The Odyssey',
    runtime: 172,
    rating: 'R',
    showtimes: [
      { time: '10:00', format: 'IMAX with Laser' },
      { time: '14:00', format: 'IMAX with Laser' },
      { time: '18:00', format: 'IMAX with Laser' },
      { time: '11:00', format: 'Dolby Cinema' },
      { time: '19:00', format: 'Dolby Cinema' },
      { time: '13:30', format: 'Laser' },
    ],
  },
  {
    id: 'seed-dune3',
    name: 'Dune: Part Three',
    runtime: 165,
    rating: 'PG-13',
    showtimes: [
      { time: '12:30', format: 'IMAX with Laser' },
      { time: '16:30', format: 'IMAX with Laser' },
      { time: '20:30', format: 'PRIME' },
      { time: '15:00', format: 'Laser' },
    ],
  },
  {
    id: 'seed-anim',
    name: 'Sunday Bakers',
    runtime: 98,
    rating: 'PG',
    showtimes: [
      { time: '10:30', format: 'Laser' },
      { time: '12:45', format: 'Laser' },
      { time: '17:15', format: 'Laser' },
    ],
  },
];

/** 주말에는 심야 회차를 하나 더 붙여 날짜마다 조금씩 다르게 보이도록 한다 */
function isWeekend(date: string): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 || wd === 6;
}

export function seedDay(date: string): DaySchedule {
  const showtimes: Showtime[] = [];
  const movies = new Map<string, Movie>();

  for (const { showtimes: times, ...movie } of SEED_MOVIES) {
    movies.set(movie.id, movie);
    const slots = isWeekend(date) ? [...times, { time: '22:15', format: 'Laser' as Format }] : times;
    for (const slot of slots) {
      showtimes.push({
        id: `${movie.id}_${date}_${slot.time}`,
        movieId: movie.id,
        movieName: movie.name,
        date,
        time: slot.time,
        format: slot.format,
        ...(slot.time === '18:00' ? { note: 'Almost Full' } : {}),
      });
    }
  }

  return { date, movies: groupByMovie(showtimes, movies) };
}

/** 상영표를 보여줄 날짜 목록 (오늘부터 days일) */
export function scheduleDates(today: string, days = 7): string[] {
  return Array.from({ length: days }, (_, i) => addDays(today, i));
}
