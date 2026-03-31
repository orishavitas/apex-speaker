import { NextRequest, NextResponse } from 'next/server';
import { parseVxFile, ParseError, detectVxFileType } from '@/lib/parser';
import { db } from '@/lib/db';
import { vituixcadProjects, driverDatabase } from '@/lib/db/schema';
import { createHash } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import type { VxdRaw, VxdDriverRaw } from '@/lib/parser/vituixcad-native';
import { vxdDriverToInsert } from '@/lib/mappers/vxd-to-driver-insert';

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

      // .vxd: extract and upsert drivers into driver_database
      let driversImported = 0;
      if (fileType === 'vxd') {
        const vxd = parsedData as VxdRaw;
        const drivers: VxdDriverRaw[] = vxd?.VITUIXCAD?.DATABASE?.DRIVER ?? [];
        if (drivers.length > 0) {
          const inserts = drivers.map(vxdDriverToInsert);
          await db
            .insert(driverDatabase)
            .values(inserts)
            .onConflictDoUpdate({
              target: [driverDatabase.manufacturer, driverDatabase.model],
              set: {
                driverType:      sql`excluded.driver_type`,
                reOhm:           sql`excluded.re_ohm`,
                leMh:            sql`excluded.le_mh`,
                bl:              sql`excluded.bl`,
                fsHz:            sql`excluded.fs_hz`,
                qts:             sql`excluded.qts`,
                qes:             sql`excluded.qes`,
                qms:             sql`excluded.qms`,
                vasLiters:       sql`excluded.vas_liters`,
                mmsGrams:        sql`excluded.mms_grams`,
                cmsMmPerN:       sql`excluded.cms_mm_per_n`,
                rmsKgS:          sql`excluded.rms_kg_s`,
                sdCm2:           sql`excluded.sd_cm2`,
                xmaxMm:          sql`excluded.xmax_mm`,
                sensitivity1m1w: sql`excluded.sensitivity_1m1w`,
                powerWatts:      sql`excluded.power_watts`,
                source:          sql`excluded.source`,
                rawData:         sql`excluded.raw_data`,
                updatedAt:       new Date(),
              },
            });
          driversImported = drivers.length;
        }
      }

      return NextResponse.json({
        success: true,
        persisted: true,
        id: inserted.id,
        fileType,
        fileName: filename,
        ...(fileType === 'vxd' ? { driversImported } : {}),
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
