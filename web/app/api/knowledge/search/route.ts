// POST /api/knowledge/search
// Body: { query: string, domain?: AgentDomain, limit?: number }
// Returns: top-k knowledge chunks by cosine similarity

export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { embed } from "ai";
import { db } from "@/lib/db";
import { knowledgeChunks } from "@/lib/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { z } from "zod";

const SearchSchema = z.object({
  query: z.string().min(1).max(2000),
  domain: z
    .enum(["acoustics", "enclosure", "crossover", "theory", "mechanical", "research", "manager"])
    .optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, domain, limit } = SearchSchema.parse(body);

    const { embedding } = await embed({
      model: "openai/text-embedding-3-small",
      value: query,
    });

    const embeddingStr = `[${embedding.join(",")}]`;

    const results = await db
      .select({
        id: knowledgeChunks.id,
        title: knowledgeChunks.title,
        content: knowledgeChunks.content,
        agentDomain: knowledgeChunks.agentDomain,
        sourceType: knowledgeChunks.sourceType,
        sourceUrl: knowledgeChunks.sourceUrl,
        confidence: knowledgeChunks.confidence,
        tags: knowledgeChunks.tags,
        similarity: sql<number>`1 - (${knowledgeChunks.embedding} <=> ${embeddingStr}::vector)`,
      })
      .from(knowledgeChunks)
      .where(
        domain
          ? and(
              eq(knowledgeChunks.status, "canonical"),
              eq(knowledgeChunks.agentDomain, domain)
            )
          : eq(knowledgeChunks.status, "canonical")
      )
      .orderBy(sql`${knowledgeChunks.embedding} <=> ${embeddingStr}::vector`)
      .limit(limit);

    return NextResponse.json({ results, query, domain, count: results.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: err.issues }, { status: 400 });
    }
    console.error("[knowledge/search]", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
