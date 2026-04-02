import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { driverDatabase } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const rows = await db
      .select()
      .from(driverDatabase)
      .where(eq(driverDatabase.id, id))
      .limit(1);
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ driver: rows[0] });
  } catch (e) {
    if (e instanceof Error && e.message.includes('DATABASE_URL')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('[drivers/id] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
