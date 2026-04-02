// Retrieves top-k knowledge chunks for a given query + domain via pgvector cosine similarity.

import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { db } from "../db";
import { knowledgeChunks } from "../db/schema";
import { sql, eq, and } from "drizzle-orm";
import type { AgentDomain, KnowledgeContext } from "./types";

export async function getRAGContext(
  query: string,
  domain: AgentDomain,
  limit = 4
): Promise<KnowledgeContext[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: query,
  });

  const embeddingStr = `[${embedding.join(",")}]`;

  const results = await db
    .select({
      id: knowledgeChunks.id,
      title: knowledgeChunks.title,
      content: knowledgeChunks.content,
      sourceUrl: knowledgeChunks.sourceUrl,
      agentDomain: knowledgeChunks.agentDomain,
      similarity: sql<number>`1 - (${knowledgeChunks.embedding} <=> ${embeddingStr}::vector)`,
    })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.status, "canonical"),
        eq(knowledgeChunks.agentDomain, domain)
      )
    )
    .orderBy(sql`${knowledgeChunks.embedding} <=> ${embeddingStr}::vector`)
    .limit(limit);

  return results.map((r) => ({
    chunkId: r.id,
    title: r.title,
    content: r.content,
    sourceUrl: r.sourceUrl,
    similarity: r.similarity,
    domain: r.agentDomain as AgentDomain,
  }));
}

export function formatRAGContext(chunks: KnowledgeContext[]): string {
  if (chunks.length === 0) return "";

  const formatted = chunks
    .map((c, i) => {
      const source = c.sourceUrl ? ` (source: ${c.sourceUrl})` : "";
      return `[${i + 1}] ${c.title ?? "Untitled"}${source}\n${c.content}`;
    })
    .join("\n\n---\n\n");

  return `## Relevant Knowledge\n\n${formatted}`;
}
