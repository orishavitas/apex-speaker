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

**7 agents:** manager · acoustics · enclosure · crossover · theory · mechanical · research

**Stack:** Next.js 16 · AI SDK v6 · Drizzle ORM · Neon PostgreSQL · pgvector · Vercel AI Gateway · shadcn/ui (zinc dark)

---

## Current Status

| Phase | Status |
|-------|--------|
| Phase 1 — Foundation (Next.js, DB schema, shadcn) | ✅ Complete |
| Phase 2 — Knowledge Pipeline (ingest, embed, RAG search) | ✅ Complete |
| Phase 3 — Agent Architecture (7 agents, routing, memory) | ✅ Complete |
| Phase 4 — UI Dashboard (chat, streaming, domain badges) | ✅ Complete |
| Phase 5 — Vercel Deployment | ⏳ Pending (awaiting user to run deploy steps) |

All phases merged into `master`. App runs locally: `cd web && npm run dev` → http://localhost:3000

---

## Next Steps

See [`TODO.md`](../TODO.md) for the full Phase 5 deployment checklist.

Short version:
1. `gh repo create orishavitas/apex-speaker --private --source=. --push`
2. `cd web && vercel link`
3. `vercel integration add neon`
4. `vercel env pull .env.local`
5. `npx drizzle-kit push`
6. `npm run ingest && npm run register-notebooklm`
7. `vercel deploy --prod`

---

## Key Files

| Path | What It Does |
|------|-------------|
| `web/app/dashboard/chat/page.tsx` | Main chat UI (AI SDK v6 Chat + DefaultChatTransport) |
| `web/app/api/agents/manager/route.ts` | Keyword routing → picks specialist domain |
| `web/app/api/agents/[domain]/route.ts` | Specialist agents with RAG + memory |
| `web/lib/db/index.ts` | Lazy Neon proxy — defers connection to first request |
| `web/lib/db/schema.ts` | 6 tables: agents, projects, knowledge_chunks, sources, agent_memory, conversations |
| `web/lib/agents/system-prompts.ts` | Deep domain prompts for all 7 agents |
| `web/lib/agents/rag-context.ts` | pgvector cosine search, formatted for injection |
| `web/scripts/ingest-conversations.ts` | `npm run ingest` — embeds 23 conversation files |
| `web/scripts/register-notebooklm.ts` | `npm run register-notebooklm` — registers NLM source |
| `docs/process/phase-5-deployment.md` | Full deployment reference with env vars table |

---

## Critical Implementation Notes

- **AI SDK v6 breaking changes:** `useChat` now requires `Chat` + `DefaultChatTransport`. Use `sendMessage({text})` not `append`. Response is `UIMessage` with `parts` array — no `content` string.
- **Lazy DB init:** `neon()` is wrapped in a Proxy to avoid module-eval-time errors during Next.js build when `DATABASE_URL` is absent. Never call `neon()` at module scope.
- **Graceful degradation:** App works without `DATABASE_URL` — agents answer from system prompts, RAG + memory are silently skipped.
- **AI Gateway auth:** Uses OIDC (`VERCEL_OIDC_TOKEN`). Run `vercel env pull` after linking — no manual API keys needed.
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
