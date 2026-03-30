import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { driverDatabase } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(driverDatabase)
      .orderBy(asc(driverDatabase.fsHz))
      .limit(200);
    return NextResponse.json({ drivers: rows, total: rows.length });
  } catch (e) {
    if (e instanceof Error && e.message.includes('DATABASE_URL')) {
      return NextResponse.json({ drivers: [], total: 0 });
    }
    console.error('[drivers] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
