# Section 2: Technical Literature Ingestion Pipeline

**Spec:** APEX Speaker Design Intelligence — Knowledge Pipeline Extension
**Date:** 2026-03-28
**Status:** Ready for implementation
**Depends on:** Section 1 (existing knowledge_chunks schema, pgvector, embedder, upsert modules)

---

## 2.0 Overview

The existing APEX pipeline ingests 23 ChatGPT conversation exports as markdown files.
This section adds a second knowledge tier: technical literature — textbooks, AES papers, and
driver datasheets. These sources are structurally different from conversations: they have
hierarchical headings, equations, figures, tables, page numbers, and author attribution.

The pipeline must handle two distinct document families:

| Family | Examples | Tool | Chunking |
|--------|----------|------|----------|
| Long-form textbooks and papers | Hill (391 pp), Iversen/DTU (19 pp), AES papers | Marker | Section-boundary splits (H1/H2), 500–1500 token target |
| Short structured datasheets | Scan-Speak, SB Acoustics, Seas | Docling | Whole-document or single-section splits, table-aware |

Both output knowledge_chunks rows with `source_type` = `'book_chapter'` or `'research_paper'`
or `'datasheet'`. The existing `getRAGContext` function retrieves them transparently — no
agent-side changes required.

---

## 2.1 Directory Structure

All literature lives under `knowledge/` at the repo root (parallel to the existing
`speaker-building-knowledge/` conversation exports directory):

```
knowledge/
├── conversations/          # symlink or copy of speaker-building-knowledge/ (optional consolidation)
├── literature/
│   ├── textbooks/
│   │   ├── hill-loudspeaker-modelling.pdf
│   │   └── iversen-dtu-intro.pdf
│   ├── papers/
│   │   ├── aes-2024-vented-box.pdf
│   │   └── ...
│   └── datasheets/
│       ├── scanspeak-18w8545.pdf
│       ├── sbacoustics-sb17nrx.pdf
│       └── ...
└── processed/              # Marker/Docling markdown output — committed to git
    ├── textbooks/
    │   ├── hill-loudspeaker-modelling.md
    │   └── iversen-dtu-intro.md
    ├── papers/
    └── datasheets/
```

The `knowledge/processed/` directory is committed to the repository. Processing a PDF with
Marker takes 2–5 minutes for a textbook; caching the output avoids re-running on every
ingest. The ingest script checks whether a `.md` counterpart already exists before invoking
Marker, making the pipeline idempotent.

Add to `web/.gitignore`:
```
# Keep processed/ committed — do not ignore
```

Add to root `.gitignore`:
```
# Large PDFs — store locally, do not commit
knowledge/literature/**/*.pdf
knowledge/literature/**/*.PDF
```

---

## 2.2 PDF Extraction Tools

### 2.2.1 Marker (textbooks and papers)

Marker is a Python CLI tool optimized for academic documents. It recovers:
- Heading hierarchy (H1–H6) using font-size and layout heuristics
- LaTeX equations rendered as `$$...$$` or inline `$...$`
- Figure captions as italicized paragraphs
- Code blocks and tables (basic)

**Install (once, in a Python venv or globally):**
```bash
pip install marker-pdf
```

**Invocation pattern (from the ingest script via Node.js `child_process`):**
```bash
marker_single \
  --output_dir knowledge/processed/textbooks/ \
  --output_format markdown \
  --use_llm \
  knowledge/literature/textbooks/hill-loudspeaker-modelling.pdf
```

Flags:
- `--use_llm` — enables LLM-assisted heading disambiguation and equation cleanup; adds ~30% quality improvement for dense technical text; requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in environment
- `--output_format markdown` — emit a single `.md` file per PDF
- `--output_dir` — destination directory; Marker creates `<basename>/` subdirectory with `<basename>.md` inside

Marker's output file path: `knowledge/processed/textbooks/hill-loudspeaker-modelling/hill-loudspeaker-modelling.md`

The ingest script resolves to this path using the basename pattern.

### 2.2.2 Docling (datasheets)

Docling excels at multi-column layouts and embedded tables — the dominant structure in
driver datasheets.

**Install:**
```bash
pip install docling
```

**Invocation:**
```bash
docling \
  --output knowledge/processed/datasheets/ \
  --to md \
  knowledge/literature/datasheets/scanspeak-18w8545.pdf
```

Docling outputs a flat markdown file. For datasheets, the entire document rarely exceeds
2000 tokens, so it is ingested as one or two chunks rather than section-split.

### 2.2.3 Node.js subprocess wrapper

The ingest script calls these tools via Node.js `child_process.execSync`:

```typescript
// web/lib/knowledge/extract-pdf.ts

import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

export type DocumentFamily = "textbook" | "paper" | "datasheet";

export interface ExtractionResult {
  markdownPath: string;   // absolute path to output .md file
  tool: "marker" | "docling";
  cached: boolean;        // true if .md already existed, extraction skipped
}

export function extractPdf(
  pdfPath: string,
  family: DocumentFamily,
  outputDir: string
): ExtractionResult {
  const basename = path.basename(pdfPath, path.extname(pdfPath));
  const tool = family === "datasheet" ? "docling" : "marker";

  // Marker nests output: outputDir/<basename>/<basename>.md
  // Docling writes flat: outputDir/<basename>.md
  const markdownPath =
    tool === "marker"
      ? path.join(outputDir, basename, `${basename}.md`)
      : path.join(outputDir, `${basename}.md`);

  if (fs.existsSync(markdownPath)) {
    return { markdownPath, tool, cached: true };
  }

  if (tool === "marker") {
    execSync(
      `marker_single --output_dir "${outputDir}" --output_format markdown --use_llm "${pdfPath}"`,
      { stdio: "inherit", timeout: 600_000 } // 10 min max for 400-page book
    );
  } else {
    execSync(
      `docling --output "${outputDir}" --to md "${pdfPath}"`,
      { stdio: "inherit", timeout: 120_000 }
    );
  }

  if (!fs.existsSync(markdownPath)) {
    throw new Error(`Extraction produced no output at expected path: ${markdownPath}`);
  }

  return { markdownPath, tool, cached: false };
}
```

**Error handling notes:**
- If `marker_single` or `docling` is not on PATH, `execSync` throws with ENOENT. The ingest
  script catches this and prints a clear installation message.
- Timeout of 10 minutes covers the Hill textbook (391 pages, `--use_llm` adds LLM calls per
  page). For larger documents, increase or switch to `execSync` with `{ timeout: 0 }` and
  rely on process-level timeout.
- On CI/CD (Vercel build), PDF extraction is skipped — the `knowledge/processed/` markdown
  files are committed and the ingest script reads from them directly.

---

## 2.3 TOC Generation

After extraction, the pipeline parses Marker's markdown to build a structured Table of
Contents. This TOC serves two purposes:
1. Drives the section-boundary splitting strategy (step 2.4)
2. Is stored in `literature_sources.toc` JSONB for display in the APEX knowledge explorer UI

### 2.3.1 TOC data structure

```typescript
// web/lib/knowledge/toc.ts

export interface TocEntry {
  level: number;           // 1–6, corresponding to H1–H6
  heading: string;         // raw heading text, stripped of markdown `#` prefix
  lineNumber: number;      // line index in the markdown file (0-based)
  charOffset: number;      // character offset from file start
  pageHint?: number;       // extracted from Marker's page annotations if present
  path: string[];          // full ancestor path including self, e.g. ["Part III", "Chapter 12", "Crossover Design"]
}

export interface Toc {
  entries: TocEntry[];
  maxLevel: number;        // deepest heading level found
  totalHeadings: number;
}
```

### 2.3.2 TOC extraction algorithm

```typescript
export function extractToc(markdown: string): Toc {
  const lines = markdown.split("\n");
  const entries: TocEntry[] = [];
  const ancestorStack: string[] = []; // tracks current path context

  let charOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^(#{1,6})\s+(.+)$/);

    if (match) {
      const level = match[1].length;
      const heading = match[2].trim();

      // Maintain ancestor stack: truncate to current depth, then push
      // e.g. if we see H2 after H3 H3 H2 stack, pop back to H1 level
      while (ancestorStack.length >= level) {
        ancestorStack.pop();
      }
      ancestorStack.push(heading);

      entries.push({
        level,
        heading,
        lineNumber: i,
        charOffset,
        path: [...ancestorStack],
      });
    }

    charOffset += line.length + 1; // +1 for the newline
  }

  return {
    entries,
    maxLevel: entries.length > 0 ? Math.max(...entries.map((e) => e.level)) : 0,
    totalHeadings: entries.length,
  };
}
```

**Hill textbook expected output** (abridged):
```json
{
  "entries": [
    { "level": 1, "heading": "Part I: Fundamentals", "path": ["Part I: Fundamentals"], "lineNumber": 12 },
    { "level": 2, "heading": "Chapter 1: Introduction to Loudspeaker Systems", "path": ["Part I: Fundamentals", "Chapter 1: Introduction to Loudspeaker Systems"], "lineNumber": 28 },
    { "level": 3, "heading": "1.1 Electromechanical Transduction", "path": ["Part I: Fundamentals", "Chapter 1: ...", "1.1 Electromechanical Transduction"], "lineNumber": 45 },
    ...
  ],
  "maxLevel": 4,
  "totalHeadings": 187
}
```

---

## 2.4 Section Splitting Strategy

### 2.4.1 Textbooks and papers (Marker output)

Split at **H2 boundaries** as the primary split point. H2 typically corresponds to chapter
sections (e.g., "12.3 Butterworth Alignment") — granular enough for precise RAG retrieval
but large enough to contain complete technical reasoning.

Fallback rule: if a section exceeds **6000 characters** (~1500 tokens), split further at H3
boundaries within that section. If still oversized, apply a sliding window with 200-character
overlap.

Target chunk size: **500–1500 tokens** (2000–6000 chars at ~4 chars/token average).
Minimum chunk size: **100 tokens** (400 chars) — sections shorter than this are merged with
the next sibling.

```typescript
// web/lib/knowledge/chunk-literature.ts

import type { TocEntry, Toc } from "./toc";

export interface LiteratureChunk {
  content: string;
  chunkIndex: number;
  title: string;            // e.g. "Hill §12.3 — Butterworth Alignment"
  headingPath: string[];    // full ancestor path from TOC
  level: number;            // heading level of the section boundary
  pageHint?: number;
  charStart: number;
  charEnd: number;
}

const MAX_CHARS = 6000;     // ~1500 tokens — hard ceiling
const MIN_CHARS = 400;      // ~100 tokens — merge if below this
const OVERLAP_CHARS = 200;  // overlap between oversized sub-splits

export function chunkLiterature(
  markdown: string,
  toc: Toc,
  bookTitle: string,
  splitLevel = 2          // H2 = chapter sections; H3 for papers
): LiteratureChunk[] {
  const splitEntries = toc.entries.filter((e) => e.level <= splitLevel);

  if (splitEntries.length === 0) {
    // No headings found — treat whole document as single chunk (datasheets, short papers)
    return [{
      content: markdown.trim(),
      chunkIndex: 0,
      title: bookTitle,
      headingPath: [bookTitle],
      level: 0,
      charStart: 0,
      charEnd: markdown.length,
    }];
  }

  const chunks: LiteratureChunk[] = [];
  let chunkIndex = 0;

  for (let i = 0; i < splitEntries.length; i++) {
    const entry = splitEntries[i];
    const nextEntry = splitEntries[i + 1];

    const start = entry.charOffset;
    const end = nextEntry ? nextEntry.charOffset : markdown.length;
    const rawSection = markdown.slice(start, end).trim();

    if (rawSection.length < MIN_CHARS && chunks.length > 0) {
      // Merge into previous chunk rather than creating a tiny orphan
      chunks[chunks.length - 1].content += "\n\n" + rawSection;
      chunks[chunks.length - 1].charEnd = end;
      continue;
    }

    const sectionLabel = entry.path.join(" > ");
    const chunkTitle = `${bookTitle} — ${sectionLabel}`;

    if (rawSection.length <= MAX_CHARS) {
      chunks.push({
        content: rawSection,
        chunkIndex: chunkIndex++,
        title: chunkTitle,
        headingPath: entry.path,
        level: entry.level,
        charStart: start,
        charEnd: end,
      });
    } else {
      // Oversized: sub-split at H3 or sliding window
      const subChunks = splitOversized(rawSection, chunkTitle, entry.path, chunkIndex);
      chunks.push(...subChunks);
      chunkIndex += subChunks.length;
    }
  }

  return chunks;
}

function splitOversized(
  text: string,
  title: string,
  headingPath: string[],
  startIndex: number
): LiteratureChunk[] {
  // Try H3 splits first
  const h3Splits = text.split(/\n(?=### )/);
  if (h3Splits.length > 1 && h3Splits.every((s) => s.length <= MAX_CHARS)) {
    return h3Splits.map((section, i) => ({
      content: section.trim(),
      chunkIndex: startIndex + i,
      title: `${title} [${i + 1}]`,
      headingPath,
      level: 3,
      charStart: 0,
      charEnd: section.length,
    }));
  }

  // Sliding window fallback
  const result: LiteratureChunk[] = [];
  let pos = 0;
  let subIdx = 0;
  while (pos < text.length) {
    const slice = text.slice(pos, pos + MAX_CHARS);
    result.push({
      content: slice.trim(),
      chunkIndex: startIndex + subIdx++,
      title: `${title} [${subIdx}]`,
      headingPath,
      level: 3,
      charStart: pos,
      charEnd: pos + slice.length,
    });
    pos += MAX_CHARS - OVERLAP_CHARS;
  }
  return result;
}
```

### 2.4.2 Datasheets (Docling output)

Datasheets are short (typically 2–8 pages). Split strategy:

1. If the entire document is under MAX_CHARS (6000 chars): one chunk, no splitting.
2. If between 6000–18000 chars: split at H1/H2 boundaries only (product specs, mechanical
   drawing section, electrical parameters section, frequency response section).
3. If over 18000 chars (multi-product catalog): treat each product's section as a document
   and run the standard literature chunker with `splitLevel = 1`.

For datasheets, the `title` field in each chunk includes the manufacturer and part number
extracted from the document filename (e.g., `"Scan-Speak 18W/8545 — Electrical Parameters"`).

---

## 2.5 Chunk Metadata

Each `knowledge_chunks` row for literature carries rich metadata in the existing `metadata`
JSONB column. This extends the existing schema without a migration — no new columns on
`knowledge_chunks` required.

```typescript
// Metadata shape for literature chunks
interface LiteratureChunkMetadata {
  // Source attribution
  literatureSourceId: string;    // FK to literature_sources.id
  bookTitle: string;             // "Loudspeaker Modelling and Design"
  authors: string[];             // ["Geoff Hill"]
  publicationYear?: number;      // 2021
  publisher?: string;            // "Springer"
  isbn?: string;

  // Navigation
  headingPath: string[];         // ["Part III", "Chapter 12", "12.3 Butterworth Alignment"]
  headingLevel: number;          // 2
  chunkIndex: number;            // position within this source
  totalChunks: number;           // total chunks from this source

  // Page estimation (Marker provides approximate page markers in output)
  pageStart?: number;
  pageEnd?: number;

  // Processing provenance
  extractionTool: "marker" | "docling";
  extractedAt: string;           // ISO timestamp
  markerVersion?: string;        // e.g. "0.3.5" — for cache invalidation
}
```

The `title` column on `knowledge_chunks` stores the human-readable section label:
`"Loudspeaker Modelling and Design — Part III > Chapter 12 > 12.3 Butterworth Alignment"`

This title surfaces in the `formatRAGContext` function, so agents see precise citations in
their context window.

The `tags` column stores an array combining domain tags and source type:
```typescript
tags: [agentDomain, "book_chapter", "hill", "crossover"]
// or for a paper:
tags: [agentDomain, "research_paper", "aes", "vented_box"]
// or for a datasheet:
tags: [agentDomain, "datasheet", "scan-speak", "woofer"]
```

---

## 2.6 Database Schema Changes

### 2.6.1 New table: `literature_sources`

This table is the authoritative registry for all literature documents, storing full
bibliographic metadata and the extracted TOC as JSONB. It is separate from the existing
`sources` table (which tracks ChatGPT conversations and NotebookLM notebooks) to avoid
retrofitting bibliographic columns into a generic table.

```typescript
// Addition to web/lib/db/schema.ts

import { pgTable, text, varchar, timestamp, uuid, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import type { TocEntry } from "../knowledge/toc";

// Extend source_type enum — requires a migration
// New values: already present in schema: 'book_chapter', 'research_paper', 'datasheet'
// No enum change needed — these are already defined in sourceTypeEnum

export interface LiteratureSourceMetadata {
  isbn?: string;
  publisher?: string;
  publicationYear?: number;
  doi?: string;             // for AES papers
  conference?: string;      // e.g. "AES 155th Convention"
  extractionTool: "marker" | "docling";
  markerVersion?: string;
  pdfSha256?: string;       // for cache invalidation when PDF changes
}

export const literatureSources = pgTable("literature_sources", {
  id:           uuid("id").primaryKey().defaultRandom(),

  // Bibliographic identity
  title:        varchar("title", { length: 512 }).notNull(),
  authors:      jsonb("authors").$type<string[]>().default([]),
  sourceType:   sourceTypeEnum("source_type").notNull(),  // 'book_chapter' | 'research_paper' | 'datasheet'
  family:       varchar("family", { length: 32 }).notNull(), // 'textbook' | 'paper' | 'datasheet'

  // File locations
  pdfPath:      text("pdf_path"),           // absolute path on developer machine; null on CI
  markdownPath: text("markdown_path").notNull(), // knowledge/processed/... — committed to git

  // Extracted structure
  toc:          jsonb("toc").$type<{ entries: TocEntry[] }>(),
  totalPages:   integer("total_pages"),
  totalChunks:  integer("total_chunks").default(0),

  // Processing state
  isIngested:   boolean("is_ingested").default(false),
  processedAt:  timestamp("processed_at"),  // when markdown was extracted
  ingestedAt:   timestamp("ingested_at"),   // when chunks were written to knowledge_chunks

  // Arbitrary extra fields (ISBN, DOI, conference, extraction tool version)
  metadata:     jsonb("metadata").$type<LiteratureSourceMetadata>().default({} as LiteratureSourceMetadata),

  createdAt:    timestamp("created_at").defaultNow().notNull(),
});
```

**Migration note:** `literature_sources` is a new table — `drizzle-kit generate` will
produce a clean `CREATE TABLE` migration with no risk to existing data.

The `sourceTypeEnum` already includes `'book_chapter'`, `'research_paper'`, and `'datasheet'`
in the current schema — no enum migration is required.

### 2.6.2 Schema relationship diagram

```
literature_sources (1)
      │
      │  metadata.literatureSourceId
      ▼
knowledge_chunks (many)
      │
      │  agentDomain, status, embedding
      ▼
  pgvector RAG search
```

The `knowledge_chunks` table does NOT add a hard FK to `literature_sources` — the link is
stored in `metadata` JSONB. This avoids a schema migration on the existing table and keeps
the chunk table generic across all source types. A JOIN query is still possible via
`metadata->>'literatureSourceId'`.

---

## 2.7 Ingest Script Design

### 2.7.1 Script location and invocation

```
web/scripts/ingest-literature.ts
```

Add to `web/package.json`:
```json
{
  "scripts": {
    "ingest:literature": "tsx scripts/ingest-literature.ts",
    "ingest:literature:force": "tsx scripts/ingest-literature.ts --force-reextract"
  }
}
```

`--force-reextract` bypasses the markdown cache and re-runs Marker/Docling on all PDFs.
Use this when upgrading Marker versions or when a PDF has been updated.

### 2.7.2 Manifest file: `knowledge/literature/manifest.json`

Rather than hardcoding book metadata in the script, a manifest file declares all known
literature sources. This is the single place to register a new document:

```json
[
  {
    "id": "hill-loudspeaker-modelling",
    "title": "Loudspeaker Modelling and Design",
    "authors": ["Geoff Hill"],
    "family": "textbook",
    "sourceType": "book_chapter",
    "pdfPath": "knowledge/literature/textbooks/hill-loudspeaker-modelling.pdf",
    "markdownPath": "knowledge/processed/textbooks/hill-loudspeaker-modelling/hill-loudspeaker-modelling.md",
    "totalPages": 391,
    "splitLevel": 2,
    "agentDomains": ["theory", "acoustics", "enclosure", "crossover"],
    "tags": ["hill", "textbook", "thiele-small", "crossover", "enclosure"],
    "metadata": {
      "publisher": "Springer",
      "publicationYear": 2021,
      "extractionTool": "marker"
    }
  },
  {
    "id": "iversen-dtu-intro",
    "title": "Introduction to Loudspeaker Modelling & Design",
    "authors": ["Knud Iversen"],
    "family": "paper",
    "sourceType": "research_paper",
    "pdfPath": "knowledge/literature/textbooks/iversen-dtu-intro.pdf",
    "markdownPath": "knowledge/processed/textbooks/iversen-dtu-intro/iversen-dtu-intro.md",
    "totalPages": 19,
    "splitLevel": 2,
    "agentDomains": ["theory", "acoustics"],
    "tags": ["iversen", "dtu", "tutorial", "thiele-small"],
    "metadata": {
      "conference": "DTU Technical University of Denmark",
      "extractionTool": "marker"
    }
  },
  {
    "id": "scanspeak-18w8545",
    "title": "Scan-Speak 18W/8545 Datasheet",
    "authors": ["Scan-Speak"],
    "family": "datasheet",
    "sourceType": "datasheet",
    "pdfPath": "knowledge/literature/datasheets/scanspeak-18w8545.pdf",
    "markdownPath": "knowledge/processed/datasheets/scanspeak-18w8545.md",
    "totalPages": 2,
    "splitLevel": 1,
    "agentDomains": ["acoustics", "mechanical"],
    "tags": ["scan-speak", "woofer", "18w8545", "datasheet"],
    "metadata": {
      "extractionTool": "docling"
    }
  }
]
```

### 2.7.3 Script pseudocode

```typescript
// web/scripts/ingest-literature.ts

import * as fs from "fs";
import * as path from "path";
import { config } from "dotenv";
config({ path: path.resolve(__dirname, "../.env.local") });

import { extractPdf } from "../lib/knowledge/extract-pdf";
import { extractToc } from "../lib/knowledge/toc";
import { chunkLiterature } from "../lib/knowledge/chunk-literature";
import { embedChunks } from "../lib/knowledge/embedder";
import { upsertLiteratureChunks } from "../lib/knowledge/upsert-literature";
import { db } from "../lib/db";
import { literatureSources } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const MANIFEST_PATH = path.resolve(__dirname, "../../knowledge/literature/manifest.json");
const forceReextract = process.argv.includes("--force-reextract");

interface ManifestEntry {
  id: string;
  title: string;
  authors: string[];
  family: "textbook" | "paper" | "datasheet";
  sourceType: "book_chapter" | "research_paper" | "datasheet";
  pdfPath: string;
  markdownPath: string;
  totalPages?: number;
  splitLevel: number;
  agentDomains: string[];
  tags: string[];
  metadata: Record<string, unknown>;
}

async function main() {
  // Guard: DATABASE_URL required
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set in .env.local");
    process.exit(1);
  }

  const manifest: ManifestEntry[] = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf-8"));
  console.log(`\nAPEX Literature Ingestion Pipeline`);
  console.log(`   ${manifest.length} documents in manifest\n`);

  let totalChunks = 0;
  const errors: string[] = [];

  for (const entry of manifest) {
    console.log(`[${entry.id}] ${entry.title}`);

    try {
      // Step 1: Extract PDF → markdown (skips if cached, unless --force-reextract)
      const absMarkdownPath = path.resolve(__dirname, "../..", entry.markdownPath);
      const absPdfPath = entry.pdfPath
        ? path.resolve(__dirname, "../..", entry.pdfPath)
        : null;

      let markdownPath = absMarkdownPath;

      if (!fs.existsSync(absMarkdownPath) || forceReextract) {
        if (!absPdfPath || !fs.existsSync(absPdfPath)) {
          console.warn(`  SKIP — no PDF at ${entry.pdfPath} and no cached markdown`);
          continue;
        }
        const outputDir = path.dirname(absMarkdownPath);
        fs.mkdirSync(outputDir, { recursive: true });
        const result = extractPdf(absPdfPath, entry.family, path.dirname(absMarkdownPath));
        markdownPath = result.markdownPath;
        console.log(`  extracted via ${result.tool}`);
      } else {
        console.log(`  using cached markdown`);
      }

      // Step 2: Parse markdown
      const markdown = fs.readFileSync(markdownPath, "utf-8");

      // Step 3: Extract TOC
      const toc = extractToc(markdown);
      console.log(`  toc: ${toc.totalHeadings} headings, max depth H${toc.maxLevel}`);

      // Step 4: Chunk by section boundaries
      const chunks = chunkLiterature(markdown, toc, entry.title, entry.splitLevel);
      console.log(`  chunks: ${chunks.length}`);

      // Step 5: Embed all chunks
      const texts = chunks.map((c) => c.content);
      const embeddings = await embedChunks(texts);

      // Step 6: Upsert literature_sources record + knowledge_chunks
      await upsertLiteratureChunks({
        entry,
        toc,
        chunks,
        embeddings,
        markdownPath,
      });

      totalChunks += chunks.length;
      console.log(`  done (${chunks.length} chunks ingested)\n`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  FAILED: ${msg}\n`);
      errors.push(`${entry.id}: ${msg}`);
    }
  }

  console.log(`${"=".repeat(60)}`);
  console.log(`Ingestion complete`);
  console.log(`Total chunks: ${totalChunks}`);
  if (errors.length > 0) {
    console.log(`Errors (${errors.length}):`);
    errors.forEach((e) => console.log(`  - ${e}`));
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

### 2.7.4 Upsert function: `upsertLiteratureChunks`

```typescript
// web/lib/knowledge/upsert-literature.ts

import { db } from "../db";
import { knowledgeChunks, literatureSources } from "../db/schema";
import { eq, and } from "drizzle-orm";
import type { LiteratureChunk } from "./chunk-literature";
import type { Toc } from "./toc";

export async function upsertLiteratureChunks(opts: {
  entry: ManifestEntry;
  toc: Toc;
  chunks: LiteratureChunk[];
  embeddings: number[][];
  markdownPath: string;
}): Promise<void> {
  const { entry, toc, chunks, embeddings, markdownPath } = opts;

  // 1. Upsert literature_sources record
  const existing = await db
    .select()
    .from(literatureSources)
    .where(eq(literatureSources.markdownPath, markdownPath));

  let sourceId: string;

  if (existing.length > 0) {
    sourceId = existing[0].id;
    await db.update(literatureSources)
      .set({
        toc: toc,
        totalChunks: chunks.length,
        isIngested: true,
        ingestedAt: new Date(),
      })
      .where(eq(literatureSources.id, sourceId));
  } else {
    const inserted = await db.insert(literatureSources)
      .values({
        title: entry.title,
        authors: entry.authors,
        sourceType: entry.sourceType,
        family: entry.family,
        pdfPath: entry.pdfPath ?? null,
        markdownPath,
        toc,
        totalPages: entry.totalPages ?? null,
        totalChunks: chunks.length,
        isIngested: true,
        processedAt: new Date(),
        ingestedAt: new Date(),
        metadata: entry.metadata,
      })
      .returning();
    sourceId = inserted[0].id;
  }

  // 2. Delete existing chunks for this source (idempotent re-ingest)
  await db.delete(knowledgeChunks)
    .where(eq(knowledgeChunks.sourcePath, markdownPath));

  // 3. Insert all chunks
  // Use first agentDomain from manifest as primary domain
  // Future: multi-domain fan-out (one chunk per domain) can be added
  const primaryDomain = entry.agentDomains[0] as AgentDomain;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = embeddings[i];

    const chunkMetadata: LiteratureChunkMetadata = {
      literatureSourceId: sourceId,
      bookTitle: entry.title,
      authors: entry.authors,
      headingPath: chunk.headingPath,
      headingLevel: chunk.level,
      chunkIndex: chunk.chunkIndex,
      totalChunks: chunks.length,
      pageStart: chunk.pageHint,
      extractionTool: entry.metadata.extractionTool as "marker" | "docling",
      extractedAt: new Date().toISOString(),
    };

    await db.insert(knowledgeChunks).values({
      sourceType: entry.sourceType,
      agentDomain: primaryDomain,
      title: chunk.title,
      content: chunk.content,
      tags: [...entry.tags, entry.sourceType, primaryDomain],
      confidence: 0.9,   // literature gets higher confidence than conversation exports
      status: "canonical",
      embedding,
      sourcePath: markdownPath,
      chunkIndex: chunk.chunkIndex,
      metadata: chunkMetadata,
    });
  }
}
```

---

## 2.8 Datasheet Handling: Differences from Textbooks

Datasheets require a distinct approach at every stage:

| Concern | Textbook | Datasheet |
|---------|----------|-----------|
| Extraction tool | Marker (`--use_llm`) | Docling (table-aware) |
| Split level | H2 (chapter section) | H1 or none |
| Chunk count | 50–300 per book | 1–5 per datasheet |
| Primary value | Conceptual explanation, equations | T/S parameters, frequency response specs |
| `agentDomains` | `theory`, `acoustics`, `crossover`, `enclosure` | `acoustics`, `mechanical` |
| Confidence | 0.9 | 0.95 (manufacturer data is authoritative) |
| `title` field | "Hill — Part III > Ch.12 > Butterworth" | "Scan-Speak 18W/8545 — Electrical Parameters" |

For datasheets, the chunk content should preserve Docling's markdown tables verbatim. RAG
retrieval of a datasheet chunk gives the agent exact T/S parameters (Fs, Qts, Vas, Xmax,
etc.) in structured form, which is more useful than prose paraphrase.

Example datasheet chunk content:
```markdown
## Scan-Speak 18W/8545-00 — Electrical Parameters

| Parameter | Symbol | Value | Unit |
|-----------|--------|-------|------|
| Resonance frequency | Fs | 28 | Hz |
| DC resistance | Re | 5.6 | Ω |
| Voice coil inductance | Le | 0.67 | mH |
| Mechanical Q factor | Qms | 3.84 | — |
| Electrical Q factor | Qes | 0.36 | — |
| Total Q factor | Qts | 0.33 | — |
| Equivalent volume | Vas | 74 | L |
| Max linear excursion | Xmax | 8.5 | mm |
| Sensitivity (2.83V/1m) | SPL | 89 | dB |
| Nominal impedance | Zn | 8 | Ω |
```

---

## 2.9 Agent Access Patterns

### 2.9.1 Transparent RAG retrieval

No changes are required to `getRAGContext` in `web/lib/agents/rag-context.ts`. Literature
chunks are stored in the same `knowledge_chunks` table with the same embedding dimensions
(1536 via `text-embedding-3-small`) and the same `status = 'canonical'` filter. The
pgvector HNSW index covers all rows regardless of `source_type`.

The only behavioral difference: a literature chunk's `title` now contains a heading path,
and `sourceUrl` is null (replaced by the heading path in `metadata`). The existing
`formatRAGContext` function handles null `sourceUrl` gracefully.

### 2.9.2 Source-type filtering (optional, additive)

Agents can optionally request literature-only context by adding a `source_type` filter.
The recommended pattern is to add an optional `sourceTypes` parameter to `getRAGContext`:

```typescript
// Proposed extension to web/lib/agents/rag-context.ts

export async function getRAGContext(
  query: string,
  domain: AgentDomain,
  limit = 4,
  options?: {
    sourceTypes?: Array<"chatgpt_conversation" | "book_chapter" | "research_paper" | "datasheet">;
    minConfidence?: number;
  }
): Promise<KnowledgeContext[]> {
  const { embedding } = await embed({ model: EMBEDDING_MODEL, value: query });
  const embeddingStr = `[${embedding.join(",")}]`;

  const conditions = [
    eq(knowledgeChunks.status, "canonical"),
    eq(knowledgeChunks.agentDomain, domain),
  ];

  if (options?.sourceTypes && options.sourceTypes.length > 0) {
    conditions.push(inArray(knowledgeChunks.sourceType, options.sourceTypes));
  }

  if (options?.minConfidence !== undefined) {
    conditions.push(gte(knowledgeChunks.confidence, options.minConfidence));
  }

  const results = await db
    .select({ ... })
    .from(knowledgeChunks)
    .where(and(...conditions))
    .orderBy(sql`${knowledgeChunks.embedding} <=> ${embeddingStr}::vector`)
    .limit(limit);

  return results.map(...);
}
```

Usage in agent system prompt context assembly:
```typescript
// Fetch mixed context (conversations + literature)
const context = await getRAGContext(userQuery, "crossover", 6);

// Or fetch literature-only for authoritative lookup (e.g., "what is the Butterworth Q?")
const litContext = await getRAGContext(userQuery, "crossover", 4, {
  sourceTypes: ["book_chapter", "research_paper"],
  minConfidence: 0.85,
});
```

### 2.9.3 Citation formatting

When a literature chunk appears in context, agents should cite it with heading path rather
than URL. Update `formatRAGContext` to handle this:

```typescript
export function formatRAGContext(chunks: KnowledgeContext[]): string {
  if (chunks.length === 0) return "";

  const formatted = chunks.map((c, i) => {
    // Prefer heading path from metadata over URL
    const meta = c.metadata as LiteratureChunkMetadata | undefined;
    const citation = meta?.headingPath
      ? meta.headingPath.join(" > ")
      : c.sourceUrl ?? "unknown source";

    return `[${i + 1}] ${c.title ?? "Untitled"} (${citation})\n${c.content}`;
  }).join("\n\n---\n\n");

  return `## Relevant Knowledge\n\n${formatted}`;
}
```

This ensures the Theory agent, when asked about Butterworth crossover alignments, returns a
citation like:
> [1] Loudspeaker Modelling and Design — Part III > Chapter 12 > 12.3 Butterworth Alignment

---

## 2.10 Implementation Checklist

In recommended execution order:

- [ ] Create `knowledge/literature/` directory tree and add PDFs locally
- [ ] Create `knowledge/literature/manifest.json` with initial entries (Hill + Iversen)
- [ ] Create `knowledge/processed/` directory structure; add to `.gitignore` for PDFs only
- [ ] Write `web/lib/knowledge/extract-pdf.ts` — subprocess wrapper
- [ ] Write `web/lib/knowledge/toc.ts` — TOC extraction
- [ ] Write `web/lib/knowledge/chunk-literature.ts` — section splitter
- [ ] Write `web/lib/knowledge/upsert-literature.ts` — DB upsert function
- [ ] Add `literatureSources` table to `web/lib/db/schema.ts`
- [ ] Run `npx drizzle-kit generate` and `npx drizzle-kit migrate` to create the table
- [ ] Write `web/scripts/ingest-literature.ts`
- [ ] Add `"ingest:literature"` script to `web/package.json`
- [ ] Run `pip install marker-pdf` and test extraction on Iversen (19 pages, fast)
- [ ] Run `npm run ingest:literature` and verify chunks appear in `knowledge_chunks`
- [ ] Extend `getRAGContext` with optional `sourceTypes` filter
- [ ] Update `formatRAGContext` with heading-path citation logic
- [ ] Run Hill (391 pages) extraction — expect 3–5 min with `--use_llm`
- [ ] Install `pip install docling` and add first datasheet entry to manifest

---

## 2.11 Environment Variables

No new environment variables are required. The existing setup covers all dependencies:

| Variable | Required for | Already in .env.local? |
|----------|-------------|------------------------|
| `DATABASE_URL` | Neon write access | Yes |
| `OPENAI_API_KEY` | Marker `--use_llm` flag + embeddings | Yes (via AI Gateway) |

If Marker's `--use_llm` uses Anthropic instead of OpenAI, set:
```bash
ANTHROPIC_API_KEY=...   # only if using marker --llm_provider anthropic
```

---

## 2.12 Performance Expectations

| Document | Pages | Extraction time | Chunks | Embedding batches |
|----------|-------|-----------------|--------|-------------------|
| Iversen/DTU | 19 | ~45 sec (Marker + LLM) | 15–25 | 1 |
| Hill textbook | 391 | ~4–6 min (Marker + LLM) | 180–260 | 2–3 |
| AES paper | 8–12 | ~30 sec | 8–15 | 1 |
| Datasheet (2pp) | 2 | ~5 sec (Docling) | 1–4 | 1 |

Embedding cost (text-embedding-3-small): ~$0.02 per 1M tokens. The Hill textbook produces
approximately 300,000 tokens of chunk content — cost under $0.01. Total literature corpus
at 10 documents: under $0.10 in embedding costs.

All extraction output is cached in `knowledge/processed/` and committed to git, so the
extraction step runs once per document. Subsequent `npm run ingest:literature` runs skip
extraction and go straight to chunking + embedding.
