# CHANGELOG

## 2026-04-02 — Sprint 3: Math Engine + Workspace Results UI

**Branch:** `master`

### Sprint 3 Executive Brief
Purpose: Connect the Thiele-Small math engine to the workspace UI so acoustic predictions appear live in every WayCard as the user configures enclosure type and volume. Previously, `calcSealedBox`, `calcPortedBox`, and `calcHornLoading` existed as complete implementations with no UI surface.

### What Was Done

**Task 1 — `/api/drivers/[id]` endpoint** (`web/app/api/drivers/[id]/route.ts`)
New single-driver fetch route. Returns full driver row by UUID. Used by WayCard to retrieve T/S parameters when a driver is assigned to a way. Returns 404 gracefully if driver not found or DB unavailable.

**Task 2 — `WaySlot.netVolumeLiters` field** (`web/lib/types/speaker-domain.ts`)
Added optional `netVolumeLiters` field to the `WaySlot` interface. The existing persistence hook (`useDesignStatePersistence`) serializes the entire slot as JSONB, so this field is stored and restored automatically with no schema migration needed.

**Task 3 — WayCard volume input**
Added a numeric input (litres) below the enclosure type selector for sealed/ported enclosures. Writes back via `onWayChange` — persisted in the design state JSONB with 800ms debounce.

**Task 4 — T/S parameter fetch**
`useEffect` in WayCard watches `slot.driverDatabaseId`. When set, fetches from `/api/drivers/[id]`, maps the DB row to `ThieleSmallParams` via `driverRowToTS()`. Driver name displayed in the WayCard header. Graceful null handling for drivers with incomplete params.

**Task 5 — Math results panels**
- `SealedResults`: shows Qtc, f3 (Hz), fb (Hz), peak_dB (highlighted amber if >0), and a quality string from `sealedBoxQuality()` (e.g. "Near-Butterworth — flat response, optimal")
- `PortedResults`: shows fb, f3, group delay (ms), port velocity (m/s) — velocity highlighted amber if >15 m/s, with chuffing warning from `portVelocityWarning()`
- `HornResults`: shows fc (Hz), efficiency (%), mouth loading (dB) — shows "enter dimensions" placeholder if throat/mouth not yet filled

**Also fixed** — `rag-context.ts` was using AI Gateway model string for embeddings (silent failure without billing activation). Switched to `openai.embedding()` directly, matching the ingest pipeline fix from last session.

### Files Modified
- `web/app/api/drivers/[id]/route.ts` — new endpoint
- `web/app/dashboard/workspace/page.tsx` — WayCard math wiring
- `web/lib/types/speaker-domain.ts` — WaySlot.netVolumeLiters
- `web/lib/types/speaker-math.ts` — full T/S math implementation
- `web/lib/agents/rag-context.ts` — embedder fix

---

## 2026-04-01 — Sprint 2 Hardening + Phase 5 Production Deploy

**Branch:** `master` (all work committed directly)

### Deployed
- **Production live:** https://web-blue-theta-12.vercel.app
- **Neon DB:** connected via Vercel integration, schema pushed, pgvector enabled
- **Knowledge base:** 23/23 conversation files ingested — 78 chunks, HNSW cosine index created

### Fixed — Knowledge Ingest Pipeline
- **Embedder bypass:** Switched from AI Gateway model string (`"openai/text-embedding-3-small"`) to `openai.embedding()` provider directly via `@ai-sdk/openai`. AI Gateway requires project-level billing activation; direct OpenAI key bypasses this.
- **Drizzle vector serialization bug:** Drizzle's `vector()` column type serializes `number[]` as `{"x","y",...}` (JSON object notation) which pgvector rejects with "invalid input syntax for type vector". Fixed by bypassing Drizzle entirely for embedding inserts — use raw neon tagged template with `::vector(1536)` cast. Exported `getNeon()` from `lib/db/index.ts`.
- **Chunk token limit:** Added `HARD_CAP_CHARS=28000` (~7000 tokens) hard-cap to chunker. One file (07-cardioid-speakers-amp-options.md) had a single chunk exceeding OpenAI's 8192-token limit; now splits on word boundaries.
- **Enum name fix:** pgvector status enum is `knowledge_status`, not `chunk_status`.

### Files Modified
- `web/lib/knowledge/embedder.ts` — use `@ai-sdk/openai` provider directly
- `web/lib/knowledge/upsert.ts` — raw neon SQL for embedding insert
- `web/lib/knowledge/chunker.ts` — hard-cap at 28000 chars
- `web/lib/db/index.ts` — export `getNeon()` raw client

---

## 2026-03-31 — Sprint 2: Workspace Hardening

**Branch:** `feature/workspace-hardening-sprint-2` (merged to master)

### Added
- **`useDesignStatePersistence` hook** (`web/lib/hooks/`) — debounced 800ms PATCH, optimistic concurrency with version field, 409 conflict recovery, offline fallback
- **Workspace persistence** — workspace page loads from DB on mount, saves every config change (topology, enclosure type, loading variant)
- **Save indicator** — `· saving...` / `· saved` / `· save failed` in Col 1 header (zinc/emerald/red)
- **Active project chip** — shows active VituixCAD project ID in workspace Col 1 with ✕ clear button
- **`LoadIntoWorkspaceButton`** (`web/components/apex/`) — client component on project detail page; PATCHes `activeVituixcadProjectId` then navigates to workspace
- **`.vxd` driver import** — upload route extracts T/S params and upserts into `driver_database` via `onConflictDoUpdate`; response includes `driversImported: N`
- **`inferDriverType`** (`web/lib/mappers/`) — regex + fs-fallback heuristic maps VituixCAD category strings to `driverTypeEnum`
- **`vxdDriverToInsert`** (`web/lib/mappers/`) — maps `VxdDriverRaw` → Drizzle insert shape for `driver_database`
- **`WORKSPACE_PROJECT_ID` constant** (`web/lib/constants/`) — singleton UUID for workspace design state
- **Suspense + `useSearchParams`** — workspace reads `?activeProject=` query param and persists it to design state

### Fixed
- `mapThieleSmall` NaN guard — `Number(param._v)` returns NaN for empty/"N/A" values; now skipped
- `parseVxd` PARAM guard — individual driver nodes with missing PARAM no longer crash the parser
- `onConflictDoUpdate` set block — fixed incorrect self-reference; now uses `sql\`excluded.*\`` for true upsert semantics

### Process
Same debate-team methodology as Sprint 1: 4 parallel specialist agents → meta-synthesis spec → parallel execution windows (W0→W1→W2).

---

## 2026-03-30 — Sprint 1: VituixCAD Integration

**Branch:** `feature/vituixcad-sprint-1`

### Added
- **VituixCAD XML parser** (`web/lib/parser/`) — fast-xml-parser v4, handles .vxp/.vxd/.vxb, isArray override for single-element edge case, `ParseError` class with fileType
- **Canonical type system** (`web/lib/types/speaker-domain.ts`) — `ThieleSmallParams` (unit-suffixed), `LoadingConfig` discriminated union (horn/waveguide/TL/direct), `SpeakerConfig`, `DesignState`, `WaySlot`, helpers
- **Math stubs** (`web/lib/types/speaker-math.ts`) — `calcSealedBox`, `calcPortedBox`, `calcHornLoading` return typed result objects; bodies throw "not implemented — Sprint 2"
- **T/S parameter mapper** (`web/lib/parser/ts-param-mapper.ts`) — maps VituixCAD native names (Re, fs, BL) to canonical unit-suffixed names (Re_ohms, fs_hz, BL_Tm)
- **DB schema additions** (`web/lib/db/schema.ts`) — 4 new enums, 3 new tables (vituixcad_projects, driver_database, design_state)
- **8th agent: vituixcad** — system prompt, keyword routing (13 trigger terms), active project context injection, domain badge (teal ⊞)
- **API routes** — POST /api/upload, GET /api/projects, GET /api/projects/[id], GET+PATCH /api/design-state, GET /api/drivers
- **Dashboard pages** — /dashboard/projects (drag-drop upload, 5-state UX), /dashboard/projects/[id] (JSON viewer), /dashboard/drivers (dense sortable table), /dashboard/workspace (3-column CSS Grid: config | driver slots | chat)
- **Top navigation** (`web/components/apex/top-nav.tsx`) — Projects, Drivers, Workspace, Chat; active route detection via usePathname
- **Sprint spec** (`docs/superpowers/specs/2026-03-30-vituixcad-sprint-1-spec.md`) — 1055-line debate-synthesized spec

### Changed
- `agentDomainEnum` — added 'vituixcad'
- `sourceTypeEnum` — added 'vituixcad_project', 'driver_measurement'
- Dashboard layout — replaced left sidebar with top navigation bar

### Process Innovation
Introduced **debate-team sprint planning**: 4 specialist agents argue in parallel (schema, UI, domain logic, sprint plan), meta-orchestrator synthesizes into final spec, then parallel subagent execution by dependency window. SOP documented in memory/sprint-methodology.md.

---

## 2026-03-27 — Phases 1–4 Complete

Phases 1–4 merged to master: Next.js foundation, knowledge pipeline (23 ChatGPT conversations ingested), 7-agent architecture, dashboard chat UI with streaming and domain badges.

## 2026-04-05 — Wizard Sprint v2

### Fixed
- **[CRITICAL] Profile never persisted** — `writeMemory` was never called. Added `onFinish` callback to `streamText` that writes `serializeProfile(profile)` to `agent_memory` after every turn. Wizard now has state across turns and sessions.
- **[CRITICAL] experience_level leaked into system prompt** — `JSON.stringify(profile)` included the level field. Now destructured out before prompt injection; injected separately in a clearly labelled internal-only block.
- **[HIGH] budget_low falsy guard** — `!p.budget_low` evaluates true on $0 budgets. Fixed to `=== undefined`.
- **[HIGH] __WIZARD_TRIGGER__ regex** — `String.replace(str)` only removes first occurrence. Changed to global regex `/g`.
- **[HIGH] Signal extraction** — Added `parseSignalsFromMessages()`: scans all user messages for budget, placement, use_case, sound_signature, room_size, amplifier, experience_level using keyword patterns. Merges into profile before every request.
- **[MEDIUM] wizardActiveRef sync** — Added `useEffect` to sync `wizardActive` state → `wizardActiveRef` preventing stale closure in transport fetch.
- **[MEDIUM] streamText unguarded** — Wrapped in try/catch, returns 500 JSON on model failure.

### Added
- `room_size` and `amplifier` signals to `WizardProfile` (7 signals total, gate fires at 5/7)
- Desktop topology detection in `deriveProjectedBuild`
- System prompt: expert shortcut (3+ signals in one message), refusal/skip handling, off-topic escalation, experience-adaptive confirmation gate language (3 register variants)

### Docs
- `docs/wizard-sprint/versions/` — v1 and v2 snapshots of all 4 changed files
- `docs/wizard-sprint/logs/v2-improvements.md` — full annotated change log
- `docs/superpowers/plans/2026-04-03-wizard-sprint-v2.md` — sprint plan

### Open
- `X-Wizard-Profile` header returning `{}` in production — debug log added, investigation pending on resume
