// GET /api/drivers/search
// Query params: type, sens_min, sens_max, fs_max, limit (default 5, max 20)
// Returns drivers filtered by T/S profile for the design wizard.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { driverDatabase } from "@/lib/db/schema";
import { and, gte, lte, eq, isNotNull, asc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  const type     = p.get("type");       // woofer | tweeter | midrange | fullrange | subwoofer
  const sensMin  = p.get("sens_min");
  const sensMax  = p.get("sens_max");
  const fsMax    = p.get("fs_max");
  const limit    = Math.min(parseInt(p.get("limit") ?? "5"), 20);

  try {
    const conditions = [isNotNull(driverDatabase.fsHz)];

    if (type) {
      conditions.push(eq(driverDatabase.driverType, type as typeof driverDatabase.driverType._.data));
    }
    if (sensMin) conditions.push(gte(driverDatabase.sensitivity1m1w, parseFloat(sensMin)));
    if (sensMax) conditions.push(lte(driverDatabase.sensitivity1m1w, parseFloat(sensMax)));
    if (fsMax)   conditions.push(lte(driverDatabase.fsHz, parseFloat(fsMax)));

    const rows = await db
      .select({
        id:                  driverDatabase.id,
        manufacturer:        driverDatabase.manufacturer,
        model:               driverDatabase.model,
        driverType:          driverDatabase.driverType,
        fsHz:                driverDatabase.fsHz,
        qts:                 driverDatabase.qts,
        vasLiters:           driverDatabase.vasLiters,
        sdCm2:               driverDatabase.sdCm2,
        xmaxMm:              driverDatabase.xmaxMm,
        sensitivity1m1w:     driverDatabase.sensitivity1m1w,
        nominalImpedanceOhm: driverDatabase.nominalImpedanceOhm,
        bl:                  driverDatabase.bl,
        reOhm:               driverDatabase.reOhm,
        powerWatts:          driverDatabase.powerWatts,
      })
      .from(driverDatabase)
      .where(and(...conditions))
      .orderBy(asc(driverDatabase.fsHz))
      .limit(limit);

    return NextResponse.json({ drivers: rows, total: rows.length });
  } catch (e) {
    if (e instanceof Error && e.message.includes("DATABASE_URL")) {
      return NextResponse.json({ drivers: [], total: 0 });
    }
    console.error("[drivers/search] error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
