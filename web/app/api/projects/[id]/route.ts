import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { vituixcadProjects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const rows = await db
      .select()
      .from(vituixcadProjects)
      .where(eq(vituixcadProjects.id, id))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({ project: rows[0] });
  } catch (e) {
    if (e instanceof Error && e.message.includes('DATABASE_URL')) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    console.error('[projects/id] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
