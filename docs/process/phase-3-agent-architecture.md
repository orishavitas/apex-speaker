# Phase 3: Agent Architecture — Process Document

**Date:** 2026-03-26
**Status:** Complete
**Branch:** phase-3-agent-architecture

---

## What Was Built

7 streaming AI agents with RAG retrieval, per-project memory, and keyword-based routing through the Project Manager.

### Deliverables

| Component | Location | Purpose |
|-----------|----------|---------|
| Agent types | `web/lib/agents/types.ts` | Shared types: AgentDomain, ChatMessage, AgentChatRequest, KnowledgeContext |
| System prompts | `web/lib/agents/system-prompts.ts` | Deep-domain system prompts for all 7 agents |
| RAG context | `web/lib/agents/rag-context.ts` | pgvector cosine similarity retrieval, prompt-formatted |
| Agent memory | `web/lib/agents/memory.ts` | Per-project scratchpad read/write with promotion flag |
| Specialist route | `web/app/api/agents/[domain]/route.ts` | Handles all 6 specialist domains via dynamic segment |
| Manager route | `web/app/api/agents/manager/route.ts` | Routes to specialists, adds domain label to response |
| Seed route | `web/app/api/agents/seed/route.ts` | Idempotent DB population of agents table |

---

## Design Decisions

### Single Dynamic Route for All 6 Specialists

Rather than 6 separate route files, a single `[domain]/route.ts` handles all specialist domains. The domain is validated against the `VALID_DOMAINS` array at runtime. This keeps the specialist logic DRY — all 6 agents share the same RAG retrieval, memory, and streaming logic. Only their system prompts differ.

### Keyword-Based Routing (Phase 3)

The Project Manager uses a keyword scoring approach to classify incoming queries to a domain. Each domain has a curated keyword list; the domain with the highest score wins; ties default to `research`.

This is intentionally simple for Phase 3. Phase 4 (UI) will upgrade to LLM-based routing where the manager makes an explicit tool call to classify the query before responding.

### Graceful Degradation When DB Is Unavailable

Both RAG context retrieval and memory reads are wrapped in try/catch. If `DATABASE_URL` is not set or the Neon connection fails, the agents fall back to their base system prompts and still respond. This means the app works without a DB for development/testing — agents just answer from their training without domain-specific retrieved knowledge.

### `toUIMessageStreamResponse` (AI SDK v6)

AI SDK v5 used `toDataStreamResponse()`. In v6, the correct method is `toUIMessageStreamResponse()` — this returns a UI-message-compatible stream that the Phase 4 `useChat` hook consumes. Similarly, `maxTokens` is now `maxOutputTokens`.

### Messages Format

Rather than using `convertToModelMessages()` (which requires UIMessage format from the frontend), the routes accept plain `{role, content}` arrays — identical to the `ChatMessage` type. This keeps the API simple for Phase 4's `useChat` hook to consume via `DefaultChatTransport`.

### NotebookLM in Research Agent System Prompt

The Research Agent's system prompt explicitly includes the NotebookLM notebook URL. When the Research Agent answers questions about sources, synthesis, or literature, it can surface the notebook link directly in its response — giving the user a direct path to deeper synthesis.

---

## Issues Encountered + Fixes

| Issue | Fix |
|-------|-----|
| `maxTokens` not recognized in AI SDK v6 | Renamed to `maxOutputTokens` |
| `toDataStreamResponse()` doesn't exist in v6 | Changed to `toUIMessageStreamResponse()` |
| `convertToCoreMessages` doesn't exist in v6 | Removed — mapped messages inline to `{role, content}` objects |

---

## How to Use

### Seed Agents Table (After DB Setup)
```bash
curl -X POST http://localhost:3000/api/agents/seed
```

### Call a Specialist
```bash
curl -X POST http://localhost:3000/api/agents/enclosure \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "optional-project-uuid",
    "messages": [
      {"role": "user", "content": "What port diameter for a 12L box tuned to 45Hz?"}
    ]
  }'
```

### Call the Project Manager
```bash
curl -X POST http://localhost:3000/api/agents/manager \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "I want to build a bookshelf speaker with the RS180. Where do I start?"}
    ]
  }'
```

The manager response includes an `X-Routed-Domain` header indicating which domain was selected for routing.

---

## Agent Endpoints

| Endpoint | Domain |
|----------|--------|
| `POST /api/agents/manager` | Project Manager |
| `POST /api/agents/acoustics` | Acoustics Specialist |
| `POST /api/agents/enclosure` | Enclosure Specialist |
| `POST /api/agents/crossover` | Crossover Specialist |
| `POST /api/agents/theory` | Theory Specialist |
| `POST /api/agents/mechanical` | Mechanical Specialist |
| `POST /api/agents/research` | Research Specialist |
| `POST /api/agents/seed` | Seed agents table |

---

## Next Phase

**Phase 4: UI/Dashboard**
- Chat interface with `useChat` + `DefaultChatTransport` pointed at `/api/agents/manager`
- AI Elements for all AI text rendering (`<Message>`, `<MessageResponse>`)
- Domain routing indicator — show which specialist was consulted
- Knowledge explorer panel — browse chunks by domain, view sources
- Agent status sidebar — live chunk counts from `/api/knowledge/stats`
- Memory promotion UI — promote agent scratchpad entries to canonical KB

NotebookLM URL: https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c
