import { NextResponse } from 'next/server';
import { getSchedule, getSelections } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const [schedule, selections] = await Promise.all([getSchedule(), getSelections()]);
  return NextResponse.json({ schedule, selections });
}
