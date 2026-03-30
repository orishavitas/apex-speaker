import { NextRequest, NextResponse } from 'next/server';
import { parseVxFile, ParseError, detectVxFileType } from '@/lib/parser';
import { db } from '@/lib/db';
import { vituixcadProjects } from '@/lib/db/schema';
import { createHash } from 'crypto';
import { eq } from 'drizzle-orm';

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } },
};

function isNoDatabaseError(e: unknown): boolean {
  return e instanceof Error && e.message.includes('DATABASE_URL');
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const filename = file.name;
    const fileType = detectVxFileType(filename);
    if (!fileType) {
      return NextResponse.json(
        { error: `Unsupported file type. Expected .vxp, .vxd, or .vxb — got: ${filename}` },
        { status: 415 }
      );
    }

    const xmlText = await file.text();
    const fileHash = createHash('sha256').update(xmlText).digest('hex');

    // Parse XML — throws ParseError on invalid XML
    let parsedData: unknown;
    try {
      parsedData = parseVxFile(xmlText, filename);
    } catch (e) {
      if (e instanceof ParseError) {
        return NextResponse.json({ error: e.message, fileType: e.fileType }, { status: 400 });
      }
      throw e;
    }

    // Try DB — graceful fallback if DATABASE_URL not configured
    try {
      // Check for duplicate by hash
      const existing = await db
        .select({ id: vituixcadProjects.id, fileName: vituixcadProjects.fileName })
        .from(vituixcadProjects)
        .where(eq(vituixcadProjects.fileHash, fileHash))
        .limit(1);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'File already ingested', existingId: existing[0].id, fileName: existing[0].fileName },
          { status: 409 }
        );
      }

      const [inserted] = await db
        .insert(vituixcadProjects)
        .values({
          fileType,
          fileName: filename,
          fileHash,
          parsedData: parsedData as Record<string, unknown>,
          schemaVersion: 1,
        })
        .returning({ id: vituixcadProjects.id });

      return NextResponse.json({
        success: true,
        persisted: true,
        id: inserted.id,
        fileType,
        fileName: filename,
      });
    } catch (e) {
      if (isNoDatabaseError(e)) {
        // No DB — return parse result without persisting
        return NextResponse.json({
          success: true,
          persisted: false,
          fileType,
          fileName: filename,
          parsedData,
          message: 'Parsed successfully (no database configured)',
        });
      }
      throw e;
    }
  } catch (e) {
    console.error('[upload] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
