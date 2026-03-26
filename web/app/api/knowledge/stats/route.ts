// GET /api/knowledge/stats
// Returns chunk counts per domain, total sources, ingestion status

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { knowledgeChunks, sources } from "@/lib/db/schema";
import { sql, count } from "drizzle-orm";

export async function GET() {
  try {
    const [chunksByDomain, sourceStats] = await Promise.all([
      db
        .select({
          domain: knowledgeChunks.agentDomain,
          count: count(),
        })
        .from(knowledgeChunks)
        .groupBy(knowledgeChunks.agentDomain),
      db
        .select({
          total: count(),
          ingested: sql<number>`sum(case when is_ingested then 1 else 0 end)`,
        })
        .from(sources),
    ]);

    const domainCounts = Object.fromEntries(
      chunksByDomain.map((row) => [row.domain, row.count])
    );

    return NextResponse.json({
      chunks: {
        byDomain: domainCounts,
        total: chunksByDomain.reduce((sum, r) => sum + r.count, 0),
      },
      sources: sourceStats[0],
    });
  } catch (err) {
    console.error("[knowledge/stats]", err);
    return NextResponse.json({ error: "Stats failed" }, { status: 500 });
  }
}
