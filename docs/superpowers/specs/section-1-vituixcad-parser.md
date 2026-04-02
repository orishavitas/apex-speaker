# Section 1: VituixCAD XML Parser & Data Model

**Status:** Draft — Ready for Implementation
**Owner:** Ori Shavit
**Date:** 2026-03-28
**Parent Spec:** `2026-03-26-apex-system-design.md`

---

## 1.1 Overview

VituixCAD stores all project data as XML. Three file types matter to APEX:

| Extension | Contains | Use in APEX |
|-----------|----------|-------------|
| `.vxp` | Full project: drivers, crossover schematic, targets, layout | Primary import target — source of all design decisions |
| `.vxd` | Driver database — Thiele-Small parameters for a library of drivers | Populate driver catalog; enrich projects with manufacturer data |
| `.vxb` | Baffle geometry — corner coordinates, driver mounting positions | Feed Mechanical and Acoustics agents with dimensional context |

Measurement files referenced by `.vxp` (`.frd` frequency response, `.zma` impedance) are not XML but matter for completeness — handled separately (Section 1.7).

The pipeline is:

```
File Upload → XML Parse → Type-safe Object → Drizzle Insert (JSONB + metadata)
                                    ↓
                          Descriptive Text Generator
                                    ↓
                          Embedding → pgvector RAG
```

---

## 1.2 Library Choice: fast-xml-parser

### Candidates

| Library | Parse Speed | Type Support | Attribute Handling | Bundle Size | Verdict |
|---------|------------|--------------|-------------------|-------------|---------|
| `fast-xml-parser` v4 | ~3× faster than xml2js | Native TypeScript | First-class (`@_attr`) | 47 kB | **Selected** |
| `xml2js` | Baseline | `@types/xml2js` needed | Awkward (`$` key) | 28 kB | Rejected |
| `@xmldom/xmldom` + xpath | Slow for bulk | Verbose | DOM traversal needed | 61 kB | Rejected |

**Decision rationale:** VituixCAD files are compact (typically < 500 kB for `.vxp`, < 5 MB for `.vxd` with hundreds of drivers). `fast-xml-parser` produces plain JS objects with configurable attribute key names, making it straightforward to map directly onto TypeScript interfaces without a secondary normalization step. Its `XMLValidator.validate()` also provides a cheap pre-parse integrity check.

### Parser Configuration

```typescript
// lib/vituixcad/parser-config.ts
import { XMLParser, XMLValidator } from 'fast-xml-parser';

export const VXP_PARSER_OPTIONS = {
  ignoreAttributes: false,
  attributeNamePrefix: '_',       // <DRIVER di="0"> → driver._di
  allowBooleanAttributes: true,
  parseAttributeValue: true,      // numeric attributes stay numbers
  parseTagValue: true,            // numeric text nodes stay numbers
  trimValues: true,
  isArray: (tagName: string) => {
    // These tags always appear as arrays even when count = 1
    const ALWAYS_ARRAY = ['DRIVER', 'RESPONSE', 'PART', 'PARAM', 'WIRE', 'CORNER'];
    return ALWAYS_ARRAY.includes(tagName);
  },
};

export const VXD_PARSER_OPTIONS = {
  ...VXP_PARSER_OPTIONS,
  isArray: (tagName: string) => tagName === 'DRIVER',
};

export function createParser(options = VXP_PARSER_OPTIONS) {
  return new XMLParser(options);
}
```

The `isArray` override is critical. VituixCAD writes a single `<DRIVER>` element (not `<DRIVERS><DRIVER/></DRIVERS>` style) when there's one driver. Without `isArray`, `fast-xml-parser` will produce a plain object for count=1 but an array for count>1, breaking all downstream code.

---

## 1.3 TypeScript Type Definitions

### 1.3.1 Shared Primitives

```typescript
// lib/vituixcad/types.ts

/** Floating-point value with optional unit annotation */
export type PhysicalValue = number;

/** Index attribute — VituixCAD uses di="0", ri="0", xi="0", pi="0", wi="0" */
export type IndexedElement<T> = T & { _index: number };
```

### 1.3.2 .vxp Project Types

```typescript
// lib/vituixcad/types.ts (continued)

export interface VxpTarget {
  FreqMin: number;       // Hz
  FreqMax: number;       // Hz
  SPL: number;           // dB
  Tilt: number;          // dB/decade, typically 0
}

export interface VxpResponse {
  _ri: number;           // response index (0-based)
  FileName: string;      // relative path to .frd file
  Hor: number;           // horizontal angle degrees
  Ver: number;           // vertical angle degrees
}

export interface VxpDriver {
  _di: number;           // driver index (0-based)
  Model: string;         // e.g. "SB21SDC-C000-4"
  SPL: number;           // nominal sensitivity dB/2.83V/1m
  Z: number;             // nominal impedance Ω
  ResponseDirectory: string;   // path to folder containing .frd files
  ImpedanceFile: string;       // path to .zma file
  RESPONSE: VxpResponse[];     // polar measurement grid
}

export type CrossoverDSP = 'Analog' | 'DSP';

export type CrossoverPartType =
  | 'Generator'
  | 'Capacitor'
  | 'Inductor'
  | 'Resistor'
  | 'Wire'
  | 'Driver'
  | 'Ground';

export interface VxpParam {
  _pi: number;           // param index (0-based)
  Name: string;          // e.g. "Inductance", "Capacitance", "Resistance"
  Value: number;         // numeric value
  Unit: string;          // "mH", "uF", "Ohm", "Hz", etc.
  Optimize: 0 | 1;       // whether optimizer may touch this param
  Min: number;           // optimizer lower bound
  Max: number;           // optimizer upper bound
}

export interface VxpWirePoint {
  _wi: number;
  X: number;             // schematic canvas X coordinate
  Y: number;             // schematic canvas Y coordinate
}

export interface VxpPart {
  _xi: number;           // part index (0-based)
  Type: CrossoverPartType;
  CenX: number;          // schematic canvas X
  CenY: number;          // schematic canvas Y
  PartID: number;        // internal stable ID used by wire routing
  Open: 0 | 1;           // part is bypassed (open circuit)
  Shorted: 0 | 1;        // part is bypassed (short circuit)
  Rotated: 0 | 1;        // schematic symbol is rotated 90°
  PARAM?: VxpParam[];    // passive components have params; Wire/Ground do not
  WIRE?: VxpWirePoint[]; // wire routing points (Type === 'Wire' only)
}

export interface VxpCrossover {
  DSP: CrossoverDSP;
  SampleRate?: number;   // Hz — present only when DSP === 'DSP'
  PART: VxpPart[];
}

export interface VxpProject {
  // Global project settings
  Description: string;
  ReferenceAngle: number;    // degrees
  SPLmax: number;            // dB — max SPL for polar plots
  DualPlane: 0 | 1;          // show both H + V polar planes
  XMin: number;              // frequency plot X min (Hz)
  XMax: number;              // frequency plot X max (Hz)
  HalfSpace: 0 | 1;         // 2π (half-space) vs 4π loading
  AngleStep: number;         // polar angle increment (degrees)
  FrontWall: 0 | 1;         // baffle-step compensation enabled
  ReferDistance: number;     // reference distance (m), typically 1.0

  // Design targets
  AxialTarget: VxpTarget;
  PowerTarget: VxpTarget;

  // Drivers (always array — 1-way through N-way)
  DRIVER: VxpDriver[];

  // Crossover network
  CROSSOVER: VxpCrossover;
}
```

### 1.3.3 .vxd Driver Database Types

```typescript
export type DriverType = 'Woofer' | 'Midrange' | 'Tweeter' | 'Fullrange' | 'Subwoofer';
export type DriverStatus = 'Active' | 'Discontinued' | 'Sample';

export interface VxdDriver {
  Manufacturer: string;  // e.g. "SB Acoustics"
  Model: string;         // e.g. "SB17NRX2C35-8"
  Type: DriverType;
  Status: DriverStatus;
  Size: number;          // nominal diameter inches (3.5, 5.25, 6.5, 8, 10, 12...)

  // Thiele-Small electrical parameters
  Re: number;            // DC voice coil resistance Ω
  fs: number;            // resonance frequency Hz
  Qms: number;           // mechanical Q
  Qes: number;           // electrical Q
  Qts: number;           // total Q
  Rms: number;           // mechanical resistance kg/s
  Mms: number;           // moving mass grams
  Cms: number;           // compliance mm/N
  Vas: number;           // equivalent air volume liters
  Sd: number;            // effective piston area cm²
  BL: number;            // force factor T·m
  Pmax: number;          // maximum power W (program)
  Xmax: number;          // linear excursion mm (one-way)
  Beta: number;          // Le frequency dependence exponent (0–1)
  Le: number;            // voice coil inductance mH (at 1kHz)
}

export interface VxdDatabase {
  DRIVER: VxdDriver[];
}
```

### 1.3.4 .vxb Baffle Types

```typescript
export interface VxbCorner {
  _ci: number;   // corner index
  X: number;     // mm from baffle origin
  Y: number;     // mm from baffle origin
}

export interface VxbDriverMount {
  _di: number;
  X: number;     // center X mm from baffle origin
  Y: number;     // center Y mm from baffle origin
  Diameter: number;  // cutout diameter mm
}

export interface VxbBaffle {
  Width: number;      // mm — bounding box width
  Height: number;     // mm — bounding box height
  Depth?: number;     // mm — cabinet depth (may be absent in older files)
  CORNER: VxbCorner[];        // polygon corners (3–36 points)
  DRIVER: VxbDriverMount[];   // driver mounting holes (up to 12)
}
```

---

## 1.4 Drizzle ORM Schema

```typescript
// db/schema/vituixcad.ts
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  pgEnum,
  integer,
  boolean,
  real,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { VxpProject, VxdDriver, VxbBaffle } from '@/lib/vituixcad/types';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const projectTypeEnum = pgEnum('vxcad_project_type', ['vxp', 'vxd', 'vxb']);

export const crossoverTopologyEnum = pgEnum('vxcad_crossover_topology', [
  '1-way',
  '2-way',
  '3-way',
  '4-way',
  'unknown',
]);

// ─── vituixcad_projects ───────────────────────────────────────────────────────

/**
 * Central store for all uploaded VituixCAD files.
 *
 * Design decisions:
 *  - `raw_xml` preserves the original file verbatim for round-trip safety.
 *  - `parsed_data` is JSONB typed to the relevant TS interface, validated at
 *    insert time by the parser layer, not by a DB constraint (keep it fast).
 *  - `metadata` stores denormalized scalars for efficient filtering without
 *    JSONB path queries (driver count, crossover topology, driver models).
 *  - `description_text` is the natural-language representation fed to the
 *    embedding pipeline — stored here so it can be regenerated without re-parse.
 */
export const vituixcadProjects = pgTable(
  'vituixcad_projects',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id').notNull(),  // parent APEX project FK

    // Identity
    name: text('name').notNull(),              // user-assigned name or file stem
    fileName: text('file_name').notNull(),     // original upload filename
    projectType: projectTypeEnum('project_type').notNull(),

    // Raw preservation (round-trip source)
    rawXml: text('raw_xml').notNull(),

    // Typed parsed payload — cast to correct TS type by project_type
    parsedData: jsonb('parsed_data')
      .$type<VxpProject | VxdDriver[] | VxbBaffle>()
      .notNull(),

    // Denormalized metadata for fast filter/facet queries
    metadata: jsonb('metadata')
      .$type<VxpMetadata | VxdMetadata | VxbMetadata>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    // Natural-language description for RAG embedding
    descriptionText: text('description_text'),

    // External file references extracted from parsed data
    // Paths are stored relative to the .vxp file; resolution strategy in §1.7
    referencedFiles: jsonb('referenced_files')
      .$type<ReferencedFiles>()
      .default(sql`'[]'::jsonb`),

    // Timestamps
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),

    // Soft delete — keep data for RAG even if user removes from UI
    deletedAt: timestamp('deleted_at'),
  },
  (table) => ({
    projectIdIdx: index('vxcad_project_id_idx').on(table.projectId),
    typeIdx: index('vxcad_type_idx').on(table.projectType),
    // Partial index — only non-deleted rows appear in normal queries
    activeIdx: index('vxcad_active_idx')
      .on(table.projectId, table.projectType)
      .where(sql`deleted_at IS NULL`),
  })
);

// ─── Metadata Shapes ──────────────────────────────────────────────────────────

/**
 * Denormalized fields extracted from .vxp parsed_data.
 * Stored in the `metadata` JSONB column — do NOT query parsed_data directly.
 */
export interface VxpMetadata {
  driverCount: number;
  crossoverTopology: '1-way' | '2-way' | '3-way' | '4-way' | 'unknown';
  crossoverType: 'Analog' | 'DSP';
  sampleRate?: number;                 // present when crossoverType === 'DSP'
  driverModels: string[];              // e.g. ["SB17NRX2C35-8", "SB21SDC-C000-4"]
  partCount: number;                   // total crossover parts
  passiveComponentCount: number;       // Capacitor + Inductor + Resistor
  axialTargetFreqRange: [number, number]; // [FreqMin, FreqMax] Hz
  halfSpace: boolean;
  frontWall: boolean;
}

export interface VxdMetadata {
  driverCount: number;
  manufacturers: string[];             // unique manufacturer names
  types: string[];                     // unique driver types present
  sizeRange: [number, number];         // [minInches, maxInches]
}

export interface VxbMetadata {
  cornerCount: number;
  driverMountCount: number;
  widthMm: number;
  heightMm: number;
  depthMm?: number;
}

export interface ReferencedFiles {
  frd: Array<{                         // frequency response data files
    driverIndex: number;
    responseIndex: number;
    horizontalAngle: number;
    verticalAngle: number;
    relativePath: string;
    uploadedId?: string;               // FK to vituixcad_measurements once uploaded
  }>;
  zma: Array<{                         // impedance measurement files
    driverIndex: number;
    relativePath: string;
    uploadedId?: string;
  }>;
}

// ─── vituixcad_measurements ───────────────────────────────────────────────────

/**
 * Stores the raw content of .frd and .zma measurement files.
 * These are tab-separated plaintext (not XML) — stored as text, not JSONB.
 */
export const vituixcadMeasurements = pgTable(
  'vituixcad_measurements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectFileId: uuid('project_file_id').notNull(), // FK → vituixcad_projects.id

    fileType: text('file_type', { enum: ['frd', 'zma'] }).notNull(),
    fileName: text('file_name').notNull(),
    rawContent: text('raw_content').notNull(),

    // Parsed summary for quick agent access (avoid re-parsing text in hot path)
    summary: jsonb('summary')
      .$type<FrdSummary | ZmaSummary>(),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    projectFileIdx: index('vxcad_measurement_project_idx').on(table.projectFileId),
  })
);

export interface FrdSummary {
  freqMin: number;     // Hz — lowest measured frequency
  freqMax: number;     // Hz — highest measured frequency
  splAtRef: number;    // dB — SPL at 1 kHz (or nearest point)
  pointCount: number;
}

export interface ZmaSummary {
  freqMin: number;
  freqMax: number;
  reAtDc: number;      // Ω — impedance at lowest measured freq (≈ Re)
  peakImpedance: number;  // Ω — resonance peak
  resonanceFreq: number;  // Hz — freq of peak impedance
  pointCount: number;
}
```

---

## 1.5 Parser Implementation

### 1.5.1 .vxp Parser

```typescript
// lib/vituixcad/parse-vxp.ts
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { VXP_PARSER_OPTIONS } from './parser-config';
import type { VxpProject, VxpMetadata, ReferencedFiles } from './types';

export class VxpParseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'VxpParseError';
  }
}

export function parseVxp(xml: string): {
  project: VxpProject;
  metadata: VxpMetadata;
  referencedFiles: ReferencedFiles;
} {
  // 1. Pre-validate before expensive parse
  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    throw new VxpParseError(`Invalid XML: ${valid.err.msg} (line ${valid.err.line})`);
  }

  // 2. Parse
  const parser = new XMLParser(VXP_PARSER_OPTIONS);
  const raw = parser.parse(xml);
  const speaker = raw?.SPEAKER;

  if (!speaker) {
    throw new VxpParseError('Root <SPEAKER> element not found — is this a .vxp file?');
  }

  // 3. Normalize: rename index attributes, ensure arrays
  const project = normalizeSpeaker(speaker) as VxpProject;

  // 4. Derive metadata (denormalized for fast DB queries)
  const metadata = deriveVxpMetadata(project);

  // 5. Extract external file references
  const referencedFiles = extractReferencedFiles(project);

  return { project, metadata, referencedFiles };
}

function normalizeSpeaker(raw: Record<string, unknown>): VxpProject {
  const drivers = (raw.DRIVER as Record<string, unknown>[]).map((d, idx) => ({
    ...d,
    _di: typeof d._di === 'number' ? d._di : idx,
    RESPONSE: ((d.RESPONSE as Record<string, unknown>[]) ?? []).map((r, ri) => ({
      ...r,
      _ri: typeof r._ri === 'number' ? r._ri : ri,
    })),
  }));

  const parts = (
    (raw.CROSSOVER as Record<string, unknown>)?.PART as Record<string, unknown>[]
  )?.map((p, idx) => ({
    ...p,
    _xi: typeof p._xi === 'number' ? p._xi : idx,
    PARAM: ((p.PARAM as Record<string, unknown>[]) ?? []).map((param, pi) => ({
      ...param,
      _pi: typeof param._pi === 'number' ? param._pi : pi,
    })),
    WIRE: ((p.WIRE as Record<string, unknown>[]) ?? []).map((w, wi) => ({
      ...w,
      _wi: typeof w._wi === 'number' ? w._wi : wi,
    })),
  }));

  return {
    ...raw,
    DRIVER: drivers,
    CROSSOVER: {
      ...(raw.CROSSOVER as Record<string, unknown>),
      PART: parts ?? [],
    },
  } as unknown as VxpProject;
}

function deriveVxpMetadata(project: VxpProject): VxpMetadata {
  const driverCount = project.DRIVER.length;

  // Topology: count driver-type parts in crossover — each one is a way
  const driverParts = project.CROSSOVER.PART.filter((p) => p.Type === 'Driver');
  const topologyMap: Record<number, VxpMetadata['crossoverTopology']> = {
    1: '1-way', 2: '2-way', 3: '3-way', 4: '4-way',
  };
  const crossoverTopology = topologyMap[driverParts.length] ?? 'unknown';

  // Count passive components
  const passiveTypes = new Set(['Capacitor', 'Inductor', 'Resistor']);
  const passiveComponentCount = project.CROSSOVER.PART.filter((p) =>
    passiveTypes.has(p.Type)
  ).length;

  return {
    driverCount,
    crossoverTopology,
    crossoverType: project.CROSSOVER.DSP,
    sampleRate: project.CROSSOVER.DSP === 'DSP' ? project.CROSSOVER.SampleRate : undefined,
    driverModels: project.DRIVER.map((d) => d.Model),
    partCount: project.CROSSOVER.PART.length,
    passiveComponentCount,
    axialTargetFreqRange: [project.AxialTarget.FreqMin, project.AxialTarget.FreqMax],
    halfSpace: project.HalfSpace === 1,
    frontWall: project.FrontWall === 1,
  };
}

function extractReferencedFiles(project: VxpProject): ReferencedFiles {
  const frd = project.DRIVER.flatMap((driver) =>
    driver.RESPONSE.map((r) => ({
      driverIndex: driver._di,
      responseIndex: r._ri,
      horizontalAngle: r.Hor,
      verticalAngle: r.Ver,
      relativePath: `${driver.ResponseDirectory}/${r.FileName}`,
    }))
  );

  const zma = project.DRIVER
    .filter((d) => d.ImpedanceFile)
    .map((d) => ({
      driverIndex: d._di,
      relativePath: d.ImpedanceFile,
    }));

  return { frd, zma };
}
```

### 1.5.2 .vxd Parser

```typescript
// lib/vituixcad/parse-vxd.ts
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { VXD_PARSER_OPTIONS } from './parser-config';
import type { VxdDriver, VxdDatabase, VxdMetadata } from './types';

export function parseVxd(xml: string): {
  drivers: VxdDriver[];
  metadata: VxdMetadata;
} {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    throw new Error(`Invalid VXD XML: ${valid.err.msg}`);
  }

  const parser = new XMLParser(VXD_PARSER_OPTIONS);
  const raw = parser.parse(xml) as { DRIVERS: VxdDatabase };
  const drivers = raw.DRIVERS?.DRIVER ?? [];

  const manufacturers = [...new Set(drivers.map((d) => d.Manufacturer))];
  const types = [...new Set(drivers.map((d) => d.Type))];
  const sizes = drivers.map((d) => d.Size);

  const metadata: VxdMetadata = {
    driverCount: drivers.length,
    manufacturers,
    types,
    sizeRange: [Math.min(...sizes), Math.max(...sizes)],
  };

  return { drivers, metadata };
}
```

### 1.5.3 .vxb Parser

```typescript
// lib/vituixcad/parse-vxb.ts
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { VXP_PARSER_OPTIONS } from './parser-config';
import type { VxbBaffle, VxbMetadata } from './types';

export function parseVxb(xml: string): {
  baffle: VxbBaffle;
  metadata: VxbMetadata;
} {
  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    throw new Error(`Invalid VXB XML: ${valid.err.msg}`);
  }

  const parser = new XMLParser({
    ...VXP_PARSER_OPTIONS,
    isArray: (tag) => ['CORNER', 'DRIVER'].includes(tag),
  });

  const raw = parser.parse(xml);
  const baffle = raw.BAFFLE as VxbBaffle;

  const metadata: VxbMetadata = {
    cornerCount: baffle.CORNER.length,
    driverMountCount: baffle.DRIVER.length,
    widthMm: baffle.Width,
    heightMm: baffle.Height,
    depthMm: baffle.Depth,
  };

  return { baffle, metadata };
}
```

---

## 1.6 Descriptive Text Generation for RAG

The `descriptionText` column stores a human-readable summary of the parsed data. This text is what gets embedded into pgvector — it needs to be information-dense, not UI copy.

### Design Principles

1. All numeric values include units in the text ("2.5 kHz", not "2500").
2. Component values appear as engineers write them ("4.7 uF", "0.68 mH", "8.2 Ω").
3. Topology and driver model names are stated explicitly — these are the terms users search with.
4. Adjectives are earned (don't write "excellent tweeter" — write the specs).
5. Each sentence answers a distinct question an agent might ask.

### Output Examples

**For a .vxp project:**
```
2-way passive analog crossover loudspeaker project.
Drivers: SB17NRX2C35-8 (woofer, index 0), SB21SDC-C000-4 (tweeter, index 1).
Crossover network: 14 components total — 3 capacitors, 4 inductors, 2 resistors, 5 other.
Axial target: 200 Hz – 20 kHz, 86 dB SPL, 0 dB/decade tilt.
Power target: 200 Hz – 20 kHz, 83 dB SPL, 0 dB/decade tilt.
Loading: 4π (full space). Baffle-step compensation: enabled.
Polar measurement grid: 37 responses per driver (horizontal 0°–180°, vertical 0°–90°).
Reference distance: 1.0 m. Reference angle: 0°.
```

**For a .vxd driver entry:**
```
SB Acoustics SB17NRX2C35-8 — active 6.5-inch woofer.
Thiele-Small: fs=36.0 Hz, Qts=0.36, Qes=0.43, Qms=2.72, Vas=21.6 L.
Voice coil: Re=3.3 Ω, Le=0.85 mH, BL=7.10 T·m.
Mechanical: Mms=15.5 g, Cms=1.20 mm/N, Rms=1.27 kg/s, Sd=133 cm².
Power handling: 150 W program, Xmax=7.5 mm one-way.
```

**For a .vxb baffle:**
```
Loudspeaker baffle: 180 mm × 400 mm, depth 280 mm.
Geometry: 8-corner polygon (chamfered top corners).
Driver mounts: 2 positions — 130 mm cutout at (90, 320), 75 mm cutout at (90, 80).
```

### Generator Implementation

```typescript
// lib/vituixcad/describe.ts
import type { VxpProject, VxdDriver, VxbBaffle, VxpMetadata } from './types';

export function describeVxp(project: VxpProject, metadata: VxpMetadata): string {
  const lines: string[] = [];

  // Line 1: topology summary
  const dspLabel = metadata.crossoverType === 'DSP'
    ? `DSP (${metadata.sampleRate?.toLocaleString()} Hz sample rate)`
    : 'passive analog';
  lines.push(
    `${metadata.crossoverTopology} ${dspLabel} crossover loudspeaker project.`
  );

  // Line 2: drivers
  const driverList = project.DRIVER.map(
    (d) => `${d.Model} (${describeDriverRole(d._di, metadata.driverCount)}, index ${d._di})`
  ).join(', ');
  lines.push(`Drivers: ${driverList}.`);

  // Line 3: crossover detail
  const passiveTypes = countPartTypes(project);
  const partDetail = Object.entries(passiveTypes)
    .map(([type, count]) => `${count} ${type.toLowerCase()}${count > 1 ? 's' : ''}`)
    .join(', ');
  lines.push(
    `Crossover network: ${metadata.partCount} components total — ${partDetail}.`
  );

  // Line 4: axial target
  const at = project.AxialTarget;
  lines.push(
    `Axial target: ${formatFreq(at.FreqMin)} – ${formatFreq(at.FreqMax)}, ` +
    `${at.SPL} dB SPL, ${at.Tilt >= 0 ? '+' : ''}${at.Tilt} dB/decade tilt.`
  );

  // Line 5: power target
  const pt = project.PowerTarget;
  lines.push(
    `Power target: ${formatFreq(pt.FreqMin)} – ${formatFreq(pt.FreqMax)}, ` +
    `${pt.SPL} dB SPL, ${pt.Tilt >= 0 ? '+' : ''}${pt.Tilt} dB/decade tilt.`
  );

  // Line 6: loading
  const loading = project.HalfSpace === 1 ? '2π (half space)' : '4π (full space)';
  const baffleStep = project.FrontWall === 1 ? 'enabled' : 'disabled';
  lines.push(`Loading: ${loading}. Baffle-step compensation: ${baffleStep}.`);

  // Line 7: measurement grid
  const totalResponses = project.DRIVER.reduce((sum, d) => sum + d.RESPONSE.length, 0);
  lines.push(
    `Polar measurement grid: ${totalResponses} total responses across ` +
    `${project.DRIVER.length} driver${project.DRIVER.length > 1 ? 's' : ''}.`
  );

  // Line 8: reference
  lines.push(
    `Reference distance: ${project.ReferDistance} m. ` +
    `Reference angle: ${project.ReferenceAngle}°.`
  );

  return lines.join('\n');
}

export function describeVxdDriver(driver: VxdDriver): string {
  const lines: string[] = [];

  lines.push(
    `${driver.Manufacturer} ${driver.Model} — ` +
    `${driver.Status.toLowerCase()} ${driver.Size}-inch ${driver.Type.toLowerCase()}.`
  );

  lines.push(
    `Thiele-Small: fs=${driver.fs} Hz, Qts=${driver.Qts}, ` +
    `Qes=${driver.Qes}, Qms=${driver.Qms}, Vas=${driver.Vas} L.`
  );

  lines.push(
    `Voice coil: Re=${driver.Re} Ω, Le=${driver.Le} mH, BL=${driver.BL} T·m.`
  );

  lines.push(
    `Mechanical: Mms=${driver.Mms} g, Cms=${driver.Cms} mm/N, ` +
    `Rms=${driver.Rms} kg/s, Sd=${driver.Sd} cm².`
  );

  lines.push(
    `Power handling: ${driver.Pmax} W program, Xmax=${driver.Xmax} mm one-way.`
  );

  return lines.join('\n');
}

export function describeVxbBaffle(baffle: VxbBaffle): string {
  const lines: string[] = [];

  const depth = baffle.Depth ? `, depth ${baffle.Depth} mm` : '';
  lines.push(
    `Loudspeaker baffle: ${baffle.Width} mm × ${baffle.Height} mm${depth}.`
  );

  lines.push(`Geometry: ${baffle.CORNER.length}-corner polygon.`);

  const mountDesc = baffle.DRIVER.map(
    (d) => `${d.Diameter} mm cutout at (${d.X}, ${d.Y})`
  ).join(', ');
  lines.push(
    `Driver mount${baffle.DRIVER.length > 1 ? 's' : ''}: ` +
    `${baffle.DRIVER.length} position${baffle.DRIVER.length > 1 ? 's' : ''} — ${mountDesc}.`
  );

  return lines.join('\n');
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFreq(hz: number): string {
  return hz >= 1000 ? `${hz / 1000} kHz` : `${hz} Hz`;
}

function describeDriverRole(index: number, total: number): string {
  if (total === 1) return 'fullrange';
  const roles = ['woofer', 'midrange', 'tweeter', 'super tweeter'];
  // Index 0 = lowest, last = highest — this is VituixCAD convention
  if (index === 0) return 'woofer';
  if (index === total - 1) return 'tweeter';
  return roles[Math.min(index, roles.length - 1)];
}

function countPartTypes(project: VxpProject): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const part of project.CROSSOVER.PART) {
    counts[part.Type] = (counts[part.Type] ?? 0) + 1;
  }
  return counts;
}
```

---

## 1.7 File Upload API

### Endpoint Design

```
POST /api/knowledge/vituixcad/upload
Content-Type: multipart/form-data

Fields:
  file         — the .vxp, .vxd, or .vxb file binary
  projectId    — UUID of the APEX project to attach to
  name         — optional display name (defaults to file stem)
```

```typescript
// app/api/knowledge/vituixcad/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { vituixcadProjects } from '@/db/schema/vituixcad';
import { parseVxp } from '@/lib/vituixcad/parse-vxp';
import { parseVxd } from '@/lib/vituixcad/parse-vxd';
import { parseVxb } from '@/lib/vituixcad/parse-vxb';
import { describeVxp, describeVxdDriver, describeVxbBaffle } from '@/lib/vituixcad/describe';
import { embedText } from '@/lib/embeddings';  // wraps AI SDK embed()
import { auth } from '@/lib/auth';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const EXTENSION_MAP = {
  vxp: 'vxp',
  vxd: 'vxd',
  vxb: 'vxb',
} as const;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file') as File | null;
  const projectId = form.get('projectId') as string | null;
  const displayName = form.get('name') as string | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 });
  }

  // Detect file type from extension
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const projectType = EXTENSION_MAP[ext as keyof typeof EXTENSION_MAP];
  if (!projectType) {
    return NextResponse.json(
      { error: `Unsupported file type: .${ext}. Expected .vxp, .vxd, or .vxb` },
      { status: 415 }
    );
  }

  const rawXml = await file.text();

  try {
    let parsedData: unknown;
    let metadata: unknown;
    let referencedFiles = { frd: [], zma: [] };
    let descriptionText: string;

    switch (projectType) {
      case 'vxp': {
        const result = parseVxp(rawXml);
        parsedData = result.project;
        metadata = result.metadata;
        referencedFiles = result.referencedFiles;
        descriptionText = describeVxp(result.project, result.metadata);
        break;
      }
      case 'vxd': {
        const result = parseVxd(rawXml);
        parsedData = result.drivers;
        metadata = result.metadata;
        // VXD: generate one description per driver, concatenated
        descriptionText = result.drivers
          .map(describeVxdDriver)
          .join('\n\n---\n\n');
        break;
      }
      case 'vxb': {
        const result = parseVxb(rawXml);
        parsedData = result.baffle;
        metadata = result.metadata;
        descriptionText = describeVxbBaffle(result.baffle);
        break;
      }
    }

    // Insert record
    const [record] = await db
      .insert(vituixcadProjects)
      .values({
        projectId,
        name: displayName ?? file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        projectType,
        rawXml,
        parsedData,
        metadata,
        descriptionText,
        referencedFiles,
      })
      .returning({ id: vituixcadProjects.id });

    // Embed description asynchronously — don't block response
    // (embedding pipeline picks up from DB polling or via queue)
    scheduleEmbedding(record.id, descriptionText);

    return NextResponse.json({ id: record.id, referencedFiles }, { status: 201 });
  } catch (err) {
    if (err instanceof Error && err.name === 'VxpParseError') {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error('[vituixcad/upload]', err);
    return NextResponse.json({ error: 'Parse failed' }, { status: 500 });
  }
}

// Decouple embedding from the upload response
async function scheduleEmbedding(recordId: string, text: string): Promise<void> {
  // Option A (immediate, synchronous): await embedText(text) then UPDATE
  // Option B (Vercel Queue): enqueue { recordId, text } to embedding queue
  // Option C (cron job): scan for records where embedding_vector IS NULL
  //
  // For MVP: use Option A in background (fire-and-forget with error logging)
  embedText(text)
    .then((vector) =>
      db.execute(
        `UPDATE vituixcad_projects SET embedding = $1::vector WHERE id = $2`,
        [JSON.stringify(vector), recordId]
      )
    )
    .catch((err) => console.error('[vituixcad/embed]', err));
}
```

### Response Contract

**201 Created:**
```json
{
  "id": "uuid",
  "referencedFiles": {
    "frd": [
      { "driverIndex": 0, "responseIndex": 0, "horizontalAngle": 0, "verticalAngle": 0, "relativePath": "SB17NRX/000.frd" }
    ],
    "zma": [
      { "driverIndex": 0, "relativePath": "SB17NRX.zma" }
    ]
  }
}
```

The client can inspect `referencedFiles` and prompt the user to upload the measurement files. This is non-blocking — the project record is immediately available; measurement files enhance it.

---

## 1.8 External File References: .frd and .zma

### Format Overview

`.frd` (Frequency Response Data) — tab-separated plaintext:
```
# SB17NRX2C35-8 0° horizontal
100	85.23
126	85.91
...
20000	72.40
```

`.zma` (Impedance vs. Frequency) — same format:
```
# SB17NRX2C35-8 impedance
10	6.12
20	7.88
...
20000	18.40
```

Neither file is XML. They are 2-column tab-separated: `frequency[Hz]  value[dB or Ω]`.

### Handling Strategy

**Problem:** `.vxp` files reference `.frd`/`.zma` by relative path on the original Windows filesystem. These paths are meaningless after upload.

**Solution — Two-phase upload:**

1. **Phase 1** — Upload `.vxp`. Response includes `referencedFiles` listing all referenced paths.
2. **Phase 2** — Client presents UI listing each referenced file. User uploads them individually. Each upload POSTs to:

```
POST /api/knowledge/vituixcad/{vxpRecordId}/measurements
Content-Type: multipart/form-data

Fields:
  file          — the .frd or .zma file
  relativePath  — the original path string from the .vxp (for matching)
```

The API matches `relativePath` against `referencedFiles` in the DB record, inserts into `vituixcad_measurements`, and writes back `uploadedId` to the `referencedFiles` JSONB array.

**Fallback:** If measurement files are never uploaded, the project still works. Agents use the nominal SPL and impedance from the `.vxp` `<DRIVER>` element. Measurement files enable polar analysis and impedance curve queries but are optional for crossover topology and TS parameter questions.

**VXD — no external references.** All Thiele-Small data is inline.

---

## 1.9 Round-Trip Readiness

The data model is designed so a future generator can reconstruct a `.vxp` from `parsedData` without accessing `rawXml`. Key design decisions that enable this:

### What `parsedData` preserves

1. **All numeric values** — no rounding, no unit conversion. VituixCAD's internal units are preserved exactly (Hz, Ω, dB, mH, uF, etc.).
2. **All index attributes** — `_di`, `_ri`, `_xi`, `_pi`, `_wi` are stored. The generator can reconstruct `di="0"` attribute syntax directly.
3. **Schematic coordinates** — `CenX`, `CenY`, `WIRE` points. These are opaque to the semantics layer but required to reconstruct a renderable schematic.
4. **PartID** — internal stable identifier. VituixCAD uses this for wire routing; losing it would break schematic connectivity.
5. **All optimizer bounds** — `Optimize`, `Min`, `Max` on each `VxpParam`. These encode design intent beyond the current value.
6. **Target curves** — `AxialTarget`, `PowerTarget` with tilt.

### What `rawXml` is for

`rawXml` is the lossless fallback. It exists for:
- Debugging parse/generate round-trips (diff raw vs. regenerated).
- Handling future VituixCAD format additions before the parser is updated.
- Disaster recovery if `parsedData` schema migration fails.

### Generator contract (future implementation)

```typescript
// lib/vituixcad/generate-vxp.ts (stub — Phase 2 scope)
export function generateVxp(project: VxpProject): string {
  // Must produce XML that VituixCAD can load without error.
  // Acceptance criteria:
  //   1. parseVxp(generateVxp(original)) deep-equals parseVxp(original)
  //   2. VituixCAD opens the file without showing "Invalid project" dialog
  //   3. All crossover component values match to 4 significant figures
  throw new Error('Not yet implemented — Phase 2 scope');
}
```

The round-trip test `parseVxp(generateVxp(parseVxp(xml).project)).project` is the correctness criterion. This test should be added to the test suite before Phase 2 implementation begins.

---

## 1.10 Migration

```sql
-- migrations/0010_vituixcad_schema.sql

CREATE TYPE vxcad_project_type AS ENUM ('vxp', 'vxd', 'vxb');
CREATE TYPE vxcad_crossover_topology AS ENUM ('1-way', '2-way', '3-way', '4-way', 'unknown');

CREATE TABLE vituixcad_projects (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL,
  name              TEXT NOT NULL,
  file_name         TEXT NOT NULL,
  project_type      vxcad_project_type NOT NULL,
  raw_xml           TEXT NOT NULL,
  parsed_data       JSONB NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}',
  description_text  TEXT,
  referenced_files  JSONB NOT NULL DEFAULT '[]',
  embedding         VECTOR(1536),   -- text-embedding-3-small dimensions
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX vituixcad_projects_project_id_idx ON vituixcad_projects (project_id);
CREATE INDEX vituixcad_projects_type_idx ON vituixcad_projects (project_type);
CREATE INDEX vituixcad_projects_active_idx
  ON vituixcad_projects (project_id, project_type)
  WHERE deleted_at IS NULL;
CREATE INDEX vituixcad_projects_embedding_idx
  ON vituixcad_projects USING hnsw (embedding vector_cosine_ops);

CREATE TABLE vituixcad_measurements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_file_id  UUID NOT NULL REFERENCES vituixcad_projects(id) ON DELETE CASCADE,
  file_type        TEXT NOT NULL CHECK (file_type IN ('frd', 'zma')),
  file_name        TEXT NOT NULL,
  raw_content      TEXT NOT NULL,
  summary          JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX vituixcad_measurements_project_idx
  ON vituixcad_measurements (project_file_id);
```

---

## 1.11 Integration Points for Specialist Agents

Once data is in the DB, agents query via the knowledge retrieval layer (pgvector RAG + structured SQL). This section documents the intended query patterns per agent so the schema design can be validated against real access patterns.

| Agent | Query Pattern | Data Source |
|-------|--------------|-------------|
| Crossover | "What passive components are in this project's crossover?" | `parsed_data->'CROSSOVER'->'PART'` filtered by Type |
| Crossover | "Find projects with a 2-way crossover around 2.5 kHz" | `metadata->>'crossoverTopology'` + semantic search on description |
| Acoustics | "What's the polar grid coverage?" | `parsed_data->'DRIVER'->0->'RESPONSE'` array length + angle range |
| Acoustics | "Find designs using SB17NRX in a sealed box" | Semantic search on `description_text` embedding |
| Theory | "What are the Thiele-Small parameters for SB17NRX2C35-8?" | Direct SQL on `vxd` record `parsed_data` |
| Mechanical | "What baffle dimensions does this project use?" | `vxb` record `parsed_data` or `metadata` |
| Research | "Show all projects using SB Acoustics drivers" | `metadata->'driverModels'` array containment |

**Compound queries** (e.g., "2-way designs with SB Acoustics tweeter where crossover is below 3 kHz") should use the `description_text` embedding as the primary filter and `metadata` JSON operators as a post-filter. Do not rely solely on embedding similarity for structured numeric constraints — it will miss edge cases.

---

## 1.12 Testing Strategy

```
lib/vituixcad/__tests__/
  parse-vxp.test.ts        — happy path + missing root + malformed XML
  parse-vxd.test.ts        — single driver + multi-driver + empty DB
  parse-vxb.test.ts        — minimal 3-corner + 36-corner max
  describe.test.ts         — snapshot tests on description output strings
  round-trip.test.ts       — parseVxp(generateVxp(p)) deep-equals p (Phase 2)

fixtures/
  minimal.vxp              — 1-way, 1 driver, 0 crossover parts
  twoWay-analog.vxp        — canonical 2-way passive (the reference file)
  twoWay-dsp.vxp           — DSP crossover with sample rate
  threeWay.vxp             — 3-way, 3 drivers, full polar grid
  singleDriver.vxd         — 1-driver VXD for isArray edge case
  multiDriver.vxd          — 50-driver VXD for performance
  simple.vxb               — 4-corner rectangular baffle, 1 driver mount
```

Key edge cases to test:
- Single-element arrays (the `isArray` override is critical — test it explicitly)
- `ImpedanceFile` empty string vs. absent (both appear in real files)
- `SampleRate` absent when `DSP === 'Analog'`
- Negative `Tilt` values in targets
- `ResponseDirectory` with Windows backslash paths (convert to forward slash on parse)

---

*End of Section 1. Next: Section 2 — Knowledge Pipeline & Embedding Architecture.*
