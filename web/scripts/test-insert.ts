import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(__dirname, "../.env.local") });

import { getNeon } from "../lib/db";

async function main() {
  const testEmbedding = Array(1536).fill(0.01);
  const embeddingStr = `[${testEmbedding.join(",")}]`;
  const neonSql = getNeon();

  try {
    await neonSql`
      INSERT INTO knowledge_chunks
        (source_type, agent_domain, title, content, tags, confidence, status, embedding, source_url, source_path, chunk_index)
      VALUES (
        ${"chatgpt_conversation"}::source_type,
        ${"enclosure"}::agent_domain,
        ${"test neon raw"},
        ${"test content"},
        ${JSON.stringify(["enclosure", "chatgpt_conversation"])}::jsonb,
        ${0.8},
        ${"canonical"}::knowledge_status,
        ${embeddingStr}::vector(1536),
        ${null},
        ${"/test/neon-raw"},
        ${0}
      )
    `;
    console.log("SUCCESS — raw neon insert worked");

    await neonSql`DELETE FROM knowledge_chunks WHERE source_path = '/test/neon-raw'`;
    console.log("Cleaned up");
  } catch (e: unknown) {
    const err = e as Error & { cause?: Error };
    console.error("ERROR:", err.message);
    if (err.cause) console.error("CAUSE:", err.cause.message);
  }
}

main().catch(console.error);
