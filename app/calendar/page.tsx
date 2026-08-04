import { Suspense } from 'react';
import { calendarRange, todayLocal } from '@/lib/dates';
import { getViewer } from '@/lib/session';
import { dbGetUser } from '@/lib/db/users';
import { listMeetupsBetween } from '@/lib/db/calendar';
import CalendarClient from './calendar-client';

export const dynamic = 'force-dynamic';

/**
 * 첫 화면 몫만 서버가 읽는다.
 *
 * 달력은 보고 있는 기간이 바뀌는 화면이라 전부를 미리 읽을 수 없다 — 처음 열었을 때의
 * 이번 주치만 읽어 넘기고, 달을 넘기는 순간부터는 화면이 받아온다.
 * 범위 계산은 lib/dates의 calendarRange를 서버와 화면이 함께 쓴다. 한 칸이라도 어긋나면
 * 서버가 읽어 둔 것을 못 쓰고 다시 받아오게 된다.
 */
async function CalendarData({ today }: { today: string }) {
  const { user } = await getViewer();
  // 기본은 주 보기 — 화면의 첫 상태와 같아야 한다
  const { from, to } = calendarRange('week', today);
  // 지난 비공개 모임을 볼지는 사람마다 다르다 (프로필 설정, 기본은 안 보임)
  const showPastPrivate = user ? ((await dbGetUser(user.id))?.showPastPrivate ?? false) : false;
  const meetups = await listMeetupsBetween(from, to, user?.id, showPastPrivate);
  return <CalendarClient today={today} initial={{ from, to, meetups }} />;
}

/**
 * "오늘"은 서버가 정해서 내려준다.
 * 브라우저 시계는 다른 시간대일 수 있어서, 기기에 맡기면 캔자스 기준으로 하루 어긋난 칸에
 * 동그라미가 그려진다.
 */
export default function CalendarPage() {
  const today = todayLocal();
  return (
    <Suspense fallback={null}>
      <CalendarData today={today} />
    </Suspense>
  );
}
