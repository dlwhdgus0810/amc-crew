import { Suspense } from 'react';
import { getViewer } from '@/lib/session';
import { listTickets } from '@/lib/db/tickets';
import TicketsClient from './tickets-client';

export const dynamic = 'force-dynamic';

/**
 * 내가 낸 건의를 서버에서 읽는다.
 *
 * 예전에는 세션을 먼저 받고 그 답을 보고서야 목록을 물었다(줄줄이 두 단).
 * Stage 2에서 앞단이 빠졌고, 이제 뒷단도 서버가 맡는다.
 */
async function TicketsData() {
  const { user } = await getViewer();
  const mine = user ? await listTickets(user.id) : [];
  return <TicketsClient initial={{ mine }} />;
}

export default function TicketsPage() {
  return (
    <Suspense fallback={null}>
      <TicketsData />
    </Suspense>
  );
}
