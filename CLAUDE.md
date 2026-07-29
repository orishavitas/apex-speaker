# APEX Speaker Design Intelligence — Project Context

**APEX** is a multi-agent AI assistant for loudspeaker design. Agents are grounded in Ori's personal knowledge base via pgvector RAG.

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

**Live:** https://web-blue-theta-12.vercel.app — All sprints merged to master, production live.

---

## Current Focus — Sprint 4-D candidates

- Live SPL frequency plot in workspace
- Driver fuzzy-match: auto-link VXP DRIVER refs to driver_database rows
- T/S param edit modal (driver DB)
- Per-message domain badge (FE-4)
- CSV import endpoint for driver bulk-load

---

## Critical Implementation Notes

- **AI SDK v6 breaking changes:** `useChat` requires `Chat` + `DefaultChatTransport`. Use `sendMessage({text})` not `append`. Response is `UIMessage` with `parts` array — no `content` string.
- **Lazy DB init:** `neon()` is wrapped in a Proxy to avoid module-eval-time errors at build time when `DATABASE_URL` is absent. Never call `neon()` at module scope.
- **AI Gateway auth:** Uses OIDC (`VERCEL_OIDC_TOKEN`). Run `vercel env pull` after linking — no manual API keys needed.
- **Embedder uses OpenAI directly:** `lib/knowledge/embedder.ts` uses `openai.embedding('text-embedding-3-small')` — NOT the AI Gateway. `OPENAI_API_KEY` must be in `.env.local` for ingest.
- **Drizzle vector bug:** Drizzle's `vector()` column serializes as `{"x","y",...}` which pgvector rejects. Workaround: raw `getNeon()` client with tagged template literal + `::vector(1536)` cast. See `lib/knowledge/upsert.ts`.
- **Chunk hard-cap:** `lib/knowledge/chunker.ts` enforces `HARD_CAP_CHARS=28000` (~7000 tokens) — prevents exceeding OpenAI 8192-token embedding limit.
- **`onFinish` callbacks:** Wrap any DB writes inside `after()` from `next/server` — otherwise they race Vercel function teardown.
- **`readMemory` must filter by key:** Always `.find(e => e.key === 'wizard_profile')` — never trust `[0]` is your key.
- **`writeMemory` upsert:** Use `db.transaction()` or Drizzle `.onConflictDoUpdate()` — bare SELECT+INSERT is not atomic.
- **Prompt injection guard:** Never inject user-derived strings into system prompts without allowlist validation. All WizardProfile enum fields must match their closed set before `JSON.stringify` injection.
- **Response header size limit:** HTTP response headers cap at ~8KB via Vercel proxy. Do not use headers as a transport for structured JSON objects.
- **Wizard fetch routing:** The `DefaultChatTransport` fetch closure in `chat/page.tsx` must pass `api` directly to `globalThis.fetch(api, init)` — do NOT use `url.toString().replace(...)`. String replace against a relative path silently fails and the wizard session escapes to manager on turn 2.
- **Wizard gate:** `profileConfidence()` counts 6 user-provided signals (budget, placement, use_case, sound_signature, room_size, amplifier). `experience_level` is excluded — always auto-inferred. Gate fires at >= 4 of 6.
- **code-review-swarm plugin:** Invoke via `Skill("code-review-swarm")`. Runs 5 specialist reviewer agents in parallel.

---

## Design Language

- Zinc dark (`#09090b` background)
- Monospace headings (`font-mono`)
- APEX symbol: ◈
- Domain badges: acoustics=violet, enclosure=amber, crossover=sky, theory=emerald, mechanical=orange, research=rose, manager=zinc

---

## NotebookLM

https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c — 23 ingested speaker design conversation exports, 78 chunks, HNSW index live.

---

## Nexus Harness

This repo is wired into the Nexus agentic development system.

**Dispatch source:** `.agent-harness/inbox/` — task packets land here. Agents do not read monday.com for dispatch.
**Writeback:** `.agent-harness/outbox/{task-id}.result.md` — every task ends with a populated result file.
**Evidence:** `.agent-harness/artifacts/{task-id}/` — test output, verification logs.
**Monitor:** Run `python C:/Users/OriShavit/Documents/GitHub/project_nexus/monitor/monitor.py` to countersign completed results.
**Schema:** `.agent-harness/config/manifest/schema.yaml` — 9 task types, evidence requirements.

### Session Start Protocol

1. Read `MEMORY.md` — current state, key decisions, blockers
2. Read `TODO.md` — what's next and current phase
3. Check `.agent-harness/inbox/` for any active task packet
4. Read `legion-vault/projects/apex-speaker/index.md` for sprint state

### Vault Ingest (Automatic)

Every session triggers vault ingest at Stop via `session_stop.py` → `vault_ingest_agent.py`.

**What gets written:**
- `raw/repos/apex-speaker/{date}/` — immutable quartet copy (never overwrites)
- `projects/apex-speaker/index.md` — rewritten with current sprint state
- `system/index.md` — cross-repo row update
- `system/ingest-log.md` — append-only entry

**Verify:** `tail -5 .agent-harness/logs/vault-ingest.ndjson` — look for `vault_ingest_complete`

**Manual re-run:**
```bash
python C:\Users\OriShavit\Documents\GitHub\project_nexus\scripts\vault_ingest_agent.py --runtime claude --session-id manual --repo-path C:\Users\OriShavit\Documents\GitHub\apex-speaker
```

**Constraint:** Never write directly to `system/`, `projects/`, or `raw/repos/` in the vault. Only `vault_ingest_agent.py` writes there.

### Completion Anchors

Every completed task must update before claiming done:
- `TODO.md` — mark completed work, set next actionable item
- `MEMORY.md` — refresh current state, latest verified task, blockers
- `CHANGELOG.md` — add dated entry for what changed

Name the completing agent and session date in each update.
