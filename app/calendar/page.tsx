import { todayLocal } from '@/lib/dates';
import CalendarClient from './calendar-client';

export const dynamic = 'force-dynamic';

/**
 * "오늘"은 서버가 정해서 내려준다.
 * 브라우저 시계는 다른 시간대일 수 있어서, 기기에 맡기면 캔자스 기준으로 하루 어긋난 칸에
 * 동그라미가 그려진다.
 */
export default function CalendarPage() {
  return <CalendarClient today={todayLocal()} />;
}
