# Phase 1: Foundation — Process Document

**Date:** 2026-03-26
**Status:** Complete
**Branch:** phase-1-foundation

---

## What Was Built

A complete Next.js 16 application scaffold for APEX — the Speaker Design Intelligence Platform. This phase establishes every foundational layer that all subsequent phases build on.

### Deliverables

| Component | Location | Purpose |
|-----------|----------|---------|
| Next.js 16 app | `web/` | App Router, Turbopack, TypeScript strict |
| APEX design system | `web/app/globals.css` | Zinc-950 dark theme, electric blue accent, agent color tokens |
| shadcn/ui | `web/components/ui/` | button, card, badge, separator, tooltip, tabs, scroll-area, dialog |
| AgentBadge component | `web/components/apex/agent-badge.tsx` | Domain-colored badge for all 7 agents |
| Sidebar | `web/components/apex/sidebar.tsx` | Left nav with agent roster + NotebookLM link |
| Dashboard shell | `web/app/dashboard/page.tsx` | Main layout with all agents displayed |
| Drizzle schema | `web/lib/db/schema.ts` | 6 tables: agents, projects, conversations, knowledge_chunks, agent_memory, sources |
| Drizzle client | `web/lib/db/index.ts` | neon-http adapter for serverless Edge compatibility |
| Health API | `web/app/api/health/route.ts` | `/api/health` returns system status |

---

## Design Decisions

### Why Dark Theme?
Engineering instrument aesthetic. Spectrum analyzers, oscilloscopes, DAW software — all dark. This is a technical tool for people who spend hours staring at frequency response curves. Dark zinc-950 reduces eye strain and makes the electric blue (#4f9cf9) accent pop as a visual anchor.

### Why Zinc Palette + Single Accent?
Zinc is neutral-cool (slightly blue-gray), which complements the electric blue accent without fighting it. A single accent color forces visual hierarchy through spacing and typography, not rainbow noise. Each agent domain has its own color (blue, green, amber, violet, slate, cyan) — these are intentionally muted so they can coexist without cacophony.

### Why Drizzle ORM over Prisma?
1. **Edge-compatible**: Drizzle works with Neon's HTTP driver in Edge/serverless contexts. Prisma requires a connection pool and doesn't work in Edge runtimes without a proxy.
2. **SQL-transparent**: Drizzle's query builder maps directly to SQL. Easy to optimize, easy to debug, no magic.
3. **Lightweight**: No binary engine download, no postinstall scripts.

### Why `drizzle-orm/neon-http` not `drizzle-orm/neon-serverless`?
The `neon-serverless` adapter uses WebSocket connections (NeonPool) which need persistent connections. The `neon-http` adapter uses HTTP fetch, which works in any serverless/Edge context with zero connection management. For a stateless Next.js app on Vercel, HTTP is the right choice.

### Why pgvector via `customType`?
Drizzle ORM doesn't natively export a `vector` column type from `drizzle-orm/pg-core`. The `customType` utility lets us define `vector(1536)` as a PostgreSQL column type directly. The HNSW index must be created separately post-push via raw SQL (`CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)`) — Drizzle doesn't support `USING hnsw` syntax in its index builder.

### Why `notebooklm` as a `source_type` enum value?
NotebookLM is a first-class knowledge source for this project. The Research Agent will query it for synthesis. Adding it to the enum from day one means knowledge chunks sourced from NotebookLM exports can be tagged and searched separately from forum threads or book chapters.

### Why `sources.notebooklm_url` column?
Sources can have an associated NotebookLM notebook. When a book or document is added as a source, the researcher can also attach a NotebookLM notebook URL for AI-powered synthesis. The Research Agent uses this URL to surface notebook links alongside citations.

---

## Issues Encountered + Fixes

| Issue | Fix |
|-------|-----|
| `lib/utils.ts` not created by shadcn (wrote `components.json` manually) | Created `lib/utils.ts` with `cn()` using clsx + tailwind-merge |
| `@radix-ui/react-sheet` doesn't exist | Removed from install — shadcn's Sheet component uses `@radix-ui/react-dialog` |
| Drizzle index array syntax (`(table) => [...]`) TypeScript error | Changed to object syntax `(table) => ({ key: index(...) })` |
| `tw-animate-css` not installed | Added to `npm install` |

---

## How to Extend

### Add a new agent domain
1. Add value to `agentDomainEnum` in `web/lib/db/schema.ts`
2. Add entry to `AGENT_CONFIG` in `web/components/apex/agent-badge.tsx`
3. Add to `AGENTS` array in `web/components/apex/sidebar.tsx`
4. Run `npx drizzle-kit push` to migrate the enum

### Add a new source type
1. Add value to `sourceTypeEnum` in `web/lib/db/schema.ts`
2. Run `npx drizzle-kit push`

### Connect to Neon database
1. Create a Neon project at https://console.neon.tech
2. Enable pgvector: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Copy connection string to `web/.env.local` as `DATABASE_URL`
4. Run `cd web && npx drizzle-kit push`
5. Create HNSW index: `CREATE INDEX ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);`
6. Seed agents table (see Phase 1 plan for seed script)

---

## Next Phase

**Phase 2: Knowledge Pipeline**
- Ingest 23 scraped ChatGPT conversations from `speaker-building-knowledge/` into Neon via embeddings
- Book PDF chunking pipeline (LangChain-style recursive text splitting)
- NotebookLM integration: Research Agent queries notebook for synthesis
- Forum crawler (Playwright MCP agent): DIYAudio, AudioScienceReview, Parts Express
- Knowledge search API endpoint with cosine similarity

NotebookLM URL: https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c
