# Section 7: Multi-Session Coordination & Implementation Plan

**Date:** 2026-03-28
**Status:** Approved — Implementation Ready
**Parent spec:** `docs/superpowers/specs/2026-03-26-apex-system-design.md`

---

## 7.1 Overview

APEX requires seven parallel workstreams spanning an estimated 14–20 sessions of development. Coordinating this work across multiple Claude Code sessions, optional Gemini CLI agents, and human handoffs demands explicit dependency contracts, atomic task claiming, and artifact-based handoffs.

**Coordination stack:**
- **Beads** (`bd`) — persistent task graph with dependency tracking and atomic claiming. Single source of truth for "what is in flight."
- **Artifact contracts** — TypeScript interface files committed to git. A session is only "done" when its artifact file exists, compiles, and passes a type-check. These files ARE the handoff.
- **`docs/artifacts/`** — staging area for draft contracts before they graduate to `web/lib/`.

No real-time messaging (Claude Peers MCP) is required. Git commits are the message bus.

---

## 7.2 Session Dependency Graph

```
S1: VituixCAD XML Parser + Data Model
S2: Literature Pipeline (Marker + chunker + ingest)
          │
          ├─── Both S1 and S2 can start immediately (no dependencies)
          │
          ▼
S4: Database Schema Evolution ──────────────────────┐
          │ (depends on S1 types + S2 types)        │
          ▼                                          │
S3: Agent Architecture ─────────────────────────────┤
          │ (depends on S1 data model)               │
          │                                          │
S5: Math Foundation Interfaces                       │
          │ (depends on S1 types only)               │
          │                                          │
          └──────────────────┬─────────────────────-┘
                             ▼
                    S6: UI Dashboard Evolution
                    (depends on S1, S3, S4)

S7: Deploy (Phase 5)
    (independent — can run any time after Next.js scaffold exists)
```

### Parallelism windows

| Window | Sessions that can run simultaneously |
|--------|--------------------------------------|
| Window 0 | S1, S2, S7 |
| Window 1 | S3, S5 (after S1 artifact lands) |
| Window 2 | S4 (after S1 + S2 artifacts land) |
| Window 3 | S6 (after S1 + S3 + S4 artifacts land) |

Window 0 is the highest-leverage parallelism opportunity — S1 and S2 are fully independent and collectively represent 4–6 sessions of work.

---

## 7.3 Artifact Contracts

These files are the interface boundary between workstreams. A downstream session MUST NOT begin until its upstream artifact files exist, compile cleanly, and are committed to the main branch (or a shared integration branch).

### 7.3.1 `web/lib/vituixcad/types.ts`

**Produced by:** S1 (VituixCAD XML Parser)
**Consumed by:** S3 (Agent Architecture), S4 (DB Schema), S5 (Math Foundation), S6 (UI Dashboard)

Minimum required exports:
```typescript
export interface VituixCADProject { ... }
export interface DriverParameters { ... }   // Thiele-Small parameters
export interface MeasurementData { ... }    // SPL, impedance curves
export interface CrossoverTopology { ... }
export interface EnclosureSpec { ... }
export type VituixCADEntityType = 'driver' | 'enclosure' | 'crossover' | 'measurement';
```

**Completeness gate:** `npx tsc --noEmit` passes with this file in scope.

### 7.3.2 `web/lib/literature/types.ts`

**Produced by:** S2 (Literature Pipeline)
**Consumed by:** S4 (DB Schema), S6 (UI Dashboard — citation panel)

Minimum required exports:
```typescript
export interface LiteratureChunk { ... }
export interface LiteratureSource { ... }
export interface IngestJob { ... }
export type SourceType = 'chatgpt_conversation' | 'book_chapter' | 'forum_thread' | 'datasheet' | 'research_paper';
export type Domain = 'acoustics' | 'enclosure' | 'crossover' | 'theory' | 'mechanical' | 'research' | 'general';
```

**Completeness gate:** `npx tsc --noEmit` passes with this file in scope.

### 7.3.3 `web/lib/design/types.ts`

**Produced by:** S5 (Math Foundation Interfaces)
**Consumed by:** S3 (Agent Architecture — Theory agent tools), S6 (UI Dashboard — metrics display)

Minimum required exports:
```typescript
export interface ThieleSmallParams { ... }
export interface FrequencyResponsePoint { ... }
export interface CrossoverFilterSpec { ... }
export interface BoxTuningResult { ... }
export type MathToolInput = ThieleSmallParams | CrossoverFilterSpec | BoxTuningInput;
export type MathToolOutput = FrequencyResponsePoint[] | BoxTuningResult | FilterCoefficients;
```

**Completeness gate:** `npx tsc --noEmit` passes with this file in scope.

### 7.3.4 `web/lib/db/schema.ts`

**Produced by:** S4 (Database Schema Evolution)
**Consumed by:** All sessions — this is the Drizzle ORM schema that all server actions and agents use

Minimum required tables (additions to existing Phase 1 schema):
```
vituixcad_projects    — links to projects table, stores XML parse metadata
vituixcad_drivers     — TS params, measurement refs
vituixcad_enclosures  — box type, dimensions, port tuning
vituixcad_crossovers  — topology, component values
literature_sources    — replaces/extends existing sources table
literature_chunks     — extends existing knowledge_chunks table
design_sessions       — links VituixCAD project to agent conversation
```

**Completeness gate:** `npx drizzle-kit generate` produces migration without errors. `npx drizzle-kit migrate` applies to dev Neon instance without errors.

---

## 7.4 Beads Task Graph Setup

Run these commands once, in order, to initialize the full APEX task graph. Run from the apex-speaker repo root.

```bash
# -- EPIC: APEX Full Implementation --
bd create "APEX: Full Implementation Epic" --priority 0
# Note the returned ID (e.g. bd-e1) — replace <epic> below

# -- S1: VituixCAD Parser --
bd create "S1: VituixCAD XML parser (schema analysis + Go/TS impl)" --parent <epic>
bd create "S1: VituixCAD data model + types.ts artifact" --parent <epic>
bd create "S1: VituixCAD ingest agent tool wrappers" --parent <epic>

# -- S2: Literature Pipeline --
bd create "S2: Marker PDF pipeline + chapter chunker" --parent <epic>
bd create "S2: Knowledge ingest worker (embed + store)" --parent <epic>
bd create "S2: Forum crawler agent (Playwright MCP)" --parent <epic>
bd create "S2: literature/types.ts artifact" --parent <epic>

# -- S3: Agent Architecture --
bd create "S3: VituixCAD specialist agent + tool registry" --parent <epic>
bd create "S3: Cross-agent context routing (PM orchestration)" --parent <epic>
bd create "S3: Agent memory promotion (private → canonical)" --parent <epic>

# -- S4: Database Schema Evolution --
bd create "S4: Drizzle schema additions (vituixcad + literature tables)" --parent <epic>
bd create "S4: Migration + seed scripts for dev Neon" --parent <epic>

# -- S5: Math Foundation --
bd create "S5: Math tool interfaces (TS types + Zod schemas)" --parent <epic>
bd create "S5: Theory agent tool implementations (box tuning, FR calc)" --parent <epic>

# -- S6: UI Dashboard Evolution --
bd create "S6: VituixCAD project panel + file upload" --parent <epic>
bd create "S6: Agent conversation view (PM chat → specialist routing display)" --parent <epic>
bd create "S6: Knowledge explorer + citation panel" --parent <epic>
bd create "S6: Measurement data visualizer (FR curve, impedance)" --parent <epic>

# -- S7: Deploy --
bd create "S7: Vercel deploy + Neon marketplace integration" --parent <epic>
bd create "S7: Environment variable audit + Remote Control setup" --parent <epic>
```

### Setting dependencies

After all tasks are created, record their IDs with `bd list`, then set dependencies:

```bash
# S3 blocked by S1 data model (S1 tasks 1 and 2)
bd dep add <s3-task-1> <s1-types-task>
bd dep add <s3-task-2> <s1-types-task>
bd dep add <s3-task-3> <s1-types-task>

# S4 blocked by both S1 types and S2 types
bd dep add <s4-schema-task> <s1-types-task>
bd dep add <s4-schema-task> <s2-types-task>
bd dep add <s4-migration-task> <s4-schema-task>

# S5 blocked by S1 types only
bd dep add <s5-interfaces-task> <s1-types-task>
bd dep add <s5-impl-task> <s5-interfaces-task>

# S6 blocked by S1 types, S3 architecture, and S4 schema
bd dep add <s6-panel-task> <s1-types-task>
bd dep add <s6-panel-task> <s4-migration-task>
bd dep add <s6-chat-task> <s3-task-2>
bd dep add <s6-chat-task> <s4-migration-task>
bd dep add <s6-knowledge-task> <s2-types-task>
bd dep add <s6-knowledge-task> <s4-migration-task>
bd dep add <s6-viz-task> <s1-types-task>
```

After wiring dependencies, `bd ready` will show only S1, S2, and S7 tasks — exactly the sessions that can safely start in Window 0.

---

## 7.5 Session Execution Order

### Window 0 — Launch Immediately (Parallel)

Three workstreams can start right now with no gate checks.

**S1 launch (Claude Code session):**
```bash
# In apex-speaker repo
bd update <s1-parser-task> --claim
# Then: implement XML parser, data model, types.ts
```

**S2 launch (separate terminal tab or Gemini CLI):**
```bash
# Gemini for literature pipeline research pass:
gemini -y -p "Research the Marker library (https://github.com/DS4SD/docling) for PDF chunking. Output: a structured plan for ingesting speaker design PDFs into a PostgreSQL pgvector database. Include chunking strategy, metadata schema, and embedding model recommendation. Write findings to /c/Users/OriShavit/Documents/GitHub/apex-speaker/docs/research/s2-literature-pipeline.md"

# Or spawn a parallel Claude tab:
start wt.exe -- "C:\Program Files\Git\usr\bin\bash.exe" -c "cd /c/Users/OriShavit/Documents/GitHub/apex-speaker && claude -p 'Implement the Literature Pipeline (S2): Marker PDF chunker, knowledge ingest worker, literature/types.ts artifact. See docs/superpowers/specs/section-7-coordination-plan.md for contract spec.' --dangerously-skip-permissions; read"
```

**S7 launch (any time, independent):**
```bash
gemini -y -p "Audit the apex-speaker Next.js project at /c/Users/OriShavit/Documents/GitHub/apex-speaker for Vercel deployment readiness. Check: vercel.json, environment variables, next.config.js, build output. Produce a deploy checklist at docs/research/s7-deploy-checklist.md"
```

### Window 1 — After S1 Artifact Lands

Gate check before starting S3 or S5:
```bash
# Verify S1 artifact exists and compiles
npx tsc --noEmit 2>&1 | grep vituixcad/types
# Must: no errors
# Must: file exists at web/lib/vituixcad/types.ts
# Must: all required exports present (grep check)
grep -E "export (interface|type)" web/lib/vituixcad/types.ts
```

If gate passes: `bd update <s1-types-task> --status done` then `bd ready` unlocks S3 and S5 tasks.

### Window 2 — After S1 + S2 Artifacts Land

Gate check before starting S4:
```bash
npx tsc --noEmit
grep -E "export (interface|type)" web/lib/literature/types.ts
```

### Window 3 — After S1 + S3 + S4

Gate check before starting S6:
```bash
npx drizzle-kit generate
npx drizzle-kit migrate
npx tsc --noEmit
bd list | grep -E "S3.*done"
```

---

## 7.6 Parallel Dispatch Patterns

### Pattern A: Claude + Gemini on independent research

Use Gemini for research passes, Claude for implementation. Research output lands in `docs/research/`. Claude ingests the research file and implements.

```bash
# Gemini researches, Claude implements
gemini -y -p "Research VituixCAD XML file format. Find any open-source parsers, document the schema structure, identify all major XML elements. Write findings to /c/Users/OriShavit/Documents/GitHub/apex-speaker/docs/research/vituixcad-xml-schema.md"

# Claude reads the research and implements
# (in Claude Code session):
# Read docs/research/vituixcad-xml-schema.md, then implement web/lib/vituixcad/parser.ts
```

### Pattern B: Two Claude tabs for S1 + S2

Launch two Windows Terminal tabs with separate Claude agents. Each claims its Beads task atomically — no collision risk.

```bash
# Tab 1: S1
start wt.exe -- "C:\Program Files\Git\usr\bin\bash.exe" -c "cd /c/Users/OriShavit/Documents/GitHub/apex-speaker && claude --dangerously-skip-permissions; read"

# Tab 2: S2
start wt.exe -- "C:\Program Files\Git\usr\bin\bash.exe" -c "cd /c/Users/OriShavit/Documents/GitHub/apex-speaker && claude --dangerously-skip-permissions; read"
```

Each agent runs `bd ready` on start and claims the appropriate task with `bd update --claim`. Because claiming is atomic, both agents cannot claim the same task.

### Pattern C: Gemini for documentation + Claude for code

While Claude implements S3 agent architecture, Gemini writes the process doc:

```bash
gemini -y -p "Read /c/Users/OriShavit/Documents/GitHub/apex-speaker/docs/superpowers/specs/2026-03-26-apex-system-design.md and write a process doc for Phase 3 (Agent Architecture) at docs/process/phase-3-agents.md. Format: what was planned, implementation decisions, how to extend it. Write as if the phase is complete."
```

### Pattern D: Subagent-within-session for isolated analysis

Within a single Claude session, dispatch a subagent for file analysis while the main session continues planning:

```
Task(model="claude-haiku-4-5", prompt="Analyze all VituixCAD .vxp sample files in docs/samples/ and extract the XML element hierarchy. Return a structured schema tree.")
```

---

## 7.7 Handoff Protocol

Each handoff is a checklist. The upstream session MUST complete every item before the downstream session claims its Beads tasks.

### S1 → S3, S4, S5, S6 Handoff

**Upstream (S1) must produce:**
- [ ] `web/lib/vituixcad/types.ts` committed to main
- [ ] `web/lib/vituixcad/parser.ts` — working XML parser with at least one test case
- [ ] `web/lib/vituixcad/index.ts` — barrel export
- [ ] `npx tsc --noEmit` passes cleanly (zero errors)
- [ ] All required type exports present (see 7.3.1 completeness gate)
- [ ] `docs/process/phase-vituixcad-parser.md` — brief process doc
- [ ] Beads task `bd update <s1-types-task> --status done`
- [ ] `bd ready` output shows S3/S5 tasks as unblocked

**Downstream session opener (S3):**
```bash
bd ready
# Confirm S3 tasks appear
bd update <s3-task-1> --claim
# Read web/lib/vituixcad/types.ts before writing any agent code
```

### S2 → S4 Handoff

**Upstream (S2) must produce:**
- [ ] `web/lib/literature/types.ts` committed to main
- [ ] `web/workers/ingest-worker.ts` — functional ingest worker (can be stub with real interface)
- [ ] `npx tsc --noEmit` passes cleanly
- [ ] All required type exports present (see 7.3.2 completeness gate)
- [ ] `docs/process/phase-literature-pipeline.md`
- [ ] Beads task marked done
- [ ] `bd ready` shows S4 tasks unblocked

### S4 → S6 Handoff

**Upstream (S4) must produce:**
- [ ] `web/lib/db/schema.ts` updated with all new tables
- [ ] Migration SQL generated by `npx drizzle-kit generate`
- [ ] Migration applied to dev Neon without errors
- [ ] `docs/process/phase-db-schema.md`
- [ ] Beads tasks marked done
- [ ] `bd ready` shows S6 tasks unblocked (in combination with S3 done)

### S3 → S6 Handoff

**Upstream (S3) must produce:**
- [ ] `web/lib/agents/vituixcad-agent.ts` — specialist agent implementation
- [ ] `web/lib/agents/pm-agent.ts` — updated PM with new routing logic
- [ ] `web/lib/agents/types.ts` — agent message types and routing interfaces
- [ ] All agent tools registered and callable via AI SDK `tool()` API
- [ ] `npx tsc --noEmit` passes cleanly
- [ ] `docs/process/phase-agent-architecture.md`
- [ ] Beads tasks marked done

### S5 → S3, S6 Handoff

**Upstream (S5) must produce:**
- [ ] `web/lib/design/types.ts` committed
- [ ] Zod schemas for all math tool inputs (for AI SDK tool validation)
- [ ] At least one working calculation function (box tuning or FR curve)
- [ ] `npx tsc --noEmit` passes cleanly
- [ ] Beads tasks marked done

---

## 7.8 Integration Testing Plan

After all parallel workstreams complete (before S6 begins in earnest), run a full integration smoke test.

### 7.8.1 Type-level integration check

```bash
# All artifacts must coexist without TypeScript conflicts
npx tsc --noEmit

# Check cross-references compile
# (S4 schema imports from S1 + S2 types)
# (S3 agents import from S1 types + S5 design types)
# Any error here = an artifact contract was violated
```

### 7.8.2 Database integration check

```bash
# Schema applies cleanly to a fresh Neon branch
npx drizzle-kit migrate

# Seed data round-trip: ingest one VituixCAD file, one literature chunk
npx tsx web/scripts/seed-integration-test.ts
# Expected output: "Seeded 1 vituixcad_project, 1 driver, 3 literature_chunks"
```

### 7.8.3 Agent smoke test

```bash
# Start dev server
npm run dev

# Run agent integration test
npx tsx web/scripts/agent-smoke-test.ts
# Send a message to PM agent, verify:
# - PM routes to at least one specialist
# - Specialist returns a structured response
# - Response cites at least one knowledge chunk
```

### 7.8.4 UI integration check

```bash
# Visual smoke test via Playwright MCP
# Navigate to localhost:3000
# Upload a sample VituixCAD file
# Verify it appears in the project panel
# Send one message to PM agent
# Verify response renders in AI Elements component
```

### 7.8.5 Integration test ownership

Each workstream owner writes a minimal integration test script as part of their handoff. These scripts live in `web/scripts/` and are prefixed with `integration-`. CI does not run them automatically — they are manually triggered before each session window transition.

---

## 7.9 Rollback Strategy

### Scenario: S1 artifact is incompatible with what S3 assumed

**Symptoms:** S3 session produces TypeScript errors importing from `web/lib/vituixcad/types.ts`. Types don't match expected shape.

**Response:**
1. S3 session creates a compatibility shim at `web/lib/vituixcad/compat.ts` that maps actual types to expected shapes. This keeps S3 moving.
2. File a Beads task: `bd create "S1/S3 type alignment — resolve compat shim" --priority 0 --parent <epic>`
3. After both sessions complete, resolve the shim by negotiating the canonical type in a reconciliation session.
4. Reconciliation rule: the DB schema (S4) is the arbitrator — the type that fits the schema without migration wins.

### Scenario: S2 produces a different SourceType enum than S4 expects

**Response:**
1. S4 defines the canonical enum in `web/lib/db/schema.ts` using Drizzle's `pgEnum`.
2. `web/lib/literature/types.ts` imports and re-exports from the schema. S2 artifact is updated to align.
3. Rule: **database schema is the canonical type source for any value stored in Neon.** All other type files import from schema, not the reverse.

### Scenario: A session produces a breaking change to an existing artifact

**Response:**
1. Never delete or rename an existing export from an artifact file without a deprecation cycle.
2. Pattern: add the new export, mark old as `@deprecated`, file a Beads task to remove the deprecated export after all consumers are updated.
3. Use git blame to identify which sessions consume the export before removing.

### Scenario: Gemini CLI produces incorrect research output

**Response:**
1. All Gemini research output goes to `docs/research/` only — never directly to `web/lib/`.
2. Claude Code always reads and validates research before implementing.
3. No Gemini output is treated as ground truth until a Claude Code session has verified it against actual file inspection.

### Scenario: Parallel sessions create a git merge conflict in schema.ts

**Response:**
1. This should not happen if dependency gates are followed — S4 is the only session writing to `schema.ts`.
2. If it does happen: the session that committed first wins. The second session rebases and reconciles manually.
3. `git rerere` is enabled on this repo — record resolutions for reuse.

---

## 7.10 Estimated Total Effort

| Workstream | Sessions | Hours/Session | Total Hours | Critical Path |
|------------|----------|--------------|-------------|---------------|
| S1: VituixCAD Parser | 2–3 | 2–3 hrs | 4–9 hrs | Yes |
| S2: Literature Pipeline | 2–3 | 2–3 hrs | 4–9 hrs | No (parallel) |
| S3: Agent Architecture | 2 | 2–3 hrs | 4–6 hrs | Yes |
| S4: DB Schema Evolution | 1 | 1–2 hrs | 1–2 hrs | Yes |
| S5: Math Foundation | 1 | 1–2 hrs | 1–2 hrs | No (parallel with S3) |
| S6: UI Dashboard | 3–4 | 2–3 hrs | 6–12 hrs | Yes (terminal) |
| S7: Deploy | 1 | 1–2 hrs | 1–2 hrs | No (independent) |
| **Total** | **12–15** | — | **21–42 hrs** | — |

### Critical path

```
S1 (4–9 hrs) → S4 (1–2 hrs) → S3 (4–6 hrs) → S6 (6–12 hrs)
```

Critical path total: **15–29 hours of sequential work** (minimum wall-clock time even with full parallelism elsewhere).

### Parallelism savings

Running S1 + S2 simultaneously eliminates 4–9 hours from wall-clock time. Running S5 during S3 eliminates 1–2 additional hours. Maximum parallelism compresses the project from ~35 hours sequential to ~22 hours wall-clock.

### Recommended session schedule

| Day | Sessions |
|-----|---------|
| Day 1 | S1 session 1 + S2 session 1 (parallel tabs) |
| Day 1 | S7 deploy prep (Gemini audit, async) |
| Day 2 | S1 session 2 (complete parser + artifact) |
| Day 2 | S2 session 2 (complete ingest worker + artifact) |
| Day 3 | S4 (gate: S1 + S2 done) + S5 (gate: S1 done) — same day, sequential |
| Day 4 | S3 session 1 (gate: S1 done) |
| Day 5 | S3 session 2 (complete agent architecture) |
| Day 5 | Integration smoke test (type check + DB check) |
| Day 6 | S6 session 1 — VituixCAD project panel + file upload |
| Day 7 | S6 session 2 — Agent conversation view |
| Day 8 | S6 session 3 — Knowledge explorer + measurement visualizer |
| Day 9 | S7 deploy (Vercel + Neon marketplace) |
| Day 9 | Full integration test + Playwright visual smoke test |

---

## 7.11 Session Start Checklist (Template)

Copy this at the start of every APEX implementation session:

```markdown
## Session start — [DATE] [WORKSTREAM]

1. [ ] `bd ready` — confirm which tasks are unblocked
2. [ ] Verify all upstream artifacts exist and compile (`npx tsc --noEmit`)
3. [ ] `bd update <task-id> --claim` — atomically claim task
4. [ ] Read relevant artifact contracts from Section 7.3
5. [ ] Read `CLAUDE.md` implementation status section

## Session end — [DATE] [WORKSTREAM]

1. [ ] Artifact file committed and compiles cleanly
2. [ ] `bd update <task-id> --status done` for each completed task
3. [ ] Handoff checklist in Section 7.7 completed
4. [ ] `docs/process/phase-[name].md` written
5. [ ] Follow-up Beads tasks created for discoveries
6. [ ] `CLAUDE.md` implementation status updated
```

---

*Section 7 of APEX Speaker Design Intelligence Platform Spec. See Section 1–6 in `2026-03-26-apex-system-design.md`.*
