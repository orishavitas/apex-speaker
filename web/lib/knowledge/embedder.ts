// Wraps AI SDK embedMany — uses OpenAI provider directly (bypasses AI Gateway).
// Batch size 96 to stay under rate limits.

import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const BATCH_SIZE = 96;

export async function embedChunks(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: batch,
    });
    allEmbeddings.push(...embeddings);

    // Rate limit: 200ms between batches
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return allEmbeddings;
}
