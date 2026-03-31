# CHANGELOG

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
