# Phase 2: Knowledge Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ingest all 23 scraped ChatGPT speaker conversations into Neon with pgvector embeddings, implement an API endpoint for semantic search, and design the NotebookLM integration for the Research Agent.

**Architecture:** A Node.js ingestion script reads each `.md` file, splits it into semantically coherent chunks (conversation turns or ~800-token blocks), embeds each chunk using Anthropic's `text-embedding-3-small` via AI SDK, and upserts into `knowledge_chunks` with agent domain tagging. A Next.js API route exposes cosine-similarity search. NotebookLM is treated as a first-class source: its URL is stored in `sources`, and chunks can be tagged `source_type: "notebooklm"` when imported from notebook exports.

**Tech Stack:** AI SDK v6 (`embed`, `embedMany`), Anthropic `text-embedding-3-small` model, Drizzle ORM, Neon HTTP, Next.js App Router route handler, `zod` for validation.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `web/scripts/ingest-conversations.ts` | Create | CLI ingestion script — reads 23 `.md` files, chunks, embeds, upserts |
| `web/scripts/tag-domains.ts` | Create | Domain-tagging map — maps filename to agent domain(s) |
| `web/lib/knowledge/chunker.ts` | Create | Conversation-aware chunker — splits on `**User:**`/`**Assistant:**` turns |
| `web/lib/knowledge/embedder.ts` | Create | Thin wrapper around AI SDK `embedMany` |
| `web/lib/knowledge/upsert.ts` | Create | Drizzle upsert to `knowledge_chunks` + `sources` tables |
| `web/app/api/knowledge/search/route.ts` | Create | POST `/api/knowledge/search` — cosine similarity search |
| `web/app/api/knowledge/ingest/route.ts` | Create | POST `/api/knowledge/ingest` — trigger ingest from UI (Phase 4 hook) |
| `web/lib/db/schema.ts` | Modify | Add unique constraint on `(source_path, chunk_index)` to enable upserts |

---

### Task 1: Domain Tagging Map

**Files:**
- Create: `web/scripts/tag-domains.ts`

- [ ] **Step 1: Create the domain tagging file**

```typescript
// web/scripts/tag-domains.ts
// Maps each conversation filename to its primary agent domain(s)
// Used by the ingestion script to set agentDomain on knowledge_chunks

import type { InferSelectModel } from "drizzle-orm";
import type { agents } from "../lib/db/schema";

type AgentDomain = "acoustics" | "enclosure" | "crossover" | "theory" | "mechanical" | "research" | "manager";

export const FILE_DOMAIN_MAP: Record<string, AgentDomain[]> = {
  "01-branch-rs180-pr-system-review.md": ["enclosure", "acoustics"],
  "02-rs180-pr-system-review.md": ["enclosure", "acoustics"],
  "03-port-vs-passive-radiator.md": ["enclosure"],
  "04-branch-branch-speaker-design-options.md": ["research"],
  "05-branch-speaker-design-options.md": ["research"],
  "06-speaker-design-options.md": ["research"],
  "07-cardioid-speakers-amp-options.md": ["acoustics", "crossover"],
  "08-iso-barric-subwoofer-performance.md": ["enclosure", "acoustics"],
  "09-find-subwoofer-match.md": ["research", "acoustics"],
  "10-3d-printed-speaker-enclosure.md": ["mechanical", "enclosure"],
  "11-x-and-m-horns.md": ["acoustics", "theory"],
  "12-isobaric-speaker-design-research.md": ["enclosure", "theory"],
  "13-wtw-pa-speaker-design.md": ["acoustics", "crossover"],
  "14-os-se-waveguide-summary.md": ["acoustics", "theory"],
  "15-waveguide-design-summary.md": ["acoustics"],
  "16-waveguide-curve-design.md": ["acoustics", "theory"],
  "17-create-squircle-in-solidworks.md": ["mechanical"],
  "18-ported-isobaric-woofer-design.md": ["enclosure"],
  "19-bookshelf-speaker-design-request.md": ["research", "crossover"],
  "20-isobaric-pr-bass-design.md": ["enclosure", "acoustics"],
  "21-horn-loading-dome-tweeters.md": ["acoustics", "theory"],
  "22-midrange-above-tweeter.md": ["acoustics", "crossover"],
  "23-breaking-thermal-limits.md": ["theory", "acoustics"],
};

// Primary domain = first in the array (chunk is tagged with this)
export function getPrimaryDomain(filename: string): AgentDomain {
  const domains = FILE_DOMAIN_MAP[filename];
  if (!domains || domains.length === 0) return "research";
  return domains[0];
}
```

- [ ] **Step 2: Verify file compiles**

```bash
cd web && npx tsc --noEmit scripts/tag-domains.ts 2>&1 || true
```

Expected: no errors (or only path-not-found which is fine for script context)

- [ ] **Step 3: Commit**

```bash
cd web && git add scripts/tag-domains.ts
git commit -m "feat: domain tagging map for 23 conversation files"
```

---

### Task 2: Conversation Chunker

**Files:**
- Create: `web/lib/knowledge/chunker.ts`

- [ ] **Step 1: Install required packages**

```bash
cd web && npm install @ai-sdk/anthropic ai
```

Expected: packages installed, no peer dep errors

- [ ] **Step 2: Create the chunker**

```typescript
// web/lib/knowledge/chunker.ts
// Splits a ChatGPT-style conversation markdown file into chunks.
// Strategy: split on speaker boundaries (User/Assistant turns),
// then merge small turns into ~800-token blocks to minimize chunk count.

export interface Chunk {
  content: string;
  chunkIndex: number;
  title: string;
}

const MAX_CHARS = 3200; // ~800 tokens at avg 4 chars/token
const TURN_REGEX = /^(?:\*\*(?:User|Assistant):\*\*)/m;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkConversation(rawContent: string, title: string): Chunk[] {
  // Strip frontmatter
  const body = rawContent.replace(/^---[\s\S]*?---\n/, "").trim();

  // Split on speaker turns
  const turns = body.split(/(?=\n---\n\n\*\*(?:User|Assistant):\*\*)/);

  const chunks: Chunk[] = [];
  let buffer = "";
  let chunkIndex = 0;

  for (const turn of turns) {
    const trimmed = turn.trim();
    if (!trimmed) continue;

    if (buffer.length + trimmed.length > MAX_CHARS && buffer.length > 0) {
      chunks.push({
        content: buffer.trim(),
        chunkIndex,
        title: `${title} [${chunkIndex + 1}]`,
      });
      chunkIndex++;
      buffer = trimmed;
    } else {
      buffer = buffer ? `${buffer}\n\n${trimmed}` : trimmed;
    }
  }

  if (buffer.trim()) {
    chunks.push({
      content: buffer.trim(),
      chunkIndex,
      title: `${title} [${chunkIndex + 1}]`,
    });
  }

  // If chunker produced nothing (no turn markers), fall back to fixed-size split
  if (chunks.length === 0) {
    const words = body.split(/\s+/);
    let block = "";
    let idx = 0;
    for (const word of words) {
      block += (block ? " " : "") + word;
      if (block.length >= MAX_CHARS) {
        chunks.push({ content: block, chunkIndex: idx, title: `${title} [${idx + 1}]` });
        idx++;
        block = "";
      }
    }
    if (block) chunks.push({ content: block, chunkIndex: idx, title: `${title} [${idx + 1}]` });
  }

  return chunks;
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors on the new file

- [ ] **Step 4: Commit**

```bash
git add web/lib/knowledge/chunker.ts
git commit -m "feat: conversation-aware chunker for markdown files"
```

---

### Task 3: Embedder

**Files:**
- Create: `web/lib/knowledge/embedder.ts`

- [ ] **Step 1: Create embedder wrapper**

```typescript
// web/lib/knowledge/embedder.ts
// Wraps AI SDK embedMany — uses Vercel AI Gateway via model string.
// Batch size 96 to stay under Anthropic's token-per-minute limits.

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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors

- [ ] **Step 3: Commit**

```bash
git add web/lib/knowledge/embedder.ts
git commit -m "feat: embedMany wrapper using AI Gateway openai/text-embedding-3-small"
```

---

### Task 4: DB Upsert Helper

**Files:**
- Modify: `web/lib/db/schema.ts`
- Create: `web/lib/knowledge/upsert.ts`

- [ ] **Step 1: Check if unique constraint is needed**

Read `web/lib/db/schema.ts` to see if `source_path` + `chunk_index` unique constraint exists on `knowledgeChunks`.

- [ ] **Step 2: Add unique index to schema**

In `web/lib/db/schema.ts`, add a unique index to `knowledgeChunks` table definition:

```typescript
// In the knowledgeChunks table, update the index callback:
}, (table) => ({
  domainIdx: index("knowledge_domain_idx").on(table.agentDomain),
  statusIdx: index("knowledge_status_idx").on(table.status),
  sourceChunkIdx: uniqueIndex("knowledge_source_chunk_idx").on(table.sourcePath, table.chunkIndex),
  // HNSW index created post-push via: CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
}));
```

Also add `uniqueIndex` to the import at the top:

```typescript
import {
  pgTable, text, varchar, timestamp, uuid, real, integer,
  boolean, jsonb, customType, index, uniqueIndex, pgEnum
} from "drizzle-orm/pg-core";
```

- [ ] **Step 3: Create the upsert helper**

```typescript
// web/lib/knowledge/upsert.ts
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

  // 2. Upsert each chunk (delete old + insert new for simplicity)
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];

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
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add web/lib/db/schema.ts web/lib/knowledge/upsert.ts
git commit -m "feat: knowledge upsert helper + unique index on source_path/chunk_index"
```

---

### Task 5: Main Ingestion Script

**Files:**
- Create: `web/scripts/ingest-conversations.ts`

- [ ] **Step 1: Create the ingestion script**

```typescript
// web/scripts/ingest-conversations.ts
// Run: npx tsx scripts/ingest-conversations.ts
// Requires DATABASE_URL and VERCEL_OIDC_TOKEN (or AI_GATEWAY_API_KEY) in .env.local

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";

// Load .env.local
config({ path: path.resolve(__dirname, "../.env.local") });

import { chunkConversation } from "../lib/knowledge/chunker";
import { embedChunks } from "../lib/knowledge/embedder";
import { upsertKnowledgeChunks } from "../lib/knowledge/upsert";
import { getPrimaryDomain, FILE_DOMAIN_MAP } from "./tag-domains";

const KNOWLEDGE_DIR = path.resolve(
  __dirname,
  "../../../../speaker-building-knowledge"
);

interface FrontMatter {
  title: string;
  url?: string;
}

function parseFrontMatter(content: string): FrontMatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { title: "Untitled" };

  const lines = match[1].split("\n");
  const result: FrontMatter = { title: "Untitled" };

  for (const line of lines) {
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
  const files = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
  console.log(`\n📚 Found ${files.length} conversation files\n`);

  let totalChunks = 0;
  let processed = 0;

  for (const fileName of files) {
    const filePath = path.join(KNOWLEDGE_DIR, fileName);
    const rawContent = fs.readFileSync(filePath, "utf-8");
    const { title, url } = parseFrontMatter(rawContent);
    const agentDomain = getPrimaryDomain(fileName);

    console.log(`[${processed + 1}/${files.length}] ${fileName}`);
    console.log(`  Domain: ${agentDomain} | Title: ${title}`);

    // Chunk
    const chunks = chunkConversation(rawContent, title);
    console.log(`  Chunks: ${chunks.length}`);

    // Embed
    const texts = chunks.map((c) => c.content);
    const embeddings = await embedChunks(texts);

    // Upsert
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
    console.log(`  ✓ Ingested ${chunks.length} chunks\n`);
  }

  console.log(`\n✅ Done. ${processed} files, ${totalChunks} total chunks ingested.\n`);
}

main().catch((err) => {
  console.error("❌ Ingestion failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Install tsx for script execution**

```bash
cd web && npm install -D tsx
```

- [ ] **Step 3: Add script to package.json**

In `web/package.json`, add to the `"scripts"` section:

```json
"ingest": "tsx scripts/ingest-conversations.ts"
```

- [ ] **Step 4: Verify TypeScript compilation**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add web/scripts/ingest-conversations.ts web/package.json
git commit -m "feat: ingestion CLI script for 23 ChatGPT conversation files"
```

---

### Task 6: Knowledge Search API

**Files:**
- Create: `web/app/api/knowledge/search/route.ts`

- [ ] **Step 1: Create the search route**

```typescript
// web/app/api/knowledge/search/route.ts
// POST /api/knowledge/search
// Body: { query: string, domain?: AgentDomain, limit?: number }
// Returns: top-k knowledge chunks by cosine similarity

import { NextRequest, NextResponse } from "next/server";
import { embed } from "ai";
import { db } from "@/lib/db";
import { knowledgeChunks } from "@/lib/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { z } from "zod";

const SearchSchema = z.object({
  query: z.string().min(1).max(2000),
  domain: z.enum(["acoustics", "enclosure", "crossover", "theory", "mechanical", "research", "manager"]).optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, domain, limit } = SearchSchema.parse(body);

    // Embed the query
    const { embedding } = await embed({
      model: "openai/text-embedding-3-small",
      value: query,
    });

    const embeddingStr = `[${embedding.join(",")}]`;

    // Cosine similarity search via pgvector
    // drizzle doesn't support <=> operator natively, use sql tag
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
      return NextResponse.json({ error: "Invalid request", details: err.errors }, { status: 400 });
    }
    console.error("[knowledge/search]", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Install zod if not present**

```bash
cd web && npm list zod 2>/dev/null || npm install zod
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add web/app/api/knowledge/search/route.ts
git commit -m "feat: knowledge search API with pgvector cosine similarity"
```

---

### Task 7: NotebookLM Source Registration

**Files:**
- Create: `web/scripts/register-notebooklm.ts`

- [ ] **Step 1: Create the NotebookLM source registration script**

```typescript
// web/scripts/register-notebooklm.ts
// Run: npx tsx scripts/register-notebooklm.ts
// Registers the NotebookLM notebook as a first-class source in the DB.
// Does NOT ingest content (NotebookLM exports aren't programmatically accessible).
// Instead, stores the notebook URL so the Research Agent can surface it during queries.

import * as path from "path";
import { config } from "dotenv";

config({ path: path.resolve(__dirname, "../.env.local") });

import { db } from "../lib/db";
import { sources } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const NOTEBOOKLM_URL = process.env.NOTEBOOKLM_URL ||
  "https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c";

async function main() {
  console.log("\n📓 Registering NotebookLM source...\n");

  const existing = await db
    .select()
    .from(sources)
    .where(eq(sources.notebooklmUrl, NOTEBOOKLM_URL));

  if (existing.length > 0) {
    console.log("✓ NotebookLM source already registered:", existing[0].id);
    return;
  }

  const inserted = await db
    .insert(sources)
    .values({
      name: "APEX Speaker Design — NotebookLM Knowledge Base",
      sourceType: "notebooklm",
      url: NOTEBOOKLM_URL,
      notebooklmUrl: NOTEBOOKLM_URL,
      totalChunks: 0,  // Content queried live by Research Agent, not pre-chunked
      isIngested: false,  // Not ingested — accessed via URL by Research Agent
    })
    .returning();

  console.log("✅ Registered NotebookLM source:", inserted[0].id);
  console.log("   URL:", NOTEBOOKLM_URL);
  console.log("\n   The Research Agent will surface this notebook URL during domain queries.\n");
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Add script to package.json**

```json
"register-notebooklm": "tsx scripts/register-notebooklm.ts"
```

- [ ] **Step 3: Commit**

```bash
git add web/scripts/register-notebooklm.ts web/package.json
git commit -m "feat: NotebookLM source registration script"
```

---

### Task 8: Knowledge Stats API

**Files:**
- Create: `web/app/api/knowledge/stats/route.ts`

- [ ] **Step 1: Create stats endpoint**

```typescript
// web/app/api/knowledge/stats/route.ts
// GET /api/knowledge/stats
// Returns chunk counts per domain, total sources, ingestion status

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
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors

- [ ] **Step 3: Build to verify**

```bash
cd web && npm run build 2>&1 | tail -20
```

Expected: successful build, zero errors

- [ ] **Step 4: Commit**

```bash
git add web/app/api/knowledge/stats/route.ts
git commit -m "feat: knowledge stats API — chunk counts by domain"
```

---

### Task 9: Process Documentation

**Files:**
- Create: `docs/process/phase-2-knowledge-pipeline.md`

- [ ] **Step 1: Write the process doc**

After all code tasks are complete and verified, write the Phase 2 process doc to `docs/process/phase-2-knowledge-pipeline.md` following the same format as `docs/process/phase-1-foundation.md`.

Cover:
- What was built (ingestion script, chunker, embedder, search API, NotebookLM registration)
- Design decisions (chunking strategy, embedding model choice, pgvector search, NotebookLM as non-ingested source)
- Issues encountered + fixes
- How to run the ingestion pipeline
- How to run a search query
- Next phase preview

- [ ] **Step 2: Commit**

```bash
git add docs/process/phase-2-knowledge-pipeline.md
git commit -m "docs: Phase 2 knowledge pipeline process documentation"
```

---

## Running the Full Pipeline (After DB Setup)

Prerequisites:
1. Neon project created at https://console.neon.tech
2. pgvector enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
3. `web/.env.local` contains `DATABASE_URL`
4. AI Gateway configured OR `OPENAI_API_KEY` set (for embeddings)
5. Schema pushed: `cd web && npx drizzle-kit push`
6. HNSW index created: `CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);`

Then:
```bash
cd web
npm run ingest                  # Ingest all 23 conversations
npm run register-notebooklm     # Register NotebookLM source
```

Test:
```bash
curl -X POST http://localhost:3000/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query": "passive radiator vs port design", "domain": "enclosure", "limit": 3}'
```
