import { NextResponse } from 'next/server';
import { getSessionUser, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user, isAdmin: isAdmin(user) });
}
