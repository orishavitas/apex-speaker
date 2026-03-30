import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { vituixcadProjects } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  try {
    const rows = await db
      .select({
        id: vituixcadProjects.id,
        fileType: vituixcadProjects.fileType,
        fileName: vituixcadProjects.fileName,
        schemaVersion: vituixcadProjects.schemaVersion,
        createdAt: vituixcadProjects.createdAt,
      })
      .from(vituixcadProjects)
      .orderBy(desc(vituixcadProjects.createdAt))
      .limit(50);

    return NextResponse.json({ projects: rows, total: rows.length });
  } catch (e) {
    if (e instanceof Error && e.message.includes('DATABASE_URL')) {
      return NextResponse.json({ projects: [], total: 0 });
    }
    console.error('[projects] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
