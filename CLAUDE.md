# APEX Speaker Design Intelligence — Project Context

> **New session?** Read this file first. It's everything you need to pick up where we left off.

---

## What Is This

**APEX** is a multi-agent AI assistant for loudspeaker design, built by Ori.

A speaker designer (professional, with deep domain knowledge) exports their ChatGPT project conversations and ingests them into a personal knowledge base. APEX routes every question to the right specialist agent, pulling relevant context from that knowledge base via pgvector RAG, then answers in real-time with streaming.

**Not a generic chatbot.** Every agent has a deep system prompt tuned to its domain. Every answer is grounded in Ori's actual design history.

---

## Architecture

```
User Browser
  → /dashboard/chat (Next.js, AI SDK v6 useChat)
    → /api/agents/manager (keyword router)
      → /api/agents/[domain] (specialist agent)
        → Vercel AI Gateway (anthropic/claude-sonnet-4-6)
        → Neon PostgreSQL + pgvector (RAG knowledge chunks)
        → agent_memory table (per-project scratchpad)
```

**8 agents:** manager · acoustics · enclosure · crossover · theory · mechanical · research · vituixcad

**Stack:** Next.js 16 · AI SDK v6 · Drizzle ORM · Neon PostgreSQL · pgvector · Vercel AI Gateway · shadcn/ui (zinc dark)

**VituixCAD integration (Sprint 1 — feature/vituixcad-sprint-1 branch):**
- `web/lib/parser/` — fast-xml-parser based .vxp/.vxd/.vxb parser
- `web/lib/types/speaker-domain.ts` — canonical domain model (SpeakerConfig, Way, LoadingConfig discriminated union)
- `web/lib/types/speaker-math.ts` — T/S math engine: calcSealedBox, calcPortedBox, calcHornLoading (Sprint 3 — fully implemented)
- 3 new DB tables: vituixcad_projects, driver_database, design_state
- 4 new routes: /dashboard/projects, /dashboard/drivers, /dashboard/workspace, /dashboard/projects/[id]
- 5 new API routes: /api/upload, /api/projects, /api/projects/[id], /api/design-state, /api/drivers

---

## Current Status

| Phase | Status |
|-------|--------|
| Phase 1 — Foundation (Next.js, DB schema, shadcn) | ✅ Complete |
| Phase 2 — Knowledge Pipeline (ingest, embed, RAG search) | ✅ Complete |
| Phase 3 — Agent Architecture (7 agents, routing, memory) | ✅ Complete |
| Phase 4 — UI Dashboard (chat, streaming, domain badges) | ✅ Complete |
| Phase 5 — Vercel Deployment | ✅ **LIVE** — https://web-blue-theta-12.vercel.app |
| Sprint 1 — VituixCAD Integration | ✅ Complete (merged to master) |
| Sprint 2 — Workspace Hardening | ✅ Complete (merged to master) |
| Sprint 3 — Math Engine + Results UI | ✅ Complete |
| Wizard Sprint v2 — Fixes + hardening | 🔄 **IN PROGRESS** — code deployed, profile header bug under investigation |
| Knowledge Ingest | ✅ **23/23 files ingested** — 78 chunks, HNSW index live |

All phases + sprints merged into `master`. **Production is live.**

---

## Live URLs

- **Production:** https://web-blue-theta-12.vercel.app
- **Vercel project:** orishavitas-projects/web
- **Neon DB:** connected via Vercel integration (env vars auto-provisioned)

---

## Next Steps

### Wizard Sprint v2 — CHECKPOINT (2026-04-05)

All code fixes committed and pushed (commit `5bfb4f2`). **One open bug:** `X-Wizard-Profile` response header returns `{}` despite signal extraction logic being correct (verified locally). Likely cause: Vercel deployment serving stale build OR `npx vercel ls` needed to confirm active deployment SHA matches `5bfb4f2`.

**To resume:** Check which SHA is actually serving production (`vercel ls`), force redeploy if needed, then run 5 test scenarios from the sprint plan.

**Wizard v2 fixes shipped:**
1. ✅ Profile persistence via `onFinish` + `writeMemory`
2. ✅ `experience_level` stripped from system prompt JSON
3. ✅ `isProfileComplete` fixed (persistence was the root cause)
4. ✅ `budget_low` falsy guard fixed (`=== undefined`)
5. ✅ `__WIZARD_TRIGGER__` regex made global
6. ✅ Signal extraction from conversation history (`parseSignalsFromMessages`)
7. ✅ 7 signals: added `room_size` + `amplifier`
8. ✅ `wizardActive` → `wizardActiveRef` `useEffect` sync
9. ✅ `streamText` wrapped in try/catch
10. ✅ System prompt: expert shortcut, refusal handling, adaptive confirmation gate

**Deferred to v3:** LLM echoing profile state block back to user (needs prompt clarification), WizardPane showing all 7 signals, workspace chat wiring.

### Sprint 4 candidates:
- Horn dimension persistence: `HornLoadingPanel` fields not wired to `onWayChange` — values disappear on re-render
- Workspace chat (Col 3): static input, not wired to agent API
- Driver fuzzy-match: auto-link VXP DRIVER refs to driver_database rows
- Live SPL frequency plot in workspace

---

## Key Files

### Core (Phases 1–4)

| Path | What It Does |
|------|-------------|
| `web/app/dashboard/chat/page.tsx` | Main chat UI (AI SDK v6 Chat + DefaultChatTransport) |
| `web/app/api/agents/manager/route.ts` | Keyword routing → picks specialist domain |
| `web/app/api/agents/[domain]/route.ts` | Specialist agents with RAG + memory |
| `web/lib/db/index.ts` | Lazy Neon proxy — defers connection to first request |
| `web/lib/db/schema.ts` | 9 tables: agents, projects, knowledge_chunks, sources, agent_memory, conversations, vituixcad_projects, driver_database, design_state |
| `web/lib/agents/system-prompts.ts` | Deep domain prompts for all 8 agents |
| `web/lib/agents/rag-context.ts` | pgvector cosine search, formatted for injection |
| `web/scripts/ingest-conversations.ts` | `npm run ingest` — embeds 23 conversation files |
| `web/scripts/register-notebooklm.ts` | `npm run register-notebooklm` — registers NLM source |
| `docs/process/phase-5-deployment.md` | Full deployment reference with env vars table |

### Sprint 1 — VituixCAD Integration

| Path | What It Does |
|------|-------------|
| `web/lib/parser/vituixcad-parser.ts` | fast-xml-parser v4 — parses .vxp/.vxd/.vxb files, handles single-element isArray edge case |
| `web/lib/parser/ts-param-mapper.ts` | Maps VituixCAD native names (Re, fs, BL) → canonical unit-suffixed names (Re_ohms, fs_hz, BL_Tm) |
| `web/lib/types/speaker-domain.ts` | Canonical domain model: ThieleSmallParams, LoadingConfig discriminated union, SpeakerConfig, DesignState, WaySlot |
| `web/lib/types/speaker-math.ts` | Math stubs: calcSealedBox, calcPortedBox, calcHornLoading — implemented in Sprint 2 |
| `web/app/api/upload/route.ts` | POST — accepts .vxp/.vxd/.vxb, parses, stores in vituixcad_projects |
| `web/app/api/projects/route.ts` | GET — lists all VituixCAD projects |
| `web/app/api/projects/[id]/route.ts` | GET — single project with full parsed data |
| `web/app/api/design-state/route.ts` | GET + PATCH — workspace design state persistence |
| `web/app/api/drivers/route.ts` | GET — driver database listing |
| `web/app/dashboard/projects/page.tsx` | Project list with drag-drop upload, 5-state UX |
| `web/app/dashboard/projects/[id]/page.tsx` | Single project JSON viewer |
| `web/app/dashboard/drivers/page.tsx` | Dense sortable driver database table |
| `web/app/dashboard/workspace/page.tsx` | 3-column CSS Grid: config panel / driver slots / chat |
| `web/components/apex/top-nav.tsx` | Top navigation bar (Projects, Drivers, Workspace, Chat) with active route detection |

---

## Critical Implementation Notes

- **AI SDK v6 breaking changes:** `useChat` now requires `Chat` + `DefaultChatTransport`. Use `sendMessage({text})` not `append`. Response is `UIMessage` with `parts` array — no `content` string.
- **Lazy DB init:** `neon()` is wrapped in a Proxy to avoid module-eval-time errors during Next.js build when `DATABASE_URL` is absent. Never call `neon()` at module scope.
- **Graceful degradation:** App works without `DATABASE_URL` — agents answer from system prompts, RAG + memory are silently skipped.
- **AI Gateway auth:** Uses OIDC (`VERCEL_OIDC_TOKEN`). Run `vercel env pull` after linking — no manual API keys needed.
- **Embedder uses OpenAI directly:** `lib/knowledge/embedder.ts` uses `openai.embedding('text-embedding-3-small')` via `@ai-sdk/openai` — NOT the AI Gateway. AI Gateway model strings don't work for embeddings without billing activation. `OPENAI_API_KEY` must be in `.env.local` for ingest to run.
- **Drizzle vector bug:** Drizzle's `vector()` column serializes `number[]` as `{"x","y",...}` (JSON object notation) which pgvector rejects. Workaround: use raw `getNeon()` client with tagged template literal and `::vector(1536)` cast. See `lib/knowledge/upsert.ts`.
- **Chunk hard-cap:** `lib/knowledge/chunker.ts` enforces `HARD_CAP_CHARS=28000` (~7000 tokens) to prevent exceeding OpenAI's 8192-token embedding limit.
- **NotebookLM:** No API. Registered in DB as `source_type: 'notebooklm'`. Research agent surfaces it by URL.

---

## Design Language

- Zinc dark (#09090b background)
- Monospace headings (font-mono)
- APEX symbol: ◈
- Domain badges: colored pills (acoustics=violet, enclosure=amber, crossover=sky, theory=emerald, mechanical=orange, research=rose, manager=zinc)

---

## NotebookLM

URL: https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c
Contains: all 23 ingested speaker design conversation exports
