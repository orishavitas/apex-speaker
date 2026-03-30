# VituixCAD Sprint 1 — Authoritative Spec

**Date:** 2026-03-30
**Sprint duration:** 1 session (~5–6h wall-clock with parallel subagents)
**Synthesized by:** Meta-Orchestrator from 4 specialist agent debate positions

---

## 1. Sprint Overview

### What We're Building

This sprint adds the VituixCAD data layer to APEX: the ability to ingest real `.vxp` / `.vxd` / `.vxb` project files, persist them, model the driver database, and scaffold the workspace UI where the design state lives.

**In scope:**
- TypeScript domain types (canonical speaker model, parser shapes, math stubs)
- 3 new DB tables: `vituixcad_projects`, `driver_database`, `design_state`
- 3 new DB enums: `vituixcadProjectTypeEnum`, `driverTypeEnum`, `moduleTypeEnum`, `hornTypeEnum`
- VituixCAD file parsers: `parseVxp`, `parseVxd`, `parseVxb`
- Upload API: `POST /api/vituixcad/upload`
- Workspace scaffold: `/dashboard/workspace` (3-column layout, static data)
- Driver database UI: `/dashboard/drivers` (dense sortable table)
- Projects list UI: `/dashboard/projects` (drag-drop upload zone)
- VituixCAD agent routing: keyword → `vituixcad` domain

**Deferred to Sprint 2:**
- `vituixcad_measurements` table (Schema Architect flagged as premature; not on critical path)
- `literature_sources` table
- Relational ways table (JSONB `waysConfig` is sufficient for now)
- T/S sub-tables (all T/S params inline on `driver_database`)
- Driver database vector embedding (defer until RAG query pattern is known)
- Live math calculations in workspace (math stubs only this sprint)
- `/dashboard/literature` and `/dashboard/knowledge` routes

### Success Criteria

1. `tsc --noEmit` exits clean (zero type errors)
2. `npx drizzle-kit generate` exits clean (no schema conflicts)
3. Upload `.vxp` → `POST /api/vituixcad/upload` → returns parsed JSON
4. `/dashboard/projects` renders upload zone, lists ingested projects
5. `/dashboard/workspace` renders 3-column scaffold (no crashes)
6. `/dashboard/drivers` renders sortable driver table
7. Existing 7 agents remain unchanged and still route correctly
8. Graceful degradation intact: app works without `DATABASE_URL`

---

## 2. Resolved Decisions

All contested points from the agent debate, with rationale:

### 2.1 Table Count: 3, Not 4

**Conflict:** Schema Architect initially listed 4 tables including `vituixcad_measurements`.
**Resolution:** Schema Architect flagged it for deferral; Sprint Planner's critical path doesn't include it; UI/UX and Domain Logic never reference it. **Drop `vituixcad_measurements` this sprint.** Tables: `vituixcad_projects`, `driver_database`, `design_state`.

### 2.2 Horn Loading: DB Enum + TypeScript Discriminated Union

**Conflict:** Schema Architect proposed `hornTypeEnum` pgEnum. Domain Logic proposed discriminated union in TypeScript only.
**Resolution:** Both are correct for their layer. `hornTypeEnum` exists as a pgEnum in the schema for future query-ability. `HornLoadingConfig` is a discriminated union in TypeScript for type safety. They mirror each other. This is the idiomatic full-stack approach.

### 2.3 File Structure: Domain Logic Wins on Type Organization

**Conflict:** Sprint Planner used `web/lib/vituixcad/types.ts` and `web/lib/design/types.ts`. Domain Logic proposed `web/lib/types/speaker-domain.ts` etc.
**Resolution:** Domain Logic's structure is cleaner and more extensible. Use `web/lib/types/` directory with 4 files. The barrel export makes consumption identical.

### 2.4 Workspace Scaffold vs Full Implementation

**Conflict:** Sprint Planner deferred `/dashboard/workspace` (needs math foundation). UI/UX Architect wants it this sprint.
**Resolution:** Compromise. Build the 3-column CSS Grid layout and all UI panels. Driver slot cards show static/placeholder data. Math functions are stubs returning typed results. Structure exists now; real calculations populate it in Sprint 2. This unblocks UI feedback and lets the design evolve.

### 2.5 T/S Parameter Naming: Unit-Suffixed Canonical

**Conflict:** Multiple conventions discussed (bare names vs unit-suffixed).
**Resolution:** Domain Logic Agent (highest weight on type decisions) specified unit-suffixed canonical names. Adopted as-is: `Re_ohms`, `fs_hz`, `BL_Tm`, `Vas_L`, `Sd_cm2`, `Xmax_mm`, `Le_mH`, `Mms_g`, `Cms_mmPerN`. DB columns mirror these names (snake_case).

### 2.6 Parser Export Shape: Three Named Exports, No Dispatcher

**Conflict:** None explicit, but worth documenting. Domain Logic was clear.
**Resolution:** Three named exports `parseVxp`, `parseVxd`, `parseVxb`. No unified `parseVituixcad(fileType, xml)` dispatcher — the caller knows the file type from the extension and selects the parser directly. This avoids a runtime switch and keeps each parser's return type precise.

### 2.7 Ways Storage: JSONB This Sprint, Relational Later

**Conflict:** Schema Architect proposed JSONB `waysConfig`; no separate ways table.
**Resolution:** Accepted. `design_state.waysConfig` is `JSONB` typed as `WaySlot[]`. No cross-project queries on way slots are needed yet. The relational ways table is a Sprint 2 upgrade path if query patterns demand it.

### 2.8 Enum Extension Strategy

**Resolution (Schema Architect, no conflict):** New enums → `pgEnum` declaration. Extending existing enums (specifically `agentDomainEnum` to add `'vituixcad'`) → raw SQL `ALTER TYPE ... ADD VALUE IF NOT EXISTS` executed outside a transaction, in a separate migration step before `drizzle-kit push`.

---

## 3. File Structure

Every new file created this sprint, with purpose:

```
web/lib/types/
  speaker-domain.ts        Canonical domain model: all enums, interfaces, discriminated unions
  speaker-math.ts          Math function stub signatures + result types (no implementation)
  vituixcad-native.ts      Raw fast-xml-parser output shapes for .vxp/.vxd/.vxb
  index.ts                 Barrel re-export of all three

web/lib/parser/
  vxp-parser.ts            parseVxp(xml: string): VxpRaw
  vxd-parser.ts            parseVxd(xml: string): VxdRaw
  vxb-parser.ts            parseVxb(xml: string): VxbRaw
  ts-param-mapper.ts       PARAM_MAP + mapThieleSmall() + isCompleteThieleSmall() type guard

web/lib/db/
  schema.ts                MODIFIED — add 3 new tables + 4 new enums
  migrations/              Drizzle output (auto-generated, do not hand-edit)

web/app/api/vituixcad/
  upload/route.ts          POST handler: parse file → insert vituixcad_projects row → return JSON

web/app/dashboard/
  workspace/page.tsx       3-column workspace scaffold (CSS Grid, static data)
  drivers/page.tsx         Dense sortable driver database table
  projects/page.tsx        Project list + drag-drop upload zone
  projects/[id]/page.tsx   Single project detail view (basic, Sprint 2 expands)

web/components/workspace/
  topology-panel.tsx       Left column: way selector, xover freqs, import button
  driver-slots.tsx         Center column: scrollable way/driver slot cards
  horn-loading-fields.tsx  Inline conditional horn config fields (AnimatePresence)
  workspace-layout.tsx     CSS Grid wrapper: 220px | 1fr | 380px

web/components/drivers/
  driver-table.tsx         Sortable dense table with inline row expansion
  driver-type-pill.tsx     Colored pill matching domain-badge color system

web/components/projects/
  upload-zone.tsx          Drag-drop zone with 5 states (idle/drag-over/parsing/success/error)
  project-card.tsx         Project list item

web/app/api/agents/
  manager/route.ts         MODIFIED — add 'vituixcad' keyword routing
  vituixcad/route.ts       New specialist agent for VituixCAD questions
```

---

## 4. TypeScript Types

Full canonical type definitions. Source of truth for all layers.

### `web/lib/types/speaker-domain.ts`

```typescript
// ─── Enums ────────────────────────────────────────────────────────────────────

export type DriverType =
  | 'woofer'
  | 'midrange'
  | 'tweeter'
  | 'supertweeter'
  | 'subwoofer'
  | 'fullrange'
  | 'compression_driver'
  | 'ribbon'
  | 'planar'
  | 'coaxial'

export type ModuleType =
  | 'two_way'
  | 'three_way'
  | 'four_way'
  | 'mtm'
  | 'dappo'
  | 'subwoofer_only'

export type VituixcadProjectType = 'vxp' | 'vxd' | 'vxb'

export type HornType =
  | 'direct_radiator'
  | 'horn_tractrix'
  | 'horn_exponential'
  | 'horn_conical'
  | 'horn_os'
  | 'horn_le_cleach'
  | 'waveguide'
  | 'tl'

// ─── Thiele-Small Parameters ──────────────────────────────────────────────────
// Unit-suffixed canonical names. All fields nullable (real-world data is partial).

export interface ThieleSmallParams {
  Re_ohms: number | null        // DC voice coil resistance [Ω]
  fs_hz: number | null          // Resonant frequency [Hz]
  Qts: number | null            // Total Q factor [dimensionless]
  Qes: number | null            // Electrical Q factor [dimensionless]
  Qms: number | null            // Mechanical Q factor [dimensionless]
  BL_Tm: number | null          // Force factor [T·m]
  Vas_L: number | null          // Equivalent acoustic volume [L]
  Sd_cm2: number | null         // Effective piston area [cm²]
  Xmax_mm: number | null        // Maximum linear excursion [mm]
  Le_mH: number | null          // Voice coil inductance [mH]
  Mms_g: number | null          // Moving mass including air load [g]
  Cms_mmPerN: number | null     // Mechanical compliance [mm/N]
  eta0: number | null           // Reference efficiency [%]
  Spl_1w1m: number | null       // Sensitivity [dB SPL 1W/1m]
  nominalImpedance_ohms: number | null
  nominalDiameter_mm: number | null
}

// Type guard: true when all acoustically required fields are present
export function isCompleteThieleSmall(
  p: Partial<ThieleSmallParams>
): p is Required<Pick<ThieleSmallParams, 'Re_ohms' | 'fs_hz' | 'Qts' | 'Vas_L' | 'Sd_cm2'>> & ThieleSmallParams {
  return (
    p.Re_ohms != null &&
    p.fs_hz != null &&
    p.Qts != null &&
    p.Vas_L != null &&
    p.Sd_cm2 != null
  )
}

// ─── Horn Loading Configuration (discriminated union) ─────────────────────────

export type HornLoadingConfig =
  | { type: 'direct_radiator' }
  | {
      type: 'horn_tractrix' | 'horn_exponential' | 'horn_conical' | 'horn_os' | 'horn_le_cleach'
      throatDiam_mm: number | null
      mouthDiam_mm: number | null
      length_mm: number | null
      cutoffFreq_hz: number | null
      coverageH_deg: number | null
      coverageV_deg: number | null
    }
  | {
      type: 'waveguide'
      coverageH_deg: number | null
      coverageV_deg: number | null
      throatDiam_mm: number | null
      depth_mm: number | null
    }
  | {
      type: 'tl'
      lineLength_mm: number | null
      lineDiam_mm: number | null
      stuffingDensity_gPerL: number | null
    }

// ─── Driver ───────────────────────────────────────────────────────────────────

export interface Driver {
  id: string
  manufacturer: string
  model: string
  driverType: DriverType
  tsParams: ThieleSmallParams
  datasheetUrl: string | null
  source: string | null
  createdAt: Date
  updatedAt: Date
}

// ─── Way Slot (stored as JSONB array in design_state.waysConfig) ───────────────

export interface WaySlot {
  wayIndex: number              // 0-based
  label: string                 // e.g. "Woofer", "Midrange", "Tweeter"
  driverDatabaseId: string | null
  xoverFreqLow_hz: number | null
  xoverFreqHigh_hz: number | null
  hornLoading: HornLoadingConfig
  enclosureVolume_L: number | null
  enclosureType: 'sealed' | 'ported' | 'passive_radiator' | 'open_baffle' | null
}

// ─── Design State ─────────────────────────────────────────────────────────────

export interface DesignState {
  id: string
  projectId: string
  moduleType: ModuleType
  numWays: number
  waysConfig: WaySlot[]
  cabinetVolume_L: number | null
  cabinetMaterial_mm: number | null
  cabinetDampingFactor: number | null
  activeVituixcadProjectId: string | null
  version: number
  createdAt: Date
  updatedAt: Date
}

// ─── VituixCAD Project ────────────────────────────────────────────────────────

export interface VituixcadProject {
  id: string
  projectId: string
  fileType: VituixcadProjectType
  fileName: string
  fileHash: string
  parsedData: unknown           // VxpRaw | VxdRaw | VxbRaw depending on fileType
  schemaVersion: number
  createdAt: Date
  updatedAt: Date
}
```

### `web/lib/types/speaker-math.ts`

```typescript
// Math function stubs — signatures only, no implementation.
// Result objects are designed for future expansion (warnings, confidence scores).

import type { ThieleSmallParams } from './speaker-domain'

// ─── Enclosure Config Inputs ──────────────────────────────────────────────────

export interface SealedBoxConfig {
  volume_L: number
  Qtc?: number                  // Target system Q (default 0.707)
}

export interface PortedBoxConfig {
  volume_L: number
  tuningFreq_hz: number
  portDiam_mm?: number
}

export interface HornBoxConfig {
  throatDiam_mm: number
  mouthDiam_mm: number
  length_mm: number
  cutoffFreq_hz: number
  hornType: 'tractrix' | 'exponential' | 'conical'
}

// ─── Result Types ─────────────────────────────────────────────────────────────
// Result objects allow Phase B to add warnings/confidence without breaking callers.

export interface SealedBoxResult {
  ok: boolean
  Qtc: number | null
  f3_hz: number | null
  warnings: string[]
}

export interface PortedBoxResult {
  ok: boolean
  fb_hz: number | null
  portLength_mm: number | null
  f3_hz: number | null
  warnings: string[]
}

export interface HornResult {
  ok: boolean
  cutoffFreq_hz: number | null
  throatSpl_dB: number | null
  directivity_deg: number | null
  warnings: string[]
}

// ─── Stub Signatures ──────────────────────────────────────────────────────────
// Implementations land in Sprint 2 (math foundation phase).

export declare function calcSealedBox(
  ts: ThieleSmallParams,
  enclosure: SealedBoxConfig
): SealedBoxResult

export declare function calcPortedBox(
  ts: ThieleSmallParams,
  enclosure: PortedBoxConfig
): PortedBoxResult

export declare function calcHornLoading(
  ts: ThieleSmallParams,
  horn: HornBoxConfig
): HornResult
```

### `web/lib/types/vituixcad-native.ts`

```typescript
// Raw output shapes from fast-xml-parser.
// These mirror VituixCAD's XML schema exactly — no normalization yet.
// The ts-param-mapper converts VxpRaw → ThieleSmallParams.

export interface VxpDriverRaw {
  Fs?: string | number
  Qts?: string | number
  Qes?: string | number
  Qms?: string | number
  Re?: string | number
  Le?: string | number
  BL?: string | number
  Mms?: string | number
  Cms?: string | number
  Vas?: string | number
  Sd?: string | number
  Xmax?: string | number
  Spl?: string | number
  Znom?: string | number
  // fast-xml-parser may return any additional attributes
  [key: string]: string | number | undefined
}

export interface VxpProjectRaw {
  Project?: {
    '@_name'?: string
    '@_version'?: string
    Driver?: VxpDriverRaw | VxpDriverRaw[]
    Measurement?: VxpMeasurementRaw | VxpMeasurementRaw[]
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface VxpMeasurementRaw {
  '@_type'?: string
  '@_label'?: string
  Point?: { '@_f': string; '@_v': string } | { '@_f': string; '@_v': string }[]
  [key: string]: unknown
}

// .vxd — driver file (single driver + measurements)
export interface VxdRaw {
  Driver?: VxpDriverRaw
  Measurement?: VxpMeasurementRaw | VxpMeasurementRaw[]
  [key: string]: unknown
}

// .vxb — box/enclosure design file
export interface VxbRaw {
  Box?: {
    '@_type'?: string
    '@_volume'?: string | number
    Port?: { '@_diam': string | number; '@_length': string | number }
    [key: string]: unknown
  }
  [key: string]: unknown
}

// Convenience type alias for parser return union
export type VxpRaw = VxpProjectRaw
```

### `web/lib/types/index.ts`

```typescript
export * from './speaker-domain'
export * from './speaker-math'
export * from './vituixcad-native'
```

### `web/lib/parser/ts-param-mapper.ts`

```typescript
import type { ThieleSmallParams } from '../types/speaker-domain'
import type { VxpDriverRaw } from '../types/vituixcad-native'

// Map from VituixCAD XML attribute names → canonical ThieleSmallParams keys
export const PARAM_MAP: Record<string, keyof ThieleSmallParams> = {
  Fs: 'fs_hz',
  Qts: 'Qts',
  Qes: 'Qes',
  Qms: 'Qms',
  Re: 'Re_ohms',
  Le: 'Le_mH',
  BL: 'BL_Tm',
  Mms: 'Mms_g',
  Cms: 'Cms_mmPerN',
  Vas: 'Vas_L',
  Sd: 'Sd_cm2',
  Xmax: 'Xmax_mm',
  Spl: 'Spl_1w1m',
  Znom: 'nominalImpedance_ohms',
}

function parseNum(v: string | number | undefined): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(v)
  return isNaN(n) ? null : n
}

export function mapThieleSmall(raw: VxpDriverRaw): ThieleSmallParams {
  const result: Partial<ThieleSmallParams> = {}
  for (const [xmlKey, canonicalKey] of Object.entries(PARAM_MAP)) {
    ;(result as Record<string, number | null>)[canonicalKey] = parseNum(raw[xmlKey])
  }
  return {
    Re_ohms: result.Re_ohms ?? null,
    fs_hz: result.fs_hz ?? null,
    Qts: result.Qts ?? null,
    Qes: result.Qes ?? null,
    Qms: result.Qms ?? null,
    BL_Tm: result.BL_Tm ?? null,
    Vas_L: result.Vas_L ?? null,
    Sd_cm2: result.Sd_cm2 ?? null,
    Xmax_mm: result.Xmax_mm ?? null,
    Le_mH: result.Le_mH ?? null,
    Mms_g: result.Mms_g ?? null,
    Cms_mmPerN: result.Cms_mmPerN ?? null,
    eta0: null,
    Spl_1w1m: result.Spl_1w1m ?? null,
    nominalImpedance_ohms: result.nominalImpedance_ohms ?? null,
    nominalDiameter_mm: null,
  }
}

export { isCompleteThieleSmall } from '../types/speaker-domain'
```

---

## 5. Database Schema

3 new tables, 4 new enums. Full Drizzle code.

### New Enums (add to `web/lib/db/schema.ts`)

```typescript
import {
  pgTable, pgEnum, text, integer, real, boolean,
  timestamp, unique, index, jsonb, vector
} from 'drizzle-orm/pg-core'

// ─── New enums ────────────────────────────────────────────────────────────────

export const vituixcadProjectTypeEnum = pgEnum('vituixcad_project_type', [
  'vxp', 'vxd', 'vxb'
])

export const driverTypeEnum = pgEnum('driver_type', [
  'woofer', 'midrange', 'tweeter', 'supertweeter', 'subwoofer',
  'fullrange', 'compression_driver', 'ribbon', 'planar', 'coaxial'
])

export const moduleTypeEnum = pgEnum('module_type', [
  'two_way', 'three_way', 'four_way', 'mtm', 'dappo', 'subwoofer_only'
])

export const hornTypeEnum = pgEnum('horn_type', [
  'direct_radiator',
  'horn_tractrix', 'horn_exponential', 'horn_conical', 'horn_os', 'horn_le_cleach',
  'waveguide',
  'tl'
])
```

### Table: `vituixcad_projects`

```typescript
export const vituixcadProjects = pgTable(
  'vituixcad_projects',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fileType: vituixcadProjectTypeEnum('file_type').notNull(),
    fileName: text('file_name').notNull(),
    fileHash: text('file_hash').notNull(),
    parsedData: jsonb('parsed_data').notNull(),
    schemaVersion: integer('schema_version').notNull().default(1),
    // embedding deferred to sprint 2 when RAG query pattern is known
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    fileHashUnique: unique('vituixcad_projects_file_hash_unique').on(t.fileHash),
    projectIdIdx: index('vituixcad_projects_project_id_idx').on(t.projectId),
  })
)
```

### Table: `driver_database`

```typescript
export const driverDatabase = pgTable(
  'driver_database',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    manufacturer: text('manufacturer').notNull(),
    model: text('model').notNull(),
    driverType: driverTypeEnum('driver_type').notNull(),

    // Nominal specs
    nominalDiameter_mm: real('nominal_diameter_mm'),
    nominalImpedance_ohms: real('nominal_impedance_ohms'),

    // Thiele-Small parameters (all nullable — real-world data is partial)
    Re_ohms: real('re_ohms'),
    fs_hz: real('fs_hz'),
    Qts: real('qts'),
    Qes: real('qes'),
    Qms: real('qms'),
    BL_Tm: real('bl_tm'),
    Vas_L: real('vas_l'),
    Sd_cm2: real('sd_cm2'),
    Xmax_mm: real('xmax_mm'),
    Le_mH: real('le_mh'),
    Mms_g: real('mms_g'),
    Cms_mmPerN: real('cms_mm_per_n'),
    eta0: real('eta0'),
    Spl_1w1m: real('spl_1w1m'),

    datasheetUrl: text('datasheet_url'),
    source: text('source'),
    rawData: jsonb('raw_data'),           // original import blob for audit trail

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    manufacturerModelIdx: index('driver_database_manufacturer_model_idx')
      .on(t.manufacturer, t.model),
    driverTypeIdx: index('driver_database_driver_type_idx').on(t.driverType),
  })
)
```

### Table: `design_state`

```typescript
export const designState = pgTable(
  'design_state',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    moduleType: moduleTypeEnum('module_type').notNull().default('two_way'),
    numWays: integer('num_ways').notNull().default(2),
    // waysConfig: WaySlot[] — see web/lib/types/speaker-domain.ts
    waysConfig: jsonb('ways_config').notNull().default([]),

    cabinetVolume_L: real('cabinet_volume_l'),
    cabinetMaterial_mm: real('cabinet_material_mm'),
    cabinetDampingFactor: real('cabinet_damping_factor'),

    activeVituixcadProjectId: text('active_vituixcad_project_id')
      .references(() => vituixcadProjects.id, { onDelete: 'set null' }),

    version: integer('version').notNull().default(1),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    projectIdUnique: unique('design_state_project_id_unique').on(t.projectId),
  })
)
```

---

## 6. Migration Strategy

### Step 1: Extend `agentDomainEnum` (outside transaction)

The existing `agentDomainEnum` must gain a `'vituixcad'` value. Neon does not allow `ALTER TYPE ... ADD VALUE` inside a transaction. Run this manually before `drizzle-kit push`:

```sql
-- Run in Neon console or via psql, NOT inside a transaction block
ALTER TYPE agent_domain ADD VALUE IF NOT EXISTS 'vituixcad';
```

### Step 2: Verify pgvector extension

```sql
-- Must exist before migration runs (already present from Phase 2, but verify)
SELECT * FROM pg_extension WHERE extname = 'vector';
-- If missing: CREATE EXTENSION IF NOT EXISTS vector;
```

### Step 3: Generate and push

```bash
cd web
npx drizzle-kit generate    # inspect output — confirm only additive changes
npx drizzle-kit push        # applies to Neon
```

### Step 4: Verify

```bash
# Quick smoke-test: confirm tables exist
npx drizzle-kit studio      # or psql: \dt vituixcad* driver_database design_state
```

### Notes

- All 4 new enums (`vituixcadProjectTypeEnum`, `driverTypeEnum`, `moduleTypeEnum`, `hornTypeEnum`) are new standalone declarations — no ALTER needed.
- `fileHash` has a unique constraint — duplicate uploads will fail at DB level with a clear error (handle in API with 409 response).
- `design_state.projectId` has a unique constraint — one design state per project.
- JSONB schema drift risk: `waysConfig` and `parsedData` have no DB-level schema. Validate at API boundary with Zod before insert.

---

## 7. API Endpoints

### `POST /api/vituixcad/upload`

**Purpose:** Parse uploaded VituixCAD file, persist to `vituixcad_projects`, return parsed data.

**Request:**
```
Content-Type: multipart/form-data
Body:
  file: <binary>          .vxp / .vxd / .vxb file
  projectId: string       existing projects.id to attach to
```

**Response 200:**
```json
{
  "id": "uuid",
  "fileType": "vxp",
  "fileName": "my-project.vxp",
  "fileHash": "sha256hex",
  "parsedData": { ... },
  "schemaVersion": 1
}
```

**Response 409:** Duplicate file hash (already ingested)
```json
{ "error": "duplicate", "existingId": "uuid" }
```

**Response 422:** Parse failure
```json
{ "error": "parse_failed", "detail": "..." }
```

**Next.js body limit override** (required — default is 4MB, VXP files can be larger):
```typescript
export const config = {
  api: { bodyParser: false }
}
// Use formidable or next's built-in formData() which handles streams
```

> Note: Next.js 16 App Router uses `request.formData()` — no `bodyParser: false` config needed. Default limit is 1MB for JSON but multipart uses streaming. Add `export const maxDuration = 30` for safety.

### `GET /api/vituixcad/projects`

**Purpose:** List all VituixCAD projects for a given `projectId`.

**Query params:** `projectId: string`

**Response 200:**
```json
[
  {
    "id": "uuid",
    "fileType": "vxp",
    "fileName": "my-design.vxp",
    "createdAt": "ISO8601",
    "schemaVersion": 1
  }
]
```

### `GET /api/vituixcad/projects/[id]`

**Purpose:** Fetch full parsed data for a single VituixCAD project.

**Response 200:** Full `vituixcad_projects` row including `parsedData`.

### `GET /api/drivers`

**Purpose:** List drivers from `driver_database` with filtering + sorting.

**Query params:**
- `type?: DriverType`
- `manufacturer?: string`
- `sortBy?: 'fs_hz' | 'Qts' | 'Spl_1w1m' | 'manufacturer' | 'model'`
- `sortDir?: 'asc' | 'desc'`
- `limit?: number` (default 100)
- `offset?: number` (default 0)

**Response 200:**
```json
{
  "drivers": [ { ...driver rows... } ],
  "total": 42
}
```

### `POST /api/drivers`

**Purpose:** Add a driver to the database manually (or from parsed VxD).

**Body:** `Omit<Driver, 'id' | 'createdAt' | 'updatedAt'>`

### `GET /api/design-state/[projectId]`

**Purpose:** Fetch or initialize design state for a project.

Creates a default `design_state` row if none exists (idempotent upsert).

**Response 200:** Full `DesignState` object.

### `PATCH /api/design-state/[projectId]`

**Purpose:** Update design state (topology change, way config, cabinet params, etc.)

**Body:** `Partial<DesignState>` (only fields to update)

Uses optimistic concurrency via `version` field — increment on every write.

---

## 8. UI Layout

### 8.1 Workspace — Three-Column Layout

```
/dashboard/workspace
┌─────────────────────────────────────────────────────────────────────┐
│ APEX ◈  Projects  Workspace  Drivers  Chat           [zinc dark bg] │
├──────────────┬────────────────────────────────┬─────────────────────┤
│  220px       │  flex (fills remaining)        │  380px              │
│              │                                │                     │
│  TOPOLOGY    │  WAY SLOTS                     │  AGENT CHAT         │
│  ──────────  │  ─────────                     │  ───────────        │
│  ○ 2-way     │  ┌────────────────────────┐    │  [existing chat     │
│  ● 3-way     │  │ Way 1 — Woofer         │    │   component,        │
│  ○ 4-way     │  │ Driver: [unassigned ▼] │    │   reused here]      │
│  ○ MTM       │  │ Vol: ___L  Type: ___   │    │                     │
│  ○ D'Appo    │  │ ▼ Horn Loading         │    │                     │
│  ○ Sub-only  │  │   • Direct radiator ●  │    │                     │
│              │  │   • Horn ○             │    │                     │
│  CROSSOVER   │  │   • Waveguide ○        │    │                     │
│  ──────────  │  │   • TL ○               │    │                     │
│  Way 1/2     │  │ [if horn selected →    │    │                     │
│  f: ___Hz    │  │  inline fields appear  │    │                     │
│  Way 2/3     │  │  with 120ms fade-in]   │    │                     │
│  f: ___Hz    │  └────────────────────────┘    │                     │
│              │  ┌────────────────────────┐    │                     │
│  IMPORT      │  │ Way 2 — Tweeter        │    │                     │
│  ──────────  │  │ ...                    │    │                     │
│ [↑ .vxp]    │  └────────────────────────┘    │                     │
└──────────────┴────────────────────────────────┴─────────────────────┘
CSS Grid: grid-cols-[220px_1fr_380px], h-[calc(100vh-56px)]
```

**Implementation rules:**
- Left column: `sticky top-0 overflow-y-auto`
- Center column: `overflow-y-auto` with `pb-8` bottom padding
- Right column: agent chat sidebar (reuse existing chat component, scoped to `vituixcad` domain)
- No horizontal scroll — all content fits within its column
- Topology selector uses radio-group (shadcn `RadioGroup`)

### 8.2 Horn Loading — Inline Conditional Fields

Horn loading fields appear/disappear inline using `AnimatePresence` (framer-motion, already in stack). No tabs, no accordions, no modals.

```
Horn Loading
  ◉ Direct radiator         ← no additional fields

  ○ Horn (tractrix)         ← when selected, fields fade in below:
     Throat: ___ mm   Mouth: ___ mm
     Length: ___ mm   Cutoff: ___ Hz
     H: ___ °         V: ___ °

  ○ Waveguide
     H: ___ °         V: ___ °
     Throat: ___ mm   Depth: ___ mm

  ○ Transmission Line
     Length: ___ mm   Diam: ___ mm
     Stuffing: ___ g/L
```

Transition: `initial={{ opacity: 0, height: 0 }}` → `animate={{ opacity: 1, height: 'auto' }}` at 120ms ease.

### 8.3 Driver Database Table

```
/dashboard/drivers
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Driver Database                                         [+ Add Driver]  [Filter▼] │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Manufacturer ↕  Model ↕   Type      Fs↕    Qts↕   Vas↕   Xmax↕  Re↕   Sd↕       │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Seas         EA17RCY  [woofer]   52.0    0.41   8.2L   6.5    6.2   133        │
│  └─ expanded row: all T/S params in 2-col grid, datasheet link, source          │
│ ScanSpeak    D2905    [tweeter]  520.0   0.24   0.07L  0.5    5.0   8.5        │
│ ...                                                                              │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Rules:**
- Dense table: `text-sm`, `py-1.5 px-3` cell padding (not card-based)
- All numeric values: `font-mono text-right`
- Driver type pills: colored using domain-badge color system
  - woofer=amber, tweeter=violet, midrange=sky, fullrange=emerald, subwoofer=orange, compression_driver=rose
- Sortable columns: click header to sort, second click reverses
- Row expansion: click row → slides open below (not modal) with full T/S params grid
- No pagination — virtual scroll with `react-virtual` if list exceeds 200 rows

### 8.4 Projects Page — Upload Zone

```
/dashboard/projects
┌─────────────────────────────────────────────────────────┐
│ VituixCAD Projects                              [New →]  │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │                                                     │ │
│ │          ↑  Drop .vxp / .vxd / .vxb here           │ │
│ │             or click to browse                      │ │
│ │                                                     │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                          │
│ Recent Projects                                          │
│ ─────────────────                                        │
│ my-design.vxp    2-way  •  3 measurements  •  today     │
│ woofer-test.vxd  driver  •  imported 2026-03-28         │
└─────────────────────────────────────────────────────────┘
```

**Upload zone 5 states:**

| State | Visual |
|-------|--------|
| `idle` | Dashed zinc border, zinc-500 text |
| `drag-over` | Solid violet border, bg-violet-950/30, scale(1.01) |
| `parsing` | Spinner + "Parsing file…" |
| `success` | Green check + filename + "Saved" — auto-clears after 3s |
| `error` | Red border + error message + retry button |

---

## 9. Sprint Backlog

23 tasks, P0 = critical path, P1 = required for DoD, P2 = important, P3 = deferred within sprint.

| ID  | Priority | Task | Acceptance Criteria |
|-----|----------|------|---------------------|
| T01 | P0 | Install `fast-xml-parser` | `npm i fast-xml-parser` succeeds; imports resolve |
| T02 | P0 | Write `web/lib/types/` (4 files) | `tsc` clean; all exports accessible from barrel |
| T03 | P1 | Write `web/lib/parser/ts-param-mapper.ts` | `mapThieleSmall(raw)` returns typed object; unit test passes |
| T04 | P0 | Add 4 enums + 3 tables to `web/lib/db/schema.ts` | No TS errors in schema file |
| T05 | P0 | Run `ALTER TYPE agent_domain ADD VALUE 'vituixcad'` on Neon | Confirmed in DB; `drizzle-kit generate` passes |
| T06 | P0 | `drizzle-kit generate && drizzle-kit push` | Migration applies cleanly; 3 new tables visible in Neon |
| T07 | P1 | Write `web/lib/parser/vxp-parser.ts` | `parseVxp(xml)` returns `VxpRaw`; handles single-element array edge case |
| T08 | P1 | Write `web/lib/parser/vxd-parser.ts` | `parseVxd(xml)` returns `VxdRaw` |
| T09 | P0 | Write `web/lib/parser/vxb-parser.ts` | `parseVxb(xml)` returns `VxbRaw` |
| T10 | P0 | Write `POST /api/vituixcad/upload/route.ts` | Upload `.vxp` → 200 with parsed JSON; duplicate → 409; bad file → 422 |
| T11 | P1 | Write `GET /api/vituixcad/projects` | Returns array of projects for a projectId |
| T12 | P1 | Write `GET /api/drivers` + `POST /api/drivers` | Driver CRUD works; filtering + sorting functional |
| T13 | P1 | Write `GET/PATCH /api/design-state/[projectId]` | GET creates default on first call; PATCH updates fields |
| T14 | P1 | Write `web/components/workspace/workspace-layout.tsx` | CSS Grid 220px/1fr/380px renders; no layout overflow |
| T15 | P1 | Write `web/components/workspace/topology-panel.tsx` | RadioGroup for module type; xover freq inputs; import button wired |
| T16 | P0 | Write `web/components/workspace/driver-slots.tsx` | Slot cards render per numWays; driver dropdown shown (unconnected) |
| T17 | P1 | Write `web/components/workspace/horn-loading-fields.tsx` | AnimatePresence 120ms transitions; all 4 arm variants render correct fields |
| T18 | P1 | Write `/dashboard/workspace/page.tsx` | Page renders 3-column; no crashes; chat sidebar shows |
| T19 | P1 | Write `web/components/drivers/driver-table.tsx` | Sortable columns; row expansion; monospace numerics |
| T20 | P1 | Write `/dashboard/drivers/page.tsx` | Fetches from `GET /api/drivers`; table renders |
| T21 | P1 | Write `web/components/projects/upload-zone.tsx` | All 5 states render; file drop calls upload API |
| T22 | P0 | Write `/dashboard/projects/page.tsx` | Upload zone + project list renders; upload round-trip works |
| T23 | P1 | Add `vituixcad` agent route + keywords to manager | VituixCAD questions route to vituixcad agent; existing agents unchanged |

---

## 10. Critical Path + Parallelism Windows

```
CRITICAL PATH (must be sequential):
T01 → T02 → T04 → T05 → T06 → T10 → T22 → [tsc gate]

PARALLELISM WINDOWS (run with subagents):

Window A (after T01+T02 complete):
  ├── Agent α: T03 (ts-param-mapper)
  ├── Agent β: T04 (schema)
  └── Agent γ: T07+T08+T09 (parsers)

Window B (after T04+T06 complete):
  ├── Agent α: T10+T11 (upload API + list API)
  ├── Agent β: T12+T13 (drivers API + design-state API)
  └── Agent γ: T14+T15+T17 (workspace layout + topology + horn fields)

Window C (after Window B complete):
  ├── Agent α: T16+T18 (driver slots + workspace page)
  ├── Agent β: T19+T20 (driver table + drivers page)
  └── Agent γ: T21+T22 (upload zone + projects page)

Window D (all above complete):
  └── Agent α: T23 (vituixcad agent routing)
  └── tsc gate + smoke test

Estimated wall-clock with parallel agents: 5–6 hours
Estimated wall-clock single-threaded: 10–14 hours
```

---

## 11. Risk Register

Deduplicated from all 4 agent inputs.

| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R01 | `ALTER TYPE ... ADD VALUE` is not transactional in Neon/Postgres | HIGH | Run outside transaction block, manually before drizzle push; confirm in DB before continuing |
| R02 | `fast-xml-parser` returns single-element arrays as objects, not arrays | HIGH | Always normalize with `Array.isArray(x) ? x : [x]` in parsers; unit test with single-driver VXP |
| R03 | Next.js 16 App Router default upload limit (1MB for some paths) | MEDIUM | Use `request.formData()` with streaming; add `export const maxDuration = 30`; test with large files |
| R04 | JSONB schema drift on `waysConfig` and `parsedData` | MEDIUM | Zod validation at API boundary before DB insert; schema version field for future migrations |
| R05 | HNSW index on `knowledge_chunks` may need rebuild after schema migration | LOW | Run `REINDEX INDEX CONCURRENTLY` if vector search degrades; verify existing agents post-migration |
| R06 | `pgvector` extension must exist before migration | LOW | Verify with `SELECT * FROM pg_extension WHERE extname = 'vector'` before push |
| R07 | VituixCAD keyword routing may conflict with existing agent keywords | MEDIUM | Add VituixCAD keywords at top of manager routing (highest priority); test all 7 existing agents after T23 |
| R08 | Horn discriminated union arms not exhaustively checked at runtime | MEDIUM | Use switch exhaustiveness pattern with `never` fallthrough in rendering code |
| R09 | Workspace math stubs with `declare function` will fail if called | LOW | Stub implementations throw `Error('not implemented — Sprint 2')` rather than being undefined |
| R10 | Duplicate `fileHash` inserts return DB constraint error, not graceful 409 | MEDIUM | Catch `23505` Postgres unique violation in upload route handler, return structured 409 |

---

## 12. Definition of Done

All must pass before sprint is closed:

- [ ] `npx tsc --noEmit` exits with code 0 (zero type errors across entire `web/` directory)
- [ ] `npx drizzle-kit generate` exits clean (no unresolved schema conflicts)
- [ ] `POST /api/vituixcad/upload` with a real `.vxp` file returns 200 with valid JSON
- [ ] `/dashboard/projects` renders upload zone; file drop triggers upload round-trip
- [ ] `/dashboard/workspace` renders 3-column layout without crashes or hydration errors
- [ ] `/dashboard/drivers` renders driver table (may be empty; no crashes)
- [ ] Sending "VituixCAD crossover design" to manager routes to `vituixcad` agent
- [ ] Sending "acoustics question" still routes to `acoustics` agent (regression check)
- [ ] Sending "enclosure volume" still routes to `enclosure` agent (regression check)
- [ ] App loads at `http://localhost:3000` without `DATABASE_URL` (graceful degradation intact)
- [ ] No `console.error` output on page load for any dashboard route
- [ ] Git history is clean: one commit per logical unit, conventional commit messages

---

## Appendix: Decision Log

Decisions made during synthesis that weren't fully covered by debate positions:

1. **`design_state.waysConfig` default value:** Set to `[]` (empty array) in schema. The API `GET /design-state/[projectId]` auto-populates with `numWays` default slots on first creation. This was not specified by any agent.

2. **`isCompleteThieleSmall` lives in `speaker-domain.ts`, re-exported from `ts-param-mapper.ts`:** Domain Logic placed it in the mapper; it logically belongs with the type. It's defined in `speaker-domain.ts` alongside `ThieleSmallParams` and re-exported from the mapper for import convenience.

3. **Math stub `declare function` vs throw:** Domain Logic said "stub signatures." `declare function` only works in `.d.ts` files — in a `.ts` source file you need actual function bodies. Resolution: stub functions throw `new Error('not implemented — Sprint 2')` so they're importable and type-safe without silently returning `undefined`.

4. **`/dashboard/projects/[id]` scope:** Sprint Planner listed it; UI/UX deferred detail view. Resolution: create the route this sprint with minimal content (file info + parsed data JSON viewer). Full detail view with measurement charts is Sprint 2.

5. **VituixCAD agent system prompt:** Not specified by any agent. The new `vituixcad/route.ts` agent should use a domain prompt focused on: interpreting VituixCAD simulation data, crossover design, driver selection, and enclosure tuning. A basic prompt is sufficient this sprint — system prompts can be refined in Sprint 2.

6. **`nominalDiameter_mm` in `driver_database`:** Schema Architect listed it; T/S mapper doesn't map it (VituixCAD XML doesn't include it). The field exists in the DB and type, but is populated manually or from separate datasheet import. Not a blocker.
