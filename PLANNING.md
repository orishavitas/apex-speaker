<!-- SEED: type=application, status=active, seeded=2026-03-28 -->
# Apex Speaker — PLANNING.md

## Type
Application (retroactive — Phases 1-4 complete, Phase 5 deploy pending)

## Problem Statement
Multi-agent AI assistant for professional loudspeaker design. Routes questions to domain-specialist agents, grounded in Ori's personal design history (23 ChatGPT conversation exports) via RAG. Every answer reflects real project decisions, not generic AI output.

## Tech Stack (Confirmed)
- **Framework:** Next.js 16, TypeScript
- **AI:** AI SDK v6, Vercel AI Gateway (Claude Sonnet 4.6)
- **Database:** Neon PostgreSQL + pgvector, Drizzle ORM
- **UI:** shadcn/ui (zinc dark theme)
- **Knowledge:** 23 ChatGPT conversation files → pgvector chunks

## Data Model
6 DB tables:
- `agents` — 7 specialist definitions (manager, acoustics, enclosure, crossover, theory, mechanical, research)
- `projects` — user projects/designs
- `knowledge_chunks` — RAG embeddings from conversation exports
- `sources` — original conversation file metadata
- `agent_memory` — per-project scratchpad for specialists
- `conversations` — chat history

## API Surface
```
/api/agents/manager    → keyword router (dispatches to specialists)
/api/agents/[domain]   → specialist endpoint (acoustics, enclosure, etc.)
```
Each specialist: AI Gateway → Claude + pgvector RAG + agent_memory read/write

## Architecture
```
Browser → /dashboard/chat (useChat)
  → /api/agents/manager (keyword router)
    → /api/agents/[domain] (specialist agent)
      → Vercel AI Gateway → Claude Sonnet 4.6
      → Neon pgvector (RAG chunks)
      → agent_memory table (per-project scratchpad)
```

## Deployment Strategy
- Target: Vercel (Neon via Marketplace integration)
- Repo: private GitHub (orishavitas/apex-speaker — to be created)
- Branch: master = production

## Security Considerations
- Private repo, no public access initially
- Neon credentials via Vercel Marketplace auto-provisioning
- AI Gateway OIDC auth (auto via vercel env pull)

## Phase Breakdown

### Phase 1: Foundation [DONE]
- Next.js 16 scaffold, Drizzle ORM schema, shadcn/ui setup

### Phase 2: Knowledge Pipeline [DONE]
- ChatGPT conversation parser, pgvector embedding, ingest script

### Phase 3: Agent System [DONE]
- 7 specialist agents, keyword router, AI Gateway integration

### Phase 4: Chat UI [DONE]
- Dashboard with useChat, domain badges, streaming responses

### Phase 5: Deploy to Vercel [NEXT]

**Task 5.1: Create GitHub repo**
- Action: `gh repo create orishavitas/apex-speaker --private --source=. --push`
- Verify: `gh repo view orishavitas/apex-speaker` returns repo info
- AC: Given local repo exists, When gh repo create runs, Then remote repo exists and code is pushed

**Task 5.2: Link to Vercel**
- Action: `cd web && vercel link`
- Verify: `.vercel/project.json` exists with project ID
- AC: Given Vercel account is authenticated, When vercel link runs, Then project is linked and .vercel/project.json exists

**Task 5.3: Add Neon integration**
- Action: `vercel integration add neon`
- Verify: Neon database provisioned, env vars auto-populated
- AC: Given Vercel project is linked, When neon integration is added, Then DATABASE_URL is available in Vercel env vars

**Task 5.4: Pull env vars**
- Action: `vercel env pull .env.local`
- Verify: `.env.local` contains DATABASE_URL and VERCEL_OIDC_TOKEN
- AC: Given integrations are configured, When vercel env pull runs, Then .env.local has all required env vars

**Task 5.5: Push schema + HNSW index**
- Action: `npx drizzle-kit push` then create HNSW index on knowledge_chunks.embedding
- Verify: All 6 tables exist in Neon, HNSW index active
- AC: Given DATABASE_URL is set, When drizzle-kit push runs, Then all 6 tables exist and HNSW index is created

**Task 5.6: Ingest knowledge base**
- Action: `npm run ingest && npm run register-notebooklm`
- Verify: `SELECT COUNT(*) FROM knowledge_chunks` > 0
- AC: Given schema is pushed, When ingest runs, Then knowledge_chunks has embedded data from all 23 conversation files

**Task 5.7: Deploy to production**
- Action: `vercel deploy --prod`
- Verify: Production URL loads, /dashboard/chat responds, agent routing works
- AC: Given all previous steps passed, When vercel deploy --prod runs, Then production URL loads and a test question routes to correct specialist

### Phase 6: Post-Deploy Enhancements [FUTURE]
- Project memory UI (view/edit agent_memory per project)
- Knowledge search UI at `/knowledge`
- Sources page at `/sources`
- New chat button
- Domain badge animation
- Dark/light theme toggle

## Open Questions
- Should agent_memory be queryable via a dedicated UI or just visible in chat context?
- What's the plan for adding new knowledge sources (new ChatGPT exports, PDFs, datasheets)?
- Should specialists be able to call sub-specialists (e.g., crossover agent consults acoustics)?

## Skill Loadout
- **SEED** (ideation) — used retroactively for this doc
- **Beads** (task tracking) — track Phase 5 deploy sequence
- **GSD** (execution) — phased workflow for deploy
- **Vercel CLI** — deploy commands
