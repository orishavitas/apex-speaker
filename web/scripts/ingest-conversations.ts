// Run: npm run ingest
// Requires DATABASE_URL and (VERCEL_OIDC_TOKEN or OPENAI_API_KEY) in .env.local
// Ingests all 23 scraped ChatGPT speaker conversations into Neon with pgvector embeddings.

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

// Load .env.local before importing DB/AI modules
config({ path: path.resolve(__dirname, "../.env.local") });

import { chunkConversation } from "../lib/knowledge/chunker";
import { embedChunks } from "../lib/knowledge/embedder";
import { upsertKnowledgeChunks } from "../lib/knowledge/upsert";
import { getPrimaryDomain } from "./tag-domains";

const KNOWLEDGE_DIR = path.resolve(
  __dirname,
  "../../../speaker-building-knowledge"
);

interface FrontMatter {
  title: string;
  url?: string;
}

function parseFrontMatter(content: string): FrontMatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { title: "Untitled" };

  const result: FrontMatter = { title: "Untitled" };
  for (const line of match[1].split("\n")) {
    if (line.startsWith("title:")) {
      result.title = line.replace("title:", "").trim().replace(/^["']|["']$/g, "");
    }
    if (line.startsWith("url:")) {
      result.url = line.replace("url:", "").trim();
    }
  }
  return result;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL not set in .env.local");
    process.exit(1);
  }

  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    console.error(`❌ Knowledge directory not found: ${KNOWLEDGE_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md")).sort();
  console.log(`\n📚 APEX Knowledge Ingestion Pipeline`);
  console.log(`   Found ${files.length} conversation files in ${KNOWLEDGE_DIR}\n`);

  let totalChunks = 0;
  let processed = 0;
  const errors: string[] = [];

  for (const fileName of files) {
    const filePath = path.join(KNOWLEDGE_DIR, fileName);
    const rawContent = fs.readFileSync(filePath, "utf-8");
    const { title, url } = parseFrontMatter(rawContent);
    const agentDomain = getPrimaryDomain(fileName);

    process.stdout.write(`[${processed + 1}/${files.length}] ${fileName}\n`);
    process.stdout.write(`  → domain: ${agentDomain} | title: ${title}\n`);

    try {
      const chunks = chunkConversation(rawContent, title);
      process.stdout.write(`  → chunking: ${chunks.length} chunks\n`);

      const texts = chunks.map((c) => c.content);
      process.stdout.write(`  → embedding...\n`);
      const embeddings = await embedChunks(texts);

      process.stdout.write(`  → upserting to Neon...\n`);
      await upsertKnowledgeChunks({
        filePath,
        fileName,
        title,
        sourceUrl: url,
        agentDomain,
        chunks,
        embeddings,
      });

      totalChunks += chunks.length;
      processed++;
      process.stdout.write(`  ✓ done (${chunks.length} chunks)\n\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ✗ FAILED: ${msg}\n`);
      errors.push(`${fileName}: ${msg}`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Ingestion complete`);
  console.log(`   Files processed: ${processed}/${files.length}`);
  console.log(`   Total chunks: ${totalChunks}`);
  if (errors.length > 0) {
    console.log(`\n⚠️  Errors (${errors.length}):`);
    errors.forEach((e) => console.log(`   - ${e}`));
  }
  console.log(`\nNext: CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);\n`);
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  process.exit(1);
});
