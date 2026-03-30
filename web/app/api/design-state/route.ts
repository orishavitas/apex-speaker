import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { designState } from '@/lib/db/schema';
import { defaultDesignState } from '@/lib/types/speaker-domain';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

// Zod schema for PATCH validation
const WaySlotSchema = z.object({
  wayIndex: z.number().int().min(0).max(3),
  role: z.enum(['woofer', 'mid', 'tweeter', 'supertweeter']),
  driverDatabaseId: z.string().nullable(),
  crossoverFreqHz: z.number().nullable(),
  enclosureType: z.enum(['sealed', 'ported', 'passive_radiator', 'open_baffle', 'horn']),
  loading: z.object({ variant: z.string() }).passthrough(),
});

const PatchSchema = z.object({
  projectId: z.string().uuid(),
  numWays: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
  waysConfig: z.array(WaySlotSchema).optional(),
  cabinetVolumeLiters: z.number().optional(),
  activeVituixcadProjectId: z.string().uuid().nullable().optional(),
  version: z.number().int().optional(),
});

function isNoDatabaseError(e: unknown): boolean {
  return e instanceof Error && e.message.includes('DATABASE_URL');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId query param required' }, { status: 400 });
    }

    try {
      const rows = await db
        .select()
        .from(designState)
        .where(eq(designState.projectId, projectId))
        .limit(1);

      if (rows.length === 0) {
        // Auto-create default state
        const defaults = defaultDesignState(projectId);
        const [created] = await db
          .insert(designState)
          .values({
            projectId,
            numWays: defaults.numWays,
            waysConfig: defaults.waysConfig,
            version: 1,
          })
          .returning();
        return NextResponse.json({ state: created, persisted: true, created: true });
      }

      return NextResponse.json({ state: rows[0], persisted: true });
    } catch (e) {
      if (isNoDatabaseError(e)) {
        // Return default state without persisting
        return NextResponse.json({ state: defaultDesignState(projectId), persisted: false });
      }
      throw e;
    }
  } catch (e) {
    console.error('[design-state GET] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = PatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
    }

    const { projectId, version: clientVersion, ...updates } = parsed.data;

    const existing = await db
      .select({ id: designState.id, version: designState.version })
      .from(designState)
      .where(eq(designState.projectId, projectId))
      .limit(1);

    if (existing.length === 0) {
      return NextResponse.json({ error: 'Design state not found' }, { status: 404 });
    }

    // Optimistic concurrency check
    if (clientVersion !== undefined && existing[0].version !== clientVersion) {
      return NextResponse.json(
        { error: 'Version conflict', serverVersion: existing[0].version },
        { status: 409 }
      );
    }

    const [updated] = await db
      .update(designState)
      .set({ ...updates, version: existing[0].version + 1, updatedAt: new Date() })
      .where(eq(designState.projectId, projectId))
      .returning();

    return NextResponse.json({ state: updated });
  } catch (e) {
    if (isNoDatabaseError(e)) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    console.error('[design-state PATCH] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
