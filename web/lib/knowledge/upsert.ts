// Upserts knowledge chunks and their source record into Neon.
// Idempotent: safe to run multiple times — will not duplicate chunks.

import { db } from "../db";
import { knowledgeChunks, sources } from "../db/schema";
import { eq, and } from "drizzle-orm";
import type { Chunk } from "./chunker";

type AgentDomain = "acoustics" | "enclosure" | "crossover" | "theory" | "mechanical" | "research" | "manager";

export interface IngestOptions {
  filePath: string;        // absolute path on disk
  fileName: string;        // just the basename
  title: string;           // human title from frontmatter
  sourceUrl?: string;      // original ChatGPT URL from frontmatter
  agentDomain: AgentDomain;
  chunks: Chunk[];
  embeddings: number[][];
}

export async function upsertKnowledgeChunks(opts: IngestOptions): Promise<void> {
  const { filePath, fileName, title, sourceUrl, agentDomain, chunks, embeddings } = opts;

  // 1. Upsert source record
  const existingSources = await db
    .select()
    .from(sources)
    .where(eq(sources.filePath, filePath));

  let sourceId: string;

  if (existingSources.length > 0) {
    sourceId = existingSources[0].id;
    await db
      .update(sources)
      .set({
        totalChunks: chunks.length,
        isIngested: true,
        ingestedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));
  } else {
    const inserted = await db
      .insert(sources)
      .values({
        name: title,
        sourceType: "chatgpt_conversation",
        url: sourceUrl,
        filePath,
        totalChunks: chunks.length,
        isIngested: true,
        ingestedAt: new Date(),
      })
      .returning();
    sourceId = inserted[0].id;
  }

  // 2. Upsert each chunk (delete-then-insert for idempotency)
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];

    // Delete any existing chunk at this position
    await db
      .delete(knowledgeChunks)
      .where(
        and(
          eq(knowledgeChunks.sourcePath, filePath),
          eq(knowledgeChunks.chunkIndex, chunk.chunkIndex)
        )
      );

    await db.insert(knowledgeChunks).values({
      sourceType: "chatgpt_conversation",
      agentDomain,
      title: chunk.title,
      content: chunk.content,
      tags: [agentDomain, "chatgpt_conversation"],
      confidence: 0.8,
      status: "canonical",
      embedding,
      sourceUrl,
      sourcePath: filePath,
      chunkIndex: chunk.chunkIndex,
    });
  }
}
