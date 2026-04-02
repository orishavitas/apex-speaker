# Section 4: Database Schema & Data Model Evolution

**Spec:** APEX Speaker Design Intelligence Platform
**Section:** 4 of N — Database Schema & Data Model Evolution
**Status:** Draft — ready for implementation review
**Date:** 2026-03-28
**Builds on:** `docs/superpowers/specs/2026-03-26-apex-system-design.md` + `web/lib/db/schema.ts`

---

## 4.0 Baseline

The existing schema (`web/lib/db/schema.ts`) defines six tables using Drizzle ORM with Neon PostgreSQL + pgvector. Key conventions already established:

- **IDs:** `uuid().primaryKey().defaultRandom()` — no serials
- **Vector type:** Custom `customType` wrapper for `vector(1536)` — pgvector is not natively in drizzle-orm/pg-core
- **Enums:** All categorical strings are `pgEnum`, not raw `text` — this enables query planner optimisation and enforces valid values at the DB level
- **JSONB typing:** `jsonb().$type<T>()` for compile-time safety on structured blobs
- **Timestamps:** `timestamp().defaultNow().notNull()` for created, `timestamp().defaultNow()` for updated
- **HNSW index:** Applied post-push via raw SQL (`CREATE INDEX USING hnsw`) because Drizzle cannot express vector index syntax

This section adds four new tables, extends two existing ones, and defines all required indexes and query patterns. The schema remains the single file at `web/lib/db/schema.ts`.

---

## 4.1 New Enums

Three new enums extend the type system before the new tables are defined. These belong at the top of `schema.ts`, alongside `agentDomainEnum`, `sourceTypeEnum`, and `knowledgeStatusEnum`.

```typescript
// Extend source_type enum to include new ingestion channels
// NOTE: PostgreSQL enums cannot be trivially altered after creation.
// Strategy: drop and recreate the enum in migration (see §4.6).
export const sourceTypeEnum = pgEnum("source_type", [
  "chatgpt_conversation",
  "book_chapter",
  "forum_thread",
  "datasheet",
  "research_paper",
  "notebooklm",
  "literature",      // NEW — structured PDF books with TOC
  "vituixcad",       // NEW — VituixCAD .vxd / .vcj project files
]);

// VituixCAD project types
export const vituixcadProjectTypeEnum = pgEnum("vituixcad_project_type", [
  "full_project",    // .vcj — complete speaker project (drivers + enclosure + crossover)
  "driver_model",    // .vxd — single driver measurement/model
  "enclosure_sim",   // enclosure-only simulation export
  "crossover_sim",   // crossover-only filter network
]);

// Speaker driver types (physical classification)
export const driverTypeEnum = pgEnum("driver_type", [
  "woofer",
  "midrange",
  "tweeter",
  "fullrange",
  "subwoofer",
  "midwoofer",
  "passive_radiator",
]);

// Driver database source — provenance of the T/S parameter set
export const driverSourceEnum = pgEnum("driver_source", [
  "vituixcad_vxd",        // parsed directly from .vxd file
  "manufacturer_datasheet", // from PDF/HTML datasheet
  "measured",             // from user measurement (DATS, REW, LspCAD)
  "forum_post",           // community-verified data from DIYAudio etc.
  "notebooklm_extract",   // extracted via NotebookLM session
]);

// Reactive module types — which design domain the state belongs to
export const moduleTypeEnum = pgEnum("module_type", [
  "enclosure",     // box dimensions, tuning, material, port config
  "crossover",     // filter topology, component values, target curves
  "driver_select", // chosen drivers per way, rationale
  "room_analysis", // room dimensions, placement, acoustic treatment
  "project_goals", // top-level targets: SPL, bandwidth, WAF, budget
]);
```

---

## 4.2 New Tables

### 4.2.1 `vituixcad_projects`

Stores VituixCAD project files in both raw and parsed forms. Raw XML is kept for round-trip fidelity; parsed JSONB enables structured queries by agents (e.g., "find all projects using SB Acoustics drivers").

```typescript
export const vituixcadProjects = pgTable("vituixcad_projects", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Identity
  name: varchar("name", { length: 512 }).notNull(),
  projectType: vituixcadProjectTypeEnum("project_type").notNull(),

  // Source file
  filePath: text("file_path").notNull(),         // absolute or repo-relative path to original file
  fileHash: varchar("file_hash", { length: 64 }), // SHA-256 of file content — change detection

  // Content
  rawXml: text("raw_xml").notNull(),             // verbatim file content — never modified
  parsedData: jsonb("parsed_data")
    .$type<VituixcadParsedData>()
    .notNull(),

  // Linking
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "set null" }),

  // Metadata
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("vxcad_project_id_idx").on(table.projectId),
  projectTypeIdx: index("vxcad_project_type_idx").on(table.projectType),
  // GIN index for parsed_data JSONB queries (applied post-push via raw SQL)
  // CREATE INDEX vxcad_parsed_data_gin ON vituixcad_projects USING gin (parsed_data);
}));
```

**`VituixcadParsedData` TypeScript type** (define in `web/lib/db/types.ts`):

```typescript
export interface VituixcadParsedData {
  drivers: Array<{
    way: number;                 // 0 = woofer, 1 = mid, 2 = tweeter
    manufacturer: string;
    model: string;
    quantity: number;
    filePath: string;            // .vxd path referenced in project
  }>;
  enclosure: {
    type: "closed" | "vented" | "bandpass" | "transmission_line" | "open_baffle";
    volumeLiters?: number;
    portLengthMm?: number;
    portDiameterMm?: number;
    tuningHz?: number;
  } | null;
  crossover: {
    ways: number;
    topology: string;            // "2nd order LR", "3rd order Butterworth", etc.
    frequenciesHz: number[];     // crossover points per way boundary
  } | null;
  simulationResults: {
    fr?: number[][];             // [[Hz, dB], ...]
    impedance?: number[][];      // [[Hz, Ω], ...]
    groupDelay?: number[][];
    excursion?: number[][];
  } | null;
  fileVersion: string;           // VituixCAD version that wrote this file
}
```

---

### 4.2.2 `literature_sources`

Structured metadata for PDF books and papers ingested into the knowledge pipeline. Separates structural metadata (authors, TOC, page count) from the sources table, which only stores ingestion provenance. Knowledge chunks produced from a literature source carry `source_type = 'literature'` and reference their parent via `sourcePath`.

```typescript
export const literatureSources = pgTable("literature_sources", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Bibliographic
  title: text("title").notNull(),
  authors: jsonb("authors")
    .$type<string[]>()
    .default([]),
  publisher: varchar("publisher", { length: 512 }),
  publishedYear: integer("published_year"),
  isbn: varchar("isbn", { length: 20 }),
  edition: varchar("edition", { length: 64 }),

  // Source file
  filePath: text("file_path").notNull(),
  fileHash: varchar("file_hash", { length: 64 }),
  totalPages: integer("total_pages"),

  // Structural metadata
  toc: jsonb("toc")
    .$type<TocEntry[]>()
    .default([]),

  // Processing state
  isIngested: boolean("is_ingested").default(false),
  processedAt: timestamp("processed_at"),
  chunkCount: integer("chunk_count").default(0),

  // Linking back to sources table for consistency
  sourceId: uuid("source_id")
    .references(() => sources.id, { onDelete: "cascade" }),

  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  filePathIdx: uniqueIndex("lit_file_path_idx").on(table.filePath),
  ingestedIdx: index("lit_ingested_idx").on(table.isIngested),
  // GIN index on toc for chapter-level search:
  // CREATE INDEX lit_toc_gin ON literature_sources USING gin (toc);
}));
```

**`TocEntry` TypeScript type:**

```typescript
export interface TocEntry {
  level: 1 | 2 | 3;             // chapter = 1, section = 2, subsection = 3
  title: string;
  pageStart: number;
  pageEnd?: number;
  chunkIds?: string[];           // knowledge_chunks.id values produced from this section
}
```

---

### 4.2.3 `driver_database`

Queryable Thiele-Small parameter store. This is APEX's internal driver reference — not a cache of web data, but a structured repository of T/S parameters sourced from .vxd files, datasheets, and forum measurements. The Enclosure and Acoustics agents query this table directly for driver selection and simulation inputs.

```typescript
export const driverDatabase = pgTable("driver_database", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Identity
  manufacturer: varchar("manufacturer", { length: 255 }).notNull(),
  model: varchar("model", { length: 255 }).notNull(),
  driverType: driverTypeEnum("driver_type").notNull(),

  // Nominal specs (denormalized for fast filtering — also inside thieleSmallParams)
  nominalDiameterMm: real("nominal_diameter_mm"),
  nominalImpedanceOhm: real("nominal_impedance_ohm"),
  powerRatingW: real("power_rating_w"),

  // Full T/S parameter set
  thieleSmallParams: jsonb("thiele_small_params")
    .$type<ThieleSmallParams>()
    .notNull(),

  // Provenance
  source: driverSourceEnum("source").notNull(),
  sourceRef: text("source_ref"),  // file path, URL, or forum post link

  // Linking — a driver_database row may have come from a vxd file
  vxdProjectId: uuid("vxd_project_id")
    .references(() => vituixcadProjects.id, { onDelete: "set null" }),

  // Confidence in parameter accuracy
  confidence: real("confidence").default(0.8),
  verifiedByUser: boolean("verified_by_user").default(false),

  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({}),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  manufacturerModelIdx: uniqueIndex("driver_mfr_model_idx")
    .on(table.manufacturer, table.model, table.source),
  driverTypeIdx: index("driver_type_idx").on(table.driverType),
  nominalDiameterIdx: index("driver_diameter_idx").on(table.nominalDiameterMm),
  nominalImpedanceIdx: index("driver_impedance_idx").on(table.nominalImpedanceOhm),
  // Scalar B-tree indexes on denormalized T/S columns support range queries without JSONB extraction.
  // A GIN on thieleSmallParams is NOT added — range queries on scalar columns are faster.
  // Exception: add GIN if full-text search within t/s param keys is ever needed.
}));
```

**`ThieleSmallParams` TypeScript type:**

```typescript
export interface ThieleSmallParams {
  // Electrical
  Re: number;          // DC resistance (Ω)
  Le: number;          // voice coil inductance (mH)
  // Mechanical
  Fs: number;          // resonant frequency (Hz)
  Qms: number;         // mechanical Q
  Qes: number;         // electrical Q
  Qts: number;         // total Q
  Vas: number;         // equivalent air volume (L)
  Cms: number;         // mechanical compliance (mm/N)
  Mms: number;         // moving mass (g)
  Rms: number;         // mechanical resistance (kg/s)
  Bl: number;          // motor force factor (T·m)
  // Acoustic
  Sd: number;          // effective piston area (cm²)
  Xmax: number;        // linear excursion (mm peak)
  Xmech?: number;      // mechanical limit (mm peak)
  Sensitivity: number; // 2.83V/1m (dB)
  // Optional / derived
  EtaZero?: number;    // reference efficiency (%)
  Vd?: number;         // peak displacement volume (cm³)
  Kms_100?: number;    // compliance at 100Hz (mm/N) — some VituixCAD exports
  // Frequency response data (if extracted from .vxd)
  frData?: Array<[number, number]>;       // [[Hz, dB], ...]
  impedanceData?: Array<[number, number]>; // [[Hz, Ω], ...]
}
```

---

### 4.2.4 `design_state`

Reactive module state that persists across sessions. Each record represents the current state of one design module (enclosure, crossover, driver selection, etc.) within a project. Versioned so agents can track state changes and reason about design evolution.

This table is the persistence layer for what would otherwise live only in React state — it allows agents to re-read the current design context at the start of any session without re-asking the user.

```typescript
export const designState = pgTable("design_state", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Each module type has exactly one active record per project
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  moduleType: moduleTypeEnum("module_type").notNull(),

  // State blob — structure varies per module_type (see §4.4)
  state: jsonb("state")
    .$type<DesignStatePayload>()
    .notNull(),

  // Optimistic concurrency — incremented on every write
  version: integer("version").default(1).notNull(),

  // Audit trail
  lastModifiedBy: agentDomainEnum("last_modified_by"),
  changeNote: text("change_note"),  // agent-written summary of what changed

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  // One active state record per project per module — enforced by unique index
  projectModuleIdx: uniqueIndex("design_state_project_module_idx")
    .on(table.projectId, table.moduleType),
  projectIdx: index("design_state_project_idx").on(table.projectId),
}));
```

**`DesignStatePayload` TypeScript type** (discriminated union):

```typescript
export type DesignStatePayload =
  | EnclosureState
  | CrossoverState
  | DriverSelectionState
  | RoomAnalysisState
  | ProjectGoalsState;

export interface EnclosureState {
  moduleType: "enclosure";
  type: "closed" | "vented" | "bandpass" | "transmission_line" | "open_baffle";
  volumeLiters: number | null;
  material: string | null;
  thicknessMm: number | null;
  port?: {
    count: number;
    diameterMm: number;
    lengthMm: number;
    tuningHz: number;
  };
  driverCutouts: Array<{ way: number; diameterMm: number }>;
  vituixcadProjectId?: string;  // linked simulation if any
}

export interface CrossoverState {
  moduleType: "crossover";
  topology: string | null;
  ways: number;
  crossoverPoints: Array<{
    frequencyHz: number;
    order: number;
    type: "butterworth" | "linkwitz_riley" | "bessel" | "custom";
    hipassComponents: ComponentValue[];
    lopassComponents: ComponentValue[];
  }>;
  targetCurve?: Array<[number, number]>;
}

export interface ComponentValue {
  type: "resistor" | "capacitor" | "inductor";
  valueOhm?: number;
  valueMicrofarads?: number;
  valueMillihenries?: number;
  label: string;
}

export interface DriverSelectionState {
  moduleType: "driver_select";
  ways: number;
  selections: Array<{
    way: number;
    label: string;        // "woofer", "tweeter", etc.
    driverDatabaseId: string | null;
    rationale: string | null;
    quantity: number;
    configuration: "series" | "parallel" | "single";
  }>;
}

export interface RoomAnalysisState {
  moduleType: "room_analysis";
  dimensionsM: { length: number; width: number; height: number } | null;
  placement: string | null;
  treatmentNotes: string | null;
  modalFrequenciesHz: number[];
}

export interface ProjectGoalsState {
  moduleType: "project_goals";
  targetSplDb: number | null;
  targetBandwidthHz: [number, number] | null;
  budget: string | null;
  applicationContext: string | null;
  constraints: string[];
  priorityRanking: string[];
}
```

---

## 4.3 Existing Table Changes

### 4.3.1 `source_type` enum extension

The `sourceTypeEnum` already defined in `schema.ts` must add two values: `"literature"` and `"vituixcad"`. Because PostgreSQL does not allow removing values from an enum, and the schema has not yet been deployed to production, the simplest approach is a full enum replacement in the migration (see §4.6).

No column structure changes to the `sources` table are needed — `filePath`, `url`, and `metadata` already accommodate the new source types.

### 4.3.2 `knowledge_chunks` metadata convention

The `knowledgeChunks` table does not require structural changes. However, chunks produced from the two new source types carry additional metadata fields by convention. Agents must populate these fields during ingestion:

**For `source_type = 'literature'`:**
```typescript
// knowledgeChunks.metadata shape
{
  literatureSourceId: string;   // literature_sources.id
  chapterTitle: string;
  sectionTitle?: string;
  pageStart: number;
  pageEnd: number;
  tocLevel: 1 | 2 | 3;
}
```

**For `source_type = 'vituixcad'`:**
```typescript
// knowledgeChunks.metadata shape
{
  vxcadProjectId: string;       // vituixcad_projects.id
  dataCategory: "fr" | "impedance" | "excursion" | "design_note" | "simulation_result";
  frequencyRangeHz?: [number, number];
}
```

No migration required — JSONB columns accept any shape. The convention is enforced by the ingestion agents, not the database.

---

## 4.4 Index Strategy

### Existing indexes (baseline)

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `knowledge_chunks` | `knowledge_domain_idx` | B-tree | Filter by agent domain |
| `knowledge_chunks` | `knowledge_status_idx` | B-tree | Filter private vs canonical |
| `knowledge_chunks` | `knowledge_source_chunk_idx` | Unique B-tree | Deduplication on ingest |
| `knowledge_chunks` | *(manual)* HNSW | HNSW | pgvector cosine similarity |

### New indexes required

**Applied via Drizzle schema** (in table definitions above):

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `vituixcad_projects` | `vxcad_project_id_idx` | B-tree | Join to projects |
| `vituixcad_projects` | `vxcad_project_type_idx` | B-tree | Filter by project type |
| `literature_sources` | `lit_file_path_idx` | Unique B-tree | Dedup on ingest |
| `literature_sources` | `lit_ingested_idx` | B-tree | Pipeline status filter |
| `driver_database` | `driver_mfr_model_idx` | Unique B-tree | Dedup + lookup by name |
| `driver_database` | `driver_type_idx` | B-tree | Filter by driver type |
| `driver_database` | `driver_diameter_idx` | B-tree | Range query on diameter |
| `driver_database` | `driver_impedance_idx` | B-tree | Range query on impedance |
| `design_state` | `design_state_project_module_idx` | Unique B-tree | One record per module per project |
| `design_state` | `design_state_project_idx` | B-tree | Load all modules for a project |

**Applied via raw SQL post-push** (add to migration scripts, not Drizzle schema):

```sql
-- GIN for JSONB path queries on VituixCAD parsed data
-- Enables: WHERE parsed_data @> '{"drivers": [{"manufacturer": "SB Acoustics"}]}'
CREATE INDEX vxcad_parsed_data_gin
  ON vituixcad_projects USING gin (parsed_data);

-- GIN for TOC search in literature sources
-- Enables: WHERE toc @> '[{"title": "Butterworth"}]'
CREATE INDEX lit_toc_gin
  ON literature_sources USING gin (toc);

-- Partial index: only unprocessed literature sources (small, hot path for pipeline)
CREATE INDEX lit_unprocessed_idx
  ON literature_sources (created_at)
  WHERE is_ingested = false;

-- Expression index on T/S scalar fields extracted from JSONB
-- Used only if denormalized columns prove insufficient for complex parameter queries
-- Defer until needed — expression indexes have maintenance cost
-- CREATE INDEX driver_qts_idx ON driver_database ((thiele_small_params->>'Qts')::real);
```

**What is NOT indexed and why:**

- `design_state.state` JSONB — state blobs are always fetched via the `(project_id, module_type)` unique index. No operator-level queries into state are expected.
- `knowledge_chunks.embedding` B-tree — vectors use HNSW only. B-tree on a 1536-dim vector is useless.
- `conversations.content` full-text — deferred. If text search is needed, use `tsvector` + GIN, not `ILIKE`.

---

## 4.5 Query Patterns

The following are the principal queries agents will execute. Each includes the SQL pattern and the equivalent Drizzle ORM form.

### Q1: Semantic search across all knowledge types

"Find all knowledge about Butterworth crossovers" — cosine similarity across `knowledge_chunks`, optionally filtered by domain or source type.

```typescript
// Drizzle does not support vector operators natively — use sql template tag
import { sql } from "drizzle-orm";

async function semanticSearch(
  embedding: number[],
  options: {
    domain?: AgentDomain;
    sourceTypes?: SourceType[];
    limit?: number;
    minSimilarity?: number;
  }
) {
  const { domain, sourceTypes, limit = 10, minSimilarity = 0.7 } = options;

  return db
    .select({
      id: knowledgeChunks.id,
      content: knowledgeChunks.content,
      title: knowledgeChunks.title,
      sourceType: knowledgeChunks.sourceType,
      agentDomain: knowledgeChunks.agentDomain,
      metadata: knowledgeChunks.metadata,
      similarity: sql<number>`1 - (embedding <=> ${JSON.stringify(embedding)}::vector)`,
    })
    .from(knowledgeChunks)
    .where(
      and(
        sql`1 - (embedding <=> ${JSON.stringify(embedding)}::vector) >= ${minSimilarity}`,
        eq(knowledgeChunks.status, "canonical"),
        domain ? eq(knowledgeChunks.agentDomain, domain) : undefined,
        sourceTypes?.length
          ? inArray(knowledgeChunks.sourceType, sourceTypes)
          : undefined
      )
    )
    .orderBy(sql`embedding <=> ${JSON.stringify(embedding)}::vector`)
    .limit(limit);
}
```

**Execution note:** The HNSW index on `embedding` uses `vector_cosine_ops`. The `<=>` operator performs cosine distance (0 = identical, 2 = opposite). Similarity = `1 - distance`. The `minSimilarity` threshold filters at application level after HNSW approximate recall — for hard thresholds, apply a post-filter, not an index predicate (HNSW does not support distance predicates natively).

---

### Q2: Structured T/S parameter range query

"What drivers have Qts between 0.3–0.5 and Vas > 20L" — uses denormalized scalar columns for B-tree range scans, not JSONB extraction.

```typescript
import { and, between, gt, eq } from "drizzle-orm";

async function findDriversBySpecs(criteria: {
  qtsMin?: number;
  qtsMax?: number;
  vasMinLiters?: number;
  driverType?: DriverType;
  nominalImpedanceOhm?: number;
  nominalDiameterMmMin?: number;
  nominalDiameterMmMax?: number;
}) {
  const {
    qtsMin, qtsMax, vasMinLiters,
    driverType, nominalImpedanceOhm,
    nominalDiameterMmMin, nominalDiameterMmMax
  } = criteria;

  return db
    .select({
      id: driverDatabase.id,
      manufacturer: driverDatabase.manufacturer,
      model: driverDatabase.model,
      driverType: driverDatabase.driverType,
      thieleSmallParams: driverDatabase.thieleSmallParams,
      source: driverDatabase.source,
      confidence: driverDatabase.confidence,
    })
    .from(driverDatabase)
    .where(
      and(
        // Scalar column range query — B-tree indexed
        nominalDiameterMmMin
          ? gte(driverDatabase.nominalDiameterMm, nominalDiameterMmMin)
          : undefined,
        nominalDiameterMmMax
          ? lte(driverDatabase.nominalDiameterMm, nominalDiameterMmMax)
          : undefined,
        nominalImpedanceOhm
          ? eq(driverDatabase.nominalImpedanceOhm, nominalImpedanceOhm)
          : undefined,
        driverType
          ? eq(driverDatabase.driverType, driverType)
          : undefined,
        // JSONB field extraction for T/S params not available as scalar columns
        // Cast extracted text to real for numeric comparison
        qtsMin !== undefined
          ? sql`(thiele_small_params->>'Qts')::real >= ${qtsMin}`
          : undefined,
        qtsMax !== undefined
          ? sql`(thiele_small_params->>'Qts')::real <= ${qtsMax}`
          : undefined,
        vasMinLiters !== undefined
          ? sql`(thiele_small_params->>'Vas')::real > ${vasMinLiters}`
          : undefined,
      )
    )
    .orderBy(driverDatabase.manufacturer, driverDatabase.model);
}
```

**Performance note:** `Qts` and `Vas` are extracted from JSONB via cast — this is a sequential scan over the JSONB unless a functional index exists. For the expected dataset size (hundreds to low thousands of drivers), this is acceptable. If query time exceeds 50ms under load, add expression indexes:
```sql
CREATE INDEX driver_qts_expr_idx ON driver_database ((thiele_small_params->>'Qts')::real);
CREATE INDEX driver_vas_expr_idx ON driver_database ((thiele_small_params->>'Vas')::real);
```

---

### Q3: Load current design state for a project

"Get the current design state for project X" — always a point lookup via the unique index.

```typescript
async function getProjectDesignState(projectId: string) {
  const rows = await db
    .select()
    .from(designState)
    .where(eq(designState.projectId, projectId))
    .orderBy(designState.moduleType);

  // Returns all module states for the project as a typed map
  return rows.reduce<Record<string, DesignStatePayload>>((acc, row) => {
    acc[row.moduleType] = row.state;
    return acc;
  }, {});
}

async function upsertModuleState(
  projectId: string,
  moduleType: ModuleType,
  newState: DesignStatePayload,
  agentDomain: AgentDomain,
  changeNote?: string
) {
  // Optimistic concurrency: read version, increment, write
  const [existing] = await db
    .select({ version: designState.version })
    .from(designState)
    .where(
      and(
        eq(designState.projectId, projectId),
        eq(designState.moduleType, moduleType)
      )
    );

  const nextVersion = (existing?.version ?? 0) + 1;

  return db
    .insert(designState)
    .values({
      projectId,
      moduleType,
      state: newState,
      version: nextVersion,
      lastModifiedBy: agentDomain,
      changeNote,
    })
    .onConflictDoUpdate({
      target: [designState.projectId, designState.moduleType],
      set: {
        state: newState,
        version: nextVersion,
        lastModifiedBy: agentDomain,
        changeNote,
        updatedAt: new Date(),
      },
    });
}
```

---

### Q4: Find VituixCAD projects by driver manufacturer

"Find all VituixCAD projects using SB Acoustics drivers" — GIN-indexed JSONB containment query.

```typescript
async function findVxcadProjectsByDriverManufacturer(manufacturer: string) {
  return db
    .select({
      id: vituixcadProjects.id,
      name: vituixcadProjects.name,
      projectType: vituixcadProjects.projectType,
      parsedData: vituixcadProjects.parsedData,
      projectId: vituixcadProjects.projectId,
      filePath: vituixcadProjects.filePath,
    })
    .from(vituixcadProjects)
    .where(
      // JSONB containment — uses GIN index created post-push
      sql`parsed_data @> ${JSON.stringify({
        drivers: [{ manufacturer }]
      })}::jsonb`
    );
}

// More flexible: find by any driver property using jsonb_path_exists
async function findVxcadProjectsByDriverProperty(
  jsonPath: string,  // e.g. '$.drivers[*].model ? (@ like_regex "SB29")'
) {
  return db
    .select()
    .from(vituixcadProjects)
    .where(
      sql`jsonb_path_exists(parsed_data, ${jsonPath}::jsonpath)`
    );
}
```

---

### Q5: Knowledge chunks from a specific literature chapter

Retrieve all chunks from a particular chapter, for agent context loading.

```typescript
async function getChunksByChapter(
  literatureSourceId: string,
  chapterTitle: string
) {
  return db
    .select()
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.sourceType, "literature"),
        sql`metadata->>'literatureSourceId' = ${literatureSourceId}`,
        sql`metadata->>'chapterTitle' = ${chapterTitle}`
      )
    )
    .orderBy(knowledgeChunks.chunkIndex);
}
```

---

## 4.6 Data Integrity

### Foreign key constraints

| Table | Column | References | On Delete |
|-------|--------|-----------|-----------|
| `vituixcad_projects` | `project_id` | `projects.id` | SET NULL — VX project survives if parent project deleted |
| `literature_sources` | `source_id` | `sources.id` | CASCADE — literature metadata deleted with source record |
| `driver_database` | `vxd_project_id` | `vituixcad_projects.id` | SET NULL — driver data survives if VX project deleted |
| `design_state` | `project_id` | `projects.id` | CASCADE — state is meaningless without its project |
| `conversations` | `project_id` | `projects.id` | *(existing)* SET NULL |
| `agent_memory` | `project_id` | `projects.id` | *(existing)* RESTRICT |

### Uniqueness constraints

- `driver_database`: unique on `(manufacturer, model, source)` — same driver from two sources = two rows. This preserves parameter set provenance rather than silently merging potentially conflicting values.
- `design_state`: unique on `(project_id, module_type)` — enforces one active state record per module per project. The `upsertModuleState` function above relies on this constraint for `ON CONFLICT DO UPDATE`.
- `literature_sources`: unique on `file_path` — prevents duplicate ingestion of the same PDF.
- `vituixcad_projects`: no unique constraint on `file_path` — the same .vxd file may be re-imported as a new version. `fileHash` is used by the ingestion layer to detect unchanged files, not to enforce uniqueness at the DB level.

### Check constraints (add via raw SQL in migration)

```sql
-- Driver confidence must be a valid probability
ALTER TABLE driver_database
  ADD CONSTRAINT driver_confidence_range
  CHECK (confidence >= 0.0 AND confidence <= 1.0);

-- Knowledge chunk confidence must be a valid probability
ALTER TABLE knowledge_chunks
  ADD CONSTRAINT chunk_confidence_range
  CHECK (confidence >= 0.0 AND confidence <= 1.0);

-- design_state version must be positive
ALTER TABLE design_state
  ADD CONSTRAINT design_state_version_positive
  CHECK (version > 0);
```

---

## 4.7 Migration Strategy

### Context

The schema has been authored but not yet pushed to a production Neon instance. The baseline `drizzle-orm` schema is the source of truth; `drizzle-kit` generates SQL migrations from schema diffs. There is no live data to preserve. This simplifies the strategy considerably.

### Recommended sequence

**Step 1: Extend the enum in schema.ts**

PostgreSQL enums cannot have values removed. Adding values is safe and non-destructive. Since the schema has not been deployed, modify the enum definition in place and let `drizzle-kit generate` produce an `ALTER TYPE ... ADD VALUE` statement:

```sql
-- Generated by drizzle-kit — do not hand-edit
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'literature';
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'vituixcad';
```

`ALTER TYPE ADD VALUE` is not transactional in PostgreSQL — it commits immediately even inside a transaction block. This is safe for additive changes. Since no rows yet use these values, there is no risk.

**Step 2: Add new enums**

`drizzle-kit` will emit `CREATE TYPE` for the four new enums. These have no dependencies and can be created in any order before the tables that reference them.

**Step 3: Add new tables**

All four new tables can be created in a single migration. Order matters for FK references:
1. `vituixcad_projects` (references `projects` only — already exists)
2. `literature_sources` (references `sources` only — already exists)
3. `driver_database` (references `vituixcad_projects` — must come after step 1)
4. `design_state` (references `projects` only — already exists)

**Step 4: Apply post-push SQL**

After `drizzle-kit push` or `migrate`, run the raw SQL index and constraint statements that Drizzle cannot express:

```bash
# Create a migration helper script: scripts/post-migrate.sql
psql $DATABASE_URL < scripts/post-migrate.sql
```

Contents of `scripts/post-migrate.sql`:

```sql
-- Vector similarity index (HNSW) — must exist before RAG queries
CREATE INDEX IF NOT EXISTS knowledge_embedding_hnsw
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- GIN indexes for JSONB containment queries
CREATE INDEX IF NOT EXISTS vxcad_parsed_data_gin
  ON vituixcad_projects USING gin (parsed_data);

CREATE INDEX IF NOT EXISTS lit_toc_gin
  ON literature_sources USING gin (toc);

-- Partial index for pipeline status
CREATE INDEX IF NOT EXISTS lit_unprocessed_idx
  ON literature_sources (created_at)
  WHERE is_ingested = false;

-- Check constraints
ALTER TABLE driver_database
  ADD CONSTRAINT IF NOT EXISTS driver_confidence_range
  CHECK (confidence >= 0.0 AND confidence <= 1.0);

ALTER TABLE knowledge_chunks
  ADD CONSTRAINT IF NOT EXISTS chunk_confidence_range
  CHECK (confidence >= 0.0 AND confidence <= 1.0);

ALTER TABLE design_state
  ADD CONSTRAINT IF NOT EXISTS design_state_version_positive
  CHECK (version > 0);
```

**Step 5: Verify**

```bash
# Confirm all tables exist with expected columns
npx drizzle-kit studio  # Visual schema browser

# Or via psql:
\d vituixcad_projects
\d literature_sources
\d driver_database
\d design_state
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'source_type'::regtype;
```

### If a production instance already exists

If this schema has already been deployed before this section is implemented:

1. **Never hand-edit migrations** — always `drizzle-kit generate` from schema changes
2. **Enum extension is safe** — `ADD VALUE IF NOT EXISTS` is idempotent
3. **New tables are additive** — no risk to existing data
4. **Existing foreign keys are unchanged** — no existing cascade behaviour is modified

---

## 4.8 Complete Schema Addition (copy-paste ready)

The following block is the addition to `web/lib/db/schema.ts`. It assumes the file already contains the baseline tables and imports shown in the baseline section. Add this block after the existing `sources` table definition.

```typescript
// ─── New Enums ───────────────────────────────────────────────────────────────

export const vituixcadProjectTypeEnum = pgEnum("vituixcad_project_type", [
  "full_project",
  "driver_model",
  "enclosure_sim",
  "crossover_sim",
]);

export const driverTypeEnum = pgEnum("driver_type", [
  "woofer",
  "midrange",
  "tweeter",
  "fullrange",
  "subwoofer",
  "midwoofer",
  "passive_radiator",
]);

export const driverSourceEnum = pgEnum("driver_source", [
  "vituixcad_vxd",
  "manufacturer_datasheet",
  "measured",
  "forum_post",
  "notebooklm_extract",
]);

export const moduleTypeEnum = pgEnum("module_type", [
  "enclosure",
  "crossover",
  "driver_select",
  "room_analysis",
  "project_goals",
]);

// ─── VituixCAD Projects ───────────────────────────────────────────────────────

export const vituixcadProjects = pgTable("vituixcad_projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 512 }).notNull(),
  projectType: vituixcadProjectTypeEnum("project_type").notNull(),
  filePath: text("file_path").notNull(),
  fileHash: varchar("file_hash", { length: 64 }),
  rawXml: text("raw_xml").notNull(),
  parsedData: jsonb("parsed_data").$type<Record<string, unknown>>().notNull(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectIdIdx: index("vxcad_project_id_idx").on(table.projectId),
  projectTypeIdx: index("vxcad_project_type_idx").on(table.projectType),
}));

// ─── Literature Sources ───────────────────────────────────────────────────────

export const literatureSources = pgTable("literature_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  authors: jsonb("authors").$type<string[]>().default([]),
  publisher: varchar("publisher", { length: 512 }),
  publishedYear: integer("published_year"),
  isbn: varchar("isbn", { length: 20 }),
  edition: varchar("edition", { length: 64 }),
  filePath: text("file_path").notNull(),
  fileHash: varchar("file_hash", { length: 64 }),
  totalPages: integer("total_pages"),
  toc: jsonb("toc").$type<Record<string, unknown>[]>().default([]),
  isIngested: boolean("is_ingested").default(false),
  processedAt: timestamp("processed_at"),
  chunkCount: integer("chunk_count").default(0),
  sourceId: uuid("source_id").references(() => sources.id, { onDelete: "cascade" }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  filePathIdx: uniqueIndex("lit_file_path_idx").on(table.filePath),
  ingestedIdx: index("lit_ingested_idx").on(table.isIngested),
}));

// ─── Driver Database ──────────────────────────────────────────────────────────

export const driverDatabase = pgTable("driver_database", {
  id: uuid("id").primaryKey().defaultRandom(),
  manufacturer: varchar("manufacturer", { length: 255 }).notNull(),
  model: varchar("model", { length: 255 }).notNull(),
  driverType: driverTypeEnum("driver_type").notNull(),
  nominalDiameterMm: real("nominal_diameter_mm"),
  nominalImpedanceOhm: real("nominal_impedance_ohm"),
  powerRatingW: real("power_rating_w"),
  thieleSmallParams: jsonb("thiele_small_params").$type<Record<string, unknown>>().notNull(),
  source: driverSourceEnum("source").notNull(),
  sourceRef: text("source_ref"),
  vxdProjectId: uuid("vxd_project_id").references(() => vituixcadProjects.id, { onDelete: "set null" }),
  confidence: real("confidence").default(0.8),
  verifiedByUser: boolean("verified_by_user").default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  manufacturerModelIdx: uniqueIndex("driver_mfr_model_idx")
    .on(table.manufacturer, table.model, table.source),
  driverTypeIdx: index("driver_type_idx").on(table.driverType),
  nominalDiameterIdx: index("driver_diameter_idx").on(table.nominalDiameterMm),
  nominalImpedanceIdx: index("driver_impedance_idx").on(table.nominalImpedanceOhm),
}));

// ─── Design State ─────────────────────────────────────────────────────────────

export const designState = pgTable("design_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  moduleType: moduleTypeEnum("module_type").notNull(),
  state: jsonb("state").$type<Record<string, unknown>>().notNull(),
  version: integer("version").default(1).notNull(),
  lastModifiedBy: agentDomainEnum("last_modified_by"),
  changeNote: text("change_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  projectModuleIdx: uniqueIndex("design_state_project_module_idx")
    .on(table.projectId, table.moduleType),
  projectIdx: index("design_state_project_idx").on(table.projectId),
}));
```

---

## 4.9 Summary

| Item | Count | Notes |
|------|-------|-------|
| New tables | 4 | vituixcad_projects, literature_sources, driver_database, design_state |
| New enums | 4 | vituixcad_project_type, driver_type, driver_source, module_type |
| Extended enums | 1 | source_type (+literature, +vituixcad) |
| New Drizzle indexes | 10 | B-tree, unique B-tree |
| Post-push SQL indexes | 4 | HNSW, GIN x2, partial |
| Post-push constraints | 3 | Check constraints on confidence + version |
| Modified table columns | 0 | All changes are additive |
| Broken FK chains | 0 | All existing references preserved |

The schema remains additive throughout — no existing columns, tables, or constraints are removed or renamed. The migration can be applied to any environment running the baseline schema without data loss.
