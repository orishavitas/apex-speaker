# APEX v2 --- VituixCAD Integration & Knowledge Expansion

**Date:** 2026-03-28
**Status:** Assembled --- Pending Resolution of Consistency Issues
**Parent Spec:** `2026-03-26-apex-system-design.md`

---

## Executive Summary

APEX v2 transforms a conversation-only speaker design assistant into a full design intelligence platform. The upgrade adds three major capabilities:

1. **VituixCAD Integration** --- Parse `.vxp`, `.vxd`, and `.vxb` simulation files, store structured data in PostgreSQL, and give agents direct access to real design parameters (drivers, crossovers, enclosures, measurement curves).

2. **Technical Literature Pipeline** --- Ingest textbooks (Marker PDF extraction), research papers, and driver datasheets (Docling) into the existing pgvector RAG system, giving agents authoritative citations alongside conversation history.

3. **Agent Architecture Evolution** --- Add a VituixCAD specialist agent, implement shared design state across all agents, upgrade routing from keyword-only to context-aware dispatch, and lay the reactive module foundation for future automatic cross-agent recalculation.

Supporting these capabilities: a database schema expansion (4 new tables, 4 new enums), a math foundation layer that defines shared types for Phase A reasoning and Phase B simulation, a redesigned dashboard UI with project viewer / knowledge search / literature browser, and a multi-session coordination plan for parallel implementation.

### High-Level Architecture

```
User
  |
  v
Dashboard UI (Next.js 15) --- Section 6
  |
  v
Manager Agent (enhanced routing) --- Section 3
  |
  +---> Specialist Agents (7 domains + vituixcad) --- Section 3
  |       |
  |       +---> RAG: conversations + literature + vituixcad --- Sections 2, 3
  |       +---> Math Foundation (types + stub engine) --- Section 5
  |       +---> Design State (shared, reactive) --- Sections 3, 4
  |
  +---> VituixCAD Parser (XML -> typed objects) --- Section 1
  |
  v
PostgreSQL + pgvector (Neon) --- Section 4
```

---

## Table of Contents

| Section | Title | File | Status |
|---------|-------|------|--------|
| 1 | VituixCAD XML Parser & Data Model | [section-1-vituixcad-parser.md](section-1-vituixcad-parser.md) | Ready for Implementation |
| 2 | Technical Literature Ingestion Pipeline | [section-2-literature-pipeline.md](section-2-literature-pipeline.md) | Ready for Implementation |
| 3 | Agent Architecture Evolution | [section-3-agent-architecture.md](section-3-agent-architecture.md) | Draft --- Awaiting Review |
| 4 | Database Schema & Data Model Evolution | [section-4-database-schema.md](section-4-database-schema.md) | Draft --- Ready for Implementation Review |
| 5 | Acoustic Math Foundation | [section-5-math-foundation.md](section-5-math-foundation.md) | Approved for Phase A |
| 6 | UI & Dashboard Evolution | [section-6-ui-dashboard.md](section-6-ui-dashboard.md) | Ready for Implementation |
| 7 | Multi-Session Coordination & Implementation Plan | [section-7-coordination-plan.md](section-7-coordination-plan.md) | Approved --- Implementation Ready |

---

## Cross-Reference Table: Shared Artifacts & Interfaces

The following artifacts are defined in one section and consumed by others. Mismatches between producer and consumer definitions are the primary consistency risk.

### Type Definitions

| Artifact | Defined In | Consumed By | Notes |
|----------|-----------|-------------|-------|
| `VxpProject`, `VxpDriver`, `VxpCrossover` | S1 (1.3.2) | S3 (agent context injection), S4 (JSONB type), S6 (project viewer) | Primary parser output types |
| `VxdDriver` (T/S params) | S1 (1.3.3) | S4 (`driver_database.thieleSmallParams`), S5 (`ThieleSmallParams`) | **CONFLICT --- see Issue #1** |
| `VxbBaffle` | S1 (1.3.4) | S4 (JSONB type for vxb projects), S6 (future baffle viewer) | Clean |
| `TocEntry` | S2 (2.3.1) | S4 (4.2.2 `literature_sources.toc`) | **CONFLICT --- see Issue #2** |
| `LiteratureChunk` | S2 (2.4) | S4 (knowledge_chunks metadata convention) | Clean --- metadata convention, not schema |
| `DesignState` | S3 (3.3.3) | S4 (4.2.4 `design_state`), S6 (DesignStatePanel) | **CONFLICT --- see Issue #3** |
| `AgentDomain` | S3 (implicit, 7 domains) | S4 (`agentDomainEnum`), S6 (DomainPill colors) | S3 adds `vituixcad` domain; S4 and S6 must match |
| `ThieleSmallParams` | S4 (4.2.3) and S5 (5.2.4) | S3 (agent context), S6 (driver param display) | **CONFLICT --- see Issue #4** |
| `CrossoverTopology` | S5 (5.3.2) | S3 (crossover agent), S6 (CrossoverDiagram) | Clean |
| `FrequencyResponse`, `ImpedanceResponse` | S5 (5.2.2, 5.2.3) | S3 (agent curve injection), S6 (future measurement viz) | Clean |
| `SimulationEngine` | S5 (5.4) | S3 (Theory agent tools, future) | Clean --- Phase B boundary |
| `EnclosureDesign` | S5 (5.3.1) | S3 (enclosure agent), S4 (EnclosureState) | Naming differs --- see Issue #5 |

### Database Tables

| Table | Defined In | Referenced By | Notes |
|-------|-----------|---------------|-------|
| `vituixcad_projects` | S1 (1.4) + S4 (4.2.1) | S3 (3.1.4), S6 (project list), S7 (task graph) | **CONFLICT --- see Issue #6** |
| `vituixcad_measurements` | S1 (1.4) | S3 (curve data access) | Only in S1; S4 does not define it |
| `literature_sources` | S2 (2.6.1) + S4 (4.2.2) | S6 (literature browser) | Schema differs slightly --- see Issue #7 |
| `driver_database` | S4 (4.2.3) | S3 (driver selection), S5 (DriverSpec source) | Only in S4 |
| `design_state` | S4 (4.2.4) | S3 (3.3), S6 (DesignStatePanel) | S3 stores state on `projects.design_state` JSONB column; S4 creates a separate table --- **Issue #3** |
| `knowledge_chunks` (extensions) | S2 (2.5), S3 (3.4.4) | S6 (knowledge search) | S3 adds columns; S2 uses metadata JSONB --- **Issue #8** |

### API Endpoints

| Endpoint | Defined In | Used By UI (S6) |
|----------|-----------|-----------------|
| `POST /api/knowledge/vituixcad/upload` | S1 (1.7) | S6: ProjectUploadZone |
| `POST /api/projects/upload` | S6 (6.5) | S6: ProjectUploadZone |
| `GET /api/design-state` | S6 (6.4) | S6: DesignStatePanel |
| `GET /api/knowledge/search` | S6 (6.7) | S6: KnowledgeSearchBar |

### UI Components and Their Data Sources

| Component (S6) | Data Source Section | Interface/Type |
|----------------|-------------------|----------------|
| `DesignStatePanel` | S3 (DesignState) | `DesignState` |
| `CrossoverDiagram` | S1 (VxpCrossover) + S5 (CrossoverComponent) | `CrossoverComponent[]` |
| `DriverCard` / `ParamGrid` | S1 (VxdDriver) + S4 (ThieleSmallParams) + S5 (ThieleSmallParams) | Multiple --- needs unification |
| `DomainPill` | S6 (domain color taxonomy) | S3 AgentDomain enum |
| `AgentStatusPanel` | S3 (7 + 1 agents) | Agent domain list |
| `LibraryTOC` | S2 (TocEntry) + S4 (TocEntry) | `TocEntry[]` |

---

## Consistency Issues Found

### Issue #1: `VxdDriver` T/S Parameter Field Names (S1 vs S4 vs S5)

**Severity:** HIGH --- will cause compile errors at integration

Three sections define Thiele-Small parameter shapes with different field naming conventions:

| Field | S1 `VxdDriver` | S4 `ThieleSmallParams` | S5 `ThieleSmallParams` |
|-------|----------------|----------------------|----------------------|
| DC resistance | `Re` | `Re` | `Re_ohms` |
| Resonant freq | `fs` | `Fs` | `fs_hz` |
| Mechanical Q | `Qms` | `Qms` | `Qms` |
| Electrical Q | `Qes` | `Qes` | `Qes` |
| Total Q | `Qts` | `Qts` | `Qts` |
| Air volume | `Vas` | `Vas` | `Vas_liters` |
| Piston area | `Sd` | `Sd` | `Sd_cm2` |
| Force factor | `BL` | `Bl` | `BL_Tm` |
| Moving mass | `Mms` | `Mms` | `Mms_g` |
| Compliance | `Cms` | `Cms` | `Cms_mmPerN` |
| Excursion | `Xmax` | `Xmax` | `Xmax_mm` |
| Inductance | `Le` | `Le` | `Le_mH` |

S1 uses VituixCAD's native short names. S4 uses similar short names. S5 uses unit-suffixed names (`_hz`, `_liters`, `_mm`) to prevent unit ambiguity.

**Resolution:** S5's convention is the more robust design (units in names prevent bugs). Recommend:
- S5 `ThieleSmallParams` is the **canonical type** for all agent/simulation code
- S1 parser output uses VituixCAD-native names (preserving XML fidelity) and a **mapper function** converts to S5 format at ingest time
- S4 stores the S5 format in `driver_database.thiele_small_params`
- S4 `ThieleSmallParams` interface is deleted; import from S5 instead

### Issue #2: `TocEntry` Shape Mismatch (S2 vs S4)

**Severity:** MEDIUM --- will cause runtime data mismatch

S2 defines `TocEntry` with:
```typescript
{ level: number; heading: string; lineNumber: number; charOffset: number; pageHint?: number; path: string[] }
```

S4 defines `TocEntry` with:
```typescript
{ level: 1 | 2 | 3; title: string; pageStart: number; pageEnd?: number; chunkIds?: string[] }
```

These are structurally different: different field names (`heading` vs `title`), different `level` typing (`number` vs `1|2|3`), and different additional fields.

**Resolution:** S2 is the producer (the one actually extracting TOCs); S4 should import S2's type. If S4 needs the extra fields (`chunkIds`, `pageEnd`), extend S2's type:
```typescript
interface StoredTocEntry extends TocEntry { chunkIds?: string[]; pageEnd?: number; }
```

### Issue #3: Design State Storage --- Column vs Table (S3 vs S4)

**Severity:** HIGH --- architectural conflict

S3 stores design state as a **single JSONB column** on the existing `projects` table:
```sql
ALTER TABLE projects ADD COLUMN design_state JSONB;
```

S4 creates a **separate `design_state` table** with one row per module per project, with version tracking and optimistic concurrency:
```sql
CREATE TABLE design_state (id, project_id, module_type, state JSONB, version, ...);
```

These are fundamentally different patterns. S3's approach is simpler (one read gets everything). S4's approach is more scalable (per-module versioning, optimistic concurrency, audit trail).

**Resolution:** S4's approach is superior for the reactive module system described in S3 section 3.6. The `DesignModule` interface in S3 (section 3.6.2) maps naturally to one row per module in S4's `design_state` table. Recommend:
- Adopt S4's `design_state` table as canonical
- S3's `DesignState` interface becomes the **aggregate view** constructed by reading all module rows for a project and composing them
- The manager's read path queries `design_state` table, not a column on `projects`
- Remove the `ALTER TABLE projects ADD COLUMN design_state` from S3

### Issue #4: Duplicate `ThieleSmallParams` Definition (S4 vs S5)

**Severity:** HIGH --- duplicate types will cause import confusion

Both S4 (section 4.2.3) and S5 (section 5.2.4) define `ThieleSmallParams` with different field names (see Issue #1). This must be a single definition.

**Resolution:** Define `ThieleSmallParams` in S5 (`web/lib/design/types.ts` or `src/simulation/acoustic-types.ts`) and import it in S4's schema file. S4's `driver_database.thiele_small_params` JSONB column uses `.$type<ThieleSmallParams>()` with the S5 type.

### Issue #5: Enclosure Type Enum Values (S4 vs S5)

**Severity:** LOW --- cosmetic but will cause type errors

S4 `EnclosureState.type`:
```typescript
"closed" | "vented" | "bandpass" | "transmission_line" | "open_baffle"
```

S5 `EnclosureType`:
```typescript
'sealed' | 'ported' | 'passive_radiator' | 'bandpass_4th' | 'bandpass_6th' | 'open_baffle' | 'transmission_line'
```

Key mismatches: `closed` vs `sealed`, `vented` vs `ported`, no PR type in S4, S5 distinguishes 4th/6th bandpass.

**Resolution:** S5's vocabulary is more precise (industry standard uses both "sealed"/"closed" and "vented"/"ported" interchangeably, but S5 also distinguishes bandpass orders and adds passive radiator). Adopt S5 as canonical. S4's `EnclosureState.type` should import from S5 or align values.

### Issue #6: `vituixcad_projects` Table --- Dual Definition (S1 vs S4)

**Severity:** HIGH --- two different schemas for the same table

S1 (section 1.4) defines `vituixcad_projects` with:
- `projectType` enum: `['vxp', 'vxd', 'vxb']`
- `fileName`, `descriptionText`, `referencedFiles`, `embedding VECTOR(1536)`, `deletedAt` columns
- Separate `vituixcad_measurements` table for `.frd`/`.zma` files

S4 (section 4.2.1) defines the same table with:
- `projectType` enum: `['full_project', 'driver_model', 'enclosure_sim', 'crossover_sim']`
- `filePath`, `fileHash` columns; no `fileName`, `descriptionText`, `referencedFiles`, or `embedding`
- No measurements table

S3 (section 3.1.4) defines yet a third version as raw SQL with `TEXT PRIMARY KEY` (not UUID).

**Resolution:** S1 is the most complete definition (it was written by the parser specialist who understands the actual VituixCAD file structure). Recommend:
- Adopt S1's schema as canonical, including `vituixcad_measurements`
- Merge S4's `fileHash` column into S1's definition (useful for change detection)
- S4's enum values (`full_project`, etc.) are more descriptive but do not cover `.vxb` --- reconcile by using S1's file-extension-based enum or a mapping layer
- S3's SQL definition is deprecated in favor of the Drizzle ORM definition

### Issue #7: `literature_sources` --- Minor Schema Differences (S2 vs S4)

**Severity:** LOW --- cosmetic differences, same intent

S2 includes: `family` (textbook/paper/datasheet), `pdfPath`, `markdownPath`, `ingestedAt`, `sourceType`, `totalChunks`
S4 includes: `edition`, `isbn`, `publisher`, `publishedYear`, `chunkCount`, `sourceId` FK

Both have the same core intent. The union of columns is the correct schema.

**Resolution:** Merge both definitions. S2's `family` and `markdownPath` fields are needed by the pipeline. S4's bibliographic fields (`isbn`, `edition`, `publisher`, `publishedYear`) and `sourceId` FK are needed for the knowledge explorer. Use the union.

### Issue #8: `knowledge_chunks` Extension Strategy (S2 vs S3)

**Severity:** MEDIUM --- conflicting extension approaches

S2 stores literature metadata in the existing `metadata` JSONB column (no schema change, convention only).

S3 proposes adding 5 new columns to `knowledge_chunks`:
```sql
ALTER TABLE knowledge_chunks ADD COLUMN publication TEXT, author TEXT, year INTEGER, chapter TEXT, page_start INTEGER, page_end INTEGER;
```

These approaches are contradictory. Adding real columns enables SQL queries but requires migration. Using JSONB metadata avoids migration but requires JSONB path extraction.

**Resolution:** S2's approach (JSONB metadata) is preferred for Phase 4 because:
- It avoids migrating an existing table with data
- The HNSW index is unaffected
- S4 already specifies the JSONB convention for both literature and vituixcad chunks (section 4.3.2)
- If SQL performance on metadata fields becomes an issue, expression indexes can be added later

Remove S3's `ALTER TABLE` additions. Literature metadata lives in `knowledge_chunks.metadata` JSONB.

### Issue #9: Upload Endpoint Duplication (S1 vs S6)

**Severity:** LOW --- naming inconsistency

S1 defines: `POST /api/knowledge/vituixcad/upload`
S6 references: `POST /api/projects/upload`

These appear to serve the same purpose (uploading VituixCAD files).

**Resolution:** Use S1's endpoint path (`/api/knowledge/vituixcad/upload`) as it is fully specified with request/response contracts. S6's reference should be updated to match.

### Issue #10: Agent Count (S6 vs S3)

**Severity:** LOW --- cosmetic

S6 references "7 agents" in the Agent Status Panel (section 6.4). S3 adds an 8th agent (`vituixcad`), making the total 8 (acoustics, enclosure, crossover, theory, mechanical, research, manager, vituixcad).

**Resolution:** Update S6 to reference 8 agents. The `DomainPill` color taxonomy in S6 (section 6.1) already does not include `vituixcad` --- add it. Suggest: `vituixcad` domain color = `indigo` (`#6366f1`), adjacent to `violet` (acoustics) but distinct.

### Issue #11: File Path Convention (S5 vs S7)

**Severity:** LOW --- will cause confusion during implementation

S5 places simulation types at `src/simulation/acoustic-types.ts` and agents import from `'@/simulation'`.
S7 artifact contracts specify `web/lib/design/types.ts` for math foundation types.

These are different paths. The project appears to be a Next.js app with source under `web/`.

**Resolution:** Use `web/lib/design/types.ts` (S7's convention) to match the existing project structure where all code lives under `web/`. S5's `src/simulation/` path should be mapped to `web/lib/simulation/`.

---

## Open Questions (Collected Across All Sections)

### From Section 1

1. **Windows backslash paths in `.vxp` files** --- The `ResponseDirectory` field contains Windows paths. Parser should normalize to forward slashes. (Noted in S1 testing strategy but no implementation specified.)

### From Section 3

2. **VXP parsing location** --- Server-side (Node.js) vs client-side (browser)? S3 recommends server-side. Confirmed by S1's implementation (Next.js API route).

3. **Curve injection token cost** --- Multi-curve injection adds ~2KB to agent context. Monitor latency. (Noted, not blocking.)

4. **Handoff note expiry** --- Turn-based (`expires_after_turns`) vs state-change-based? S3 recommends state-change-based as more semantically correct. No implementation specified.

5. **Manager synthesis mode** --- The `complex_multi_domain` escalation case requires the manager to synthesize multi-agent answers. S3 flags this needs its own system prompt. Not yet specified.

6. **Literature confidence scoring rubric** --- Confidence values are assigned (0.9 for literature, 0.95 for datasheets) but no formal scoring rubric exists. S3 section 3.10 asks for this to be defined.

### From Section 5

7. **Phase B timeline** --- When does the simulation engine transition from stub to real? S5 defers to S7 for scheduling, but S7 does not explicitly include Phase B in the 9-day schedule.

### From Section 6

8. **Workspace route (Phase 5)** --- `/dashboard/workspace` is stubbed. No spec exists for Phase 5 reactive panels beyond the wireframe in S6 section 6.9.

### From Section 7

9. **Integration branch strategy** --- S7 mentions "main branch or a shared integration branch" for artifact commits. No decision on which. Recommend: feature branches with PR merge to main, since Beads tracks dependencies.

---

## Implementation Priority Order

Based on S7's dependency analysis and the consistency issues identified above:

### Phase 0: Reconciliation (Before Any Coding)

1. Resolve Issue #1 (ThieleSmallParams naming) --- single canonical type in `web/lib/design/types.ts`
2. Resolve Issue #3 (design_state storage) --- adopt S4's table approach
3. Resolve Issue #6 (vituixcad_projects dual definition) --- merge S1 + S4, S1 wins on structure
4. Resolve Issue #4 (duplicate ThieleSmallParams) --- delete S4's copy, import from S5

### Phase 1: Window 0 (Parallel --- Days 1-2)

| Workstream | Sessions | Critical Path |
|-----------|----------|---------------|
| **S1: VituixCAD Parser** | 2-3 sessions | YES |
| **S2: Literature Pipeline** | 2-3 sessions | No (parallel) |
| **S7: Deploy Prep** | 1 session | No (independent) |

### Phase 2: Window 1 (After S1 --- Days 3-5)

| Workstream | Gate | Sessions |
|-----------|------|----------|
| **S4: Database Schema** | S1 + S2 types exist | 1 session |
| **S5: Math Foundation** | S1 types exist | 1 session |
| **S3: Agent Architecture** | S1 types exist | 2 sessions |

### Phase 3: Window 2 (After S1 + S3 + S4 --- Days 6-9)

| Workstream | Gate | Sessions |
|-----------|------|----------|
| **S6: UI Dashboard** | S1 + S3 + S4 complete | 3-4 sessions |
| **S7: Deploy** | Next.js scaffold exists | 1 session |

### Critical Path

```
S1 (4-9 hrs) --> S4 (1-2 hrs) --> S3 (4-6 hrs) --> S6 (6-12 hrs)
Total: 15-29 hours sequential
With parallelism: ~22 hours wall-clock
```

---

## Artifact Contract Summary

These TypeScript files are the handoff boundaries between workstreams. Each must exist, compile, and be committed before downstream work begins.

| Artifact File | Producer | Consumers | Completeness Gate |
|--------------|----------|-----------|-------------------|
| `web/lib/vituixcad/types.ts` | S1 | S3, S4, S5, S6 | `npx tsc --noEmit` passes |
| `web/lib/literature/types.ts` | S2 | S4, S6 | `npx tsc --noEmit` passes |
| `web/lib/design/types.ts` | S5 | S3, S6 | `npx tsc --noEmit` passes |
| `web/lib/db/schema.ts` | S4 | All | `npx drizzle-kit generate` + `migrate` succeed |

---

*Master index assembled 2026-03-28. Review all consistency issues before beginning implementation.*
