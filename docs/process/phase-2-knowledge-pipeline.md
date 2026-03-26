# Phase 2: Knowledge Pipeline — Process Document

**Date:** 2026-03-26
**Status:** Complete
**Branch:** phase-2-knowledge-pipeline

---

## What Was Built

A complete knowledge ingestion pipeline that transforms the 23 scraped ChatGPT speaker conversations into searchable, domain-tagged vector embeddings in Neon PostgreSQL.

### Deliverables

| Component | Location | Purpose |
|-----------|----------|---------|
| Domain tagging map | `web/scripts/tag-domains.ts` | Maps each of 23 files to its primary agent domain |
| Conversation chunker | `web/lib/knowledge/chunker.ts` | Splits markdown conversations into ~800-token chunks |
| Embedder | `web/lib/knowledge/embedder.ts` | AI SDK `embedMany` wrapper, batched, rate-limited |
| DB upsert helper | `web/lib/knowledge/upsert.ts` | Idempotent chunk + source upsert to Neon |
| Ingestion CLI | `web/scripts/ingest-conversations.ts` | `npm run ingest` — processes all 23 files end-to-end |
| NotebookLM registration | `web/scripts/register-notebooklm.ts` | Registers notebook as first-class DB source |
| Knowledge search API | `web/app/api/knowledge/search/route.ts` | POST `/api/knowledge/search` — cosine similarity |
| Knowledge stats API | `web/app/api/knowledge/stats/route.ts` | GET `/api/knowledge/stats` — counts by domain |

---

## Design Decisions

### Chunking Strategy: Conversation-Aware Splitting

Each `.md` file contains a ChatGPT conversation formatted with `---` separators between User and Assistant turns. The chunker splits on these separators, then merges adjacent turns into blocks of ≤3200 characters (~800 tokens at 4 chars/token average).

**Why not fixed-size token splitting?** Splitting mid-turn destroys the question→answer coherence that makes these conversations valuable for RAG. A question without its answer, or an answer without its question, scores poorly on relevance. The conversation-aware approach keeps the full exchange intact.

**Fallback:** If no separators are found, falls back to word-boundary fixed-size splitting so no content is lost.

### Embedding Model: `openai/text-embedding-3-small` via AI Gateway

1536 dimensions — matches the `vector(1536)` column in `knowledge_chunks`. OpenAI's `text-embedding-3-small` is the right balance of cost, speed, and quality for a domain-specific corpus of this size.

All embedding calls route through the Vercel AI Gateway using model strings (no provider-specific API key needed — OIDC authentication handles it).

### NotebookLM: Source Registration vs. Content Ingestion

NotebookLM doesn't expose a programmatic API for extracting notebook content. Rather than treating this as a blocker, the approach is:

- Register the notebook as a `source_type: "notebooklm"` record in the `sources` table
- The `isIngested` flag is `false` — this is intentional, not a TODO
- The Research Agent (Phase 3) surfaces the notebook URL whenever a query benefits from synthesis
- When the user manually exports notes from NotebookLM, those can be ingested as `source_type: "notebooklm"` chunks in a future pass

This keeps NotebookLM as a first-class knowledge source without requiring access to a closed API.

### Lazy DB Initialization

The `lib/db/index.ts` originally called `neon(process.env.DATABASE_URL!)` at module evaluation time. This caused Next.js build-time failures when collecting page data for API routes — the DB connection was attempted before environment variables were injected.

Fixed by wrapping the connection in a lazy proxy: `neon()` is only called when the `db` object is first used in a request handler. This means:
- Build succeeds with no `DATABASE_URL` present
- Requests at runtime get a clear error message if `DATABASE_URL` is missing
- No impact on existing API surface — `db.select()`, `db.insert()`, etc. all work identically

### `force-dynamic` on API Routes

Both `/api/knowledge/search` and `/api/knowledge/stats` export `dynamic = "force-dynamic"`. This prevents Next.js from attempting to statically render these routes at build time, which would fail without a database connection.

---

## Issues Encountered + Fixes

| Issue | Fix |
|-------|-----|
| `neon()` called at module eval time → build failure | Lazy proxy in `lib/db/index.ts` — connection deferred to first request |
| `zod.ZodError` in v4 has `.issues` not `.errors` | Changed `err.errors` → `err.issues` in search route |
| Build still collected API routes → `force-dynamic` insufficient alone | Required both `force-dynamic` export AND lazy DB init together |
| TypeScript: `as Record<...>` cast on Drizzle DB type | Added `as unknown as Record<...>` double-cast for Proxy get handler |

---

## How to Run the Pipeline

### Prerequisites

1. Neon project at https://console.neon.tech
2. pgvector enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
3. `web/.env.local` with `DATABASE_URL=postgresql://...`
4. Schema pushed: `cd web && npx drizzle-kit push`
5. HNSW index: `CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);`
6. AI Gateway configured OR `OPENAI_API_KEY` set for embeddings

### Run

```bash
cd web
npm run ingest               # Ingest 23 conversations (creates ~90-120 chunks)
npm run register-notebooklm  # Register NotebookLM source
```

### Test Search

```bash
# Passive radiator vs port design
curl -X POST http://localhost:3000/api/knowledge/search \
  -H "Content-Type: application/json" \
  -d '{"query": "passive radiator vs port design", "domain": "enclosure", "limit": 3}'

# Check ingestion stats
curl http://localhost:3000/api/knowledge/stats
```

### Expected Output (after ingestion)

`/api/knowledge/stats` should return something like:
```json
{
  "chunks": {
    "byDomain": {
      "acoustics": 42,
      "enclosure": 31,
      "theory": 18,
      "mechanical": 9,
      "research": 15,
      "crossover": 8
    },
    "total": 123
  },
  "sources": { "total": 24, "ingested": 23 }
}
```
(24 sources = 23 conversations + 1 NotebookLM)

---

## Next Phase

**Phase 3: Agent Architecture**
- 6 specialist agents + Project Manager using AI SDK `Agent` class
- Each agent: system prompt + RAG retrieval from `knowledge_chunks` (scoped to domain)
- Project Manager routes queries to specialists, aggregates responses
- Hybrid memory: private `agent_memory` scratchpad → promoted to `knowledge_chunks` on confidence threshold
- Workflow DevKit for durable multi-step reasoning tasks
- Agent-to-agent communication via Project Manager only (no direct lateral calls)

NotebookLM URL: https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c
