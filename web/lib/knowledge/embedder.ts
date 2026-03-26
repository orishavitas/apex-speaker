// Wraps AI SDK embedMany — uses Vercel AI Gateway via model string.
// Batch size 96 to stay under rate limits.

import { embedMany } from "ai";

const BATCH_SIZE = 96;
const EMBEDDING_MODEL = "openai/text-embedding-3-small"; // 1536 dims, via AI Gateway

export async function embedChunks(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: EMBEDDING_MODEL,
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
