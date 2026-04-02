# Sprint 4c — Driver Database Population Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the empty `driver_database` table with real T/S parameters from three sources: VituixCAD's bundled `VituixCAD_Drivers.txt` (local TSV), the DeepSOIC GitHub XLSX dataset, and loudspeakerdatabase.com (scraped JSON). Add two new `source_type` enum values. Give the design wizard a real driver query endpoint it can use for recommendations.

**Architecture:** Three offline import scripts under `web/scripts/`. Each reads its source, maps columns to `driver_database` schema, and upserts via `onConflictDoUpdate` on `(manufacturer, model)`. A new `/api/drivers/search` endpoint lets the wizard query drivers by profile filters. All scripts support `--dry-run`. New enum values added via raw SQL (ALTER TYPE must run outside a transaction in PostgreSQL).

**Tech Stack:** Next.js 16, Drizzle ORM, raw Neon SQL (for enum ALTER), `xlsx` npm package for XLSX parsing, Node fetch for scraping.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Create | `web/scripts/import-vituixcad-drivers.ts` | Parse VituixCAD_Drivers.txt TSV → driver_database upsert |
| Create | `web/scripts/import-deepsoic-drivers.ts` | Clone + parse DeepSOIC XLSX → driver_database upsert |
| Create | `web/scripts/scrape-loudspeakerdatabase.ts` | Scrape loudspeakerdatabase.com JSON → driver_database upsert |
| Create | `web/scripts/add-source-type-enums.ts` | ALTER TYPE to add community_build + measurement enum values |
| Create | `web/app/api/drivers/search/route.ts` | GET endpoint: filter drivers by type/sensitivity/fs/budget |

---

## Task 1: Add New source_type Enum Values

**Files:**
- Create: `web/scripts/add-source-type-enums.ts`

- [ ] **Step 1: Check existing enum values**

```bash
cd web && cat lib/db/schema.ts | grep -A 20 "sourceTypeEnum"
```

Note which values already exist. Expected to see: `chatgpt_conversation`, `notebooklm`, `vituixcad_project`, `driver_measurement`.

- [ ] **Step 2: Create the migration script**

Create `web/scripts/add-source-type-enums.ts`:

```ts
// Run this ONCE to add new source_type enum values.
// ALTER TYPE ... ADD VALUE cannot run inside a transaction in PostgreSQL.
// This script uses raw SQL, not Drizzle, for that reason.

import { getNeon } from '../lib/db/index';

async function main() {
  const sql = getNeon();

  // Check which values already exist before adding
  const existing = await sql`
    SELECT enumlabel FROM pg_enum
    JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'source_type'
  `;
  const labels = existing.map((r: { enumlabel: string }) => r.enumlabel);
  console.log('Existing source_type values:', labels);

  if (!labels.includes('community_build')) {
    await sql`ALTER TYPE source_type ADD VALUE 'community_build'`;
    console.log('Added: community_build');
  } else {
    console.log('Already exists: community_build');
  }

  if (!labels.includes('measurement')) {
    await sql`ALTER TYPE source_type ADD VALUE 'measurement'`;
    console.log('Added: measurement');
  } else {
    console.log('Already exists: measurement');
  }

  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run the migration**

```bash
cd web && npx tsx scripts/add-source-type-enums.ts
```

Expected output:
```
Existing source_type values: [ 'chatgpt_conversation', 'notebooklm', ... ]
Added: community_build
Added: measurement
Done.
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/add-source-type-enums.ts
git commit -m "feat: add community_build + measurement to source_type enum"
```

---

## Task 2: VituixCAD Drivers Import Script

**Files:**
- Create: `web/scripts/import-vituixcad-drivers.ts`

- [ ] **Step 1: Create the import script**

Create `web/scripts/import-vituixcad-drivers.ts`:

```ts
// Imports VituixCAD's bundled VituixCAD_Drivers.txt into driver_database.
// Usage: npx tsx scripts/import-vituixcad-drivers.ts [--path /path/to/VituixCAD_Drivers.txt] [--dry-run]
//
// Default path: ~/Documents/VituixCAD/Enclosure/VituixCAD_Drivers.txt (Windows default)

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getNeon } from '../lib/db/index';

const DEFAULT_PATH = path.join(
  os.homedir(),
  'Documents', 'VituixCAD', 'Enclosure', 'VituixCAD_Drivers.txt'
);

// VituixCAD TSV column names → our schema
// Columns: Manufacturer, Model, Type, Size, Re, Le, Leb, Ke, Rss, fs, Qms, Qes, Qts,
//          Rms, Mms, Cms, Vas, Sd, Bl, Pmax, Xmax, Status, Revision, Updated
interface VxcRow {
  Manufacturer: string;
  Model: string;
  Type: string;
  Size: string;
  Re: string;
  Le: string;
  fs: string;
  Qms: string;
  Qes: string;
  Qts: string;
  Rms: string;
  Mms: string;
  Cms: string;
  Vas: string;
  Sd: string;
  Bl: string;
  Pmax: string;
  Xmax: string;
}

function parseFloat_(s: string | undefined): number | null {
  if (!s || s.trim() === '' || s.trim() === '-') return null;
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

// VituixCAD Type → our driverTypeEnum
function mapType(t: string): string {
  const lower = t.toLowerCase();
  if (lower === 'w') return 'woofer';
  if (lower === 'm') return 'midrange';
  if (lower === 't') return 'tweeter';
  if (lower === 'c') return 'coaxial';
  if (lower === 'f') return 'fullrange';
  if (lower === 'pr' || lower === 'abr') return 'passive_radiator';
  if (lower === 's') return 'subwoofer';
  return 'fullrange';
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const pathIdx = args.indexOf('--path');
  const filePath = pathIdx >= 0 ? args[pathIdx + 1] : DEFAULT_PATH;

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    console.error(`Pass --path /path/to/VituixCAD_Drivers.txt`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#'));

  if (lines.length < 2) {
    console.error('File appears empty or has no data rows.');
    process.exit(1);
  }

  // First line is headers
  const headers = lines[0].split('\t').map(h => h.trim());
  const rows: VxcRow[] = lines.slice(1).map(line => {
    const cols = line.split('\t');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i]?.trim() ?? ''; });
    return obj as unknown as VxcRow;
  });

  console.log(`Parsed ${rows.length} drivers from ${filePath}`);
  if (dryRun) console.log('[DRY RUN] — no DB writes');

  let inserted = 0;
  let skipped = 0;

  const sql = dryRun ? null : getNeon();

  for (const row of rows) {
    if (!row.Manufacturer || !row.Model) { skipped++; continue; }

    const record = {
      manufacturer:         row.Manufacturer,
      model:                row.Model,
      driver_type:          mapType(row.Type),
      nominal_diameter_mm:  parseFloat_(row.Size) ? (parseFloat_(row.Size)! * 25.4) : null, // inches→mm
      re_ohm:               parseFloat_(row.Re),
      le_mh:                parseFloat_(row.Le),
      fs_hz:                parseFloat_(row.fs),
      qms:                  parseFloat_(row.Qms),
      qes:                  parseFloat_(row.Qes),
      qts:                  parseFloat_(row.Qts),
      rms_kg_s:             parseFloat_(row.Rms),
      mms_grams:            parseFloat_(row.Mms),
      cms_mm_per_n:         parseFloat_(row.Cms),
      vas_liters:           parseFloat_(row.Vas),
      sd_cm2:               parseFloat_(row.Sd),
      bl:                   parseFloat_(row.Bl),
      power_watts:          parseFloat_(row.Pmax),
      xmax_mm:              parseFloat_(row.Xmax),
      source:               'vituixcad_import',
    };

    if (dryRun) {
      console.log(`  [dry] ${record.manufacturer} ${record.model} (${record.driver_type})`);
      inserted++;
      continue;
    }

    try {
      await sql!`
        INSERT INTO driver_database (
          manufacturer, model, driver_type, nominal_diameter_mm,
          re_ohm, le_mh, fs_hz, qms, qes, qts, rms_kg_s, mms_grams,
          cms_mm_per_n, vas_liters, sd_cm2, bl, power_watts, xmax_mm, source
        ) VALUES (
          ${record.manufacturer}, ${record.model}, ${record.driver_type}::driver_type,
          ${record.nominal_diameter_mm}, ${record.re_ohm}, ${record.le_mh},
          ${record.fs_hz}, ${record.qms}, ${record.qes}, ${record.qts},
          ${record.rms_kg_s}, ${record.mms_grams}, ${record.cms_mm_per_n},
          ${record.vas_liters}, ${record.sd_cm2}, ${record.bl},
          ${record.power_watts}, ${record.xmax_mm}, ${record.source}
        )
        ON CONFLICT (manufacturer, model)
        DO UPDATE SET
          fs_hz = EXCLUDED.fs_hz, qts = EXCLUDED.qts, vas_liters = EXCLUDED.vas_liters,
          sd_cm2 = EXCLUDED.sd_cm2, xmax_mm = EXCLUDED.xmax_mm, bl = EXCLUDED.bl,
          mms_grams = EXCLUDED.mms_grams, re_ohm = EXCLUDED.re_ohm,
          updated_at = NOW()
      `;
      inserted++;
    } catch (e) {
      console.error(`  SKIP ${record.manufacturer} ${record.model}:`, (e as Error).message);
      skipped++;
    }
  }

  console.log(`Done. Inserted/updated: ${inserted}, skipped: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add script to package.json**

In `web/package.json`, add to `scripts`:
```json
"import:vituixcad": "npx tsx scripts/import-vituixcad-drivers.ts",
"import:vituixcad:dry": "npx tsx scripts/import-vituixcad-drivers.ts --dry-run"
```

- [ ] **Step 3: Dry run test**

```bash
cd web && npm run import:vituixcad:dry -- --path "/c/Users/OriShavit/Documents/VituixCAD/Enclosure/VituixCAD_Drivers.txt"
```

Expected: lists drivers without writing to DB.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/import-vituixcad-drivers.ts web/package.json
git commit -m "feat: VituixCAD_Drivers.txt import script with dry-run support"
```

---

## Task 3: DeepSOIC XLSX Import Script

**Files:**
- Create: `web/scripts/import-deepsoic-drivers.ts`

- [ ] **Step 1: Install xlsx package**

```bash
cd web && npm install xlsx
```

Expected: xlsx added to dependencies.

- [ ] **Step 2: Create the import script**

Create `web/scripts/import-deepsoic-drivers.ts`:

```ts
// Imports drivers from DeepSOIC/loudspeaker-database GitHub repo.
// Clones (or pulls) the repo to a temp dir, parses "driver data.xlsx".
// Usage: npx tsx scripts/import-deepsoic-drivers.ts [--dry-run]

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import * as XLSX from 'xlsx';
import { getNeon } from '../lib/db/index';

const REPO_URL = 'https://github.com/DeepSOIC/loudspeaker-database.git';
const CLONE_DIR = path.join(os.tmpdir(), 'deepsoic-loudspeaker-db');
const XLSX_FILE = path.join(CLONE_DIR, 'driver data.xlsx');

function parseFloat_(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // Clone or pull
  if (!fs.existsSync(CLONE_DIR)) {
    console.log('Cloning DeepSOIC/loudspeaker-database...');
    execSync(`git clone --depth=1 ${REPO_URL} "${CLONE_DIR}"`, { stdio: 'inherit' });
  } else {
    console.log('Repo already cloned — pulling latest...');
    execSync(`git -C "${CLONE_DIR}" pull`, { stdio: 'inherit' });
  }

  if (!fs.existsSync(XLSX_FILE)) {
    console.error(`XLSX not found at: ${XLSX_FILE}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(XLSX_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  console.log(`Parsed ${rows.length} rows`);
  if (dryRun) console.log('[DRY RUN] — no DB writes');

  let inserted = 0;
  let skipped = 0;
  const sql = dryRun ? null : getNeon();

  for (const row of rows) {
    const manufacturer = String(row['Manufacturer'] ?? row['Brand'] ?? '').trim();
    const model = String(row['Model'] ?? row['Part'] ?? '').trim();
    if (!manufacturer || !model) { skipped++; continue; }

    const record = {
      manufacturer,
      model,
      driver_type:    'fullrange', // DeepSOIC doesn't always tag type — default to fullrange
      fs_hz:          parseFloat_(row['fs'] ?? row['Fs']),
      qts:            parseFloat_(row['Qts']),
      qes:            parseFloat_(row['Qes']),
      qms:            parseFloat_(row['Qms']),
      vas_liters:     parseFloat_(row['Vas']),
      mms_grams:      parseFloat_(row['Mms']),
      cms_mm_per_n:   parseFloat_(row['Cms']),
      sd_cm2:         parseFloat_(row['Sd']),
      xmax_mm:        parseFloat_(row['Xmax']),
      re_ohm:         parseFloat_(row['Re']),
      bl:             parseFloat_(row['Bl'] ?? row['BL']),
      power_watts:    parseFloat_(row['Pmax'] ?? row['Pe']),
      source:         'deepsoic_import',
    };

    if (dryRun) {
      console.log(`  [dry] ${record.manufacturer} ${record.model}`);
      inserted++;
      continue;
    }

    try {
      await sql!`
        INSERT INTO driver_database (
          manufacturer, model, driver_type, fs_hz, qts, qes, qms,
          vas_liters, mms_grams, cms_mm_per_n, sd_cm2, xmax_mm,
          re_ohm, bl, power_watts, source
        ) VALUES (
          ${record.manufacturer}, ${record.model}, ${record.driver_type}::driver_type,
          ${record.fs_hz}, ${record.qts}, ${record.qes}, ${record.qms},
          ${record.vas_liters}, ${record.mms_grams}, ${record.cms_mm_per_n},
          ${record.sd_cm2}, ${record.xmax_mm}, ${record.re_ohm},
          ${record.bl}, ${record.power_watts}, ${record.source}
        )
        ON CONFLICT (manufacturer, model)
        DO UPDATE SET
          fs_hz = COALESCE(EXCLUDED.fs_hz, driver_database.fs_hz),
          qts = COALESCE(EXCLUDED.qts, driver_database.qts),
          source = EXCLUDED.source,
          updated_at = NOW()
      `;
      inserted++;
    } catch (e) {
      console.error(`  SKIP ${record.manufacturer} ${record.model}:`, (e as Error).message);
      skipped++;
    }
  }

  console.log(`Done. Inserted/updated: ${inserted}, skipped: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Add to package.json scripts**

```json
"import:deepsoic": "npx tsx scripts/import-deepsoic-drivers.ts",
"import:deepsoic:dry": "npx tsx scripts/import-deepsoic-drivers.ts --dry-run"
```

- [ ] **Step 4: Dry run test**

```bash
cd web && npm run import:deepsoic:dry
```

Expected: clones repo, lists drivers without writing to DB.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add web/scripts/import-deepsoic-drivers.ts web/package.json web/package-lock.json
git commit -m "feat: DeepSOIC loudspeaker-database XLSX import script"
```

---

## Task 4: loudspeakerdatabase.com Scraper

**Files:**
- Create: `web/scripts/scrape-loudspeakerdatabase.ts`

- [ ] **Step 1: Create the scraper script**

Create `web/scripts/scrape-loudspeakerdatabase.ts`:

```ts
// Scrapes T/S parameter data from loudspeakerdatabase.com.
// Data is embedded as JSON in page responses — no formal API.
// Run offline, not during sessions. Respects a 1s delay between requests.
// Usage: npx tsx scripts/scrape-loudspeakerdatabase.ts [--dry-run] [--limit N]

import { getNeon } from '../lib/db/index';

const BASE_URL = 'https://loudspeakerdatabase.com';
const DELAY_MS = 1000;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseFloat_(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

// Attempt to extract the JSON data array embedded in the page HTML
function extractDriverData(html: string): Record<string, unknown>[] {
  // loudspeakerdatabase.com embeds data as a JS variable or JSON blob in <script> tags
  const match = html.match(/var\s+driversData\s*=\s*(\[[\s\S]+?\]);/) ??
                html.match(/window\.__DRIVERS__\s*=\s*(\[[\s\S]+?\]);/) ??
                html.match(/<script[^>]*>\s*(\[[\s\S]+?\])\s*<\/script>/);
  if (!match) return [];
  try { return JSON.parse(match[1]) as Record<string, unknown>[]; }
  catch { return []; }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;

  console.log(`Scraping loudspeakerdatabase.com${dryRun ? ' [DRY RUN]' : ''}...`);

  // Fetch the main page to find driver list
  const mainResp = await fetch(`${BASE_URL}/`);
  const mainHtml = await mainResp.text();
  const drivers = extractDriverData(mainHtml);

  if (drivers.length === 0) {
    console.warn('No driver data found in main page. Site structure may have changed.');
    console.warn('Inspect the page source and update extractDriverData() regex patterns.');
    process.exit(0);
  }

  console.log(`Found ${drivers.length} drivers in page data`);
  if (dryRun) console.log('[DRY RUN] — no DB writes');

  let inserted = 0;
  let skipped = 0;
  const sql = dryRun ? null : getNeon();
  let count = 0;

  for (const d of drivers) {
    if (count >= limit) break;
    count++;

    const manufacturer = String(d['brand'] ?? d['manufacturer'] ?? '').trim();
    const model = String(d['model'] ?? d['name'] ?? '').trim();
    if (!manufacturer || !model) { skipped++; continue; }

    const record = {
      manufacturer,
      model,
      driver_type:    'fullrange',
      fs_hz:          parseFloat_(d['Fs'] ?? d['fs']),
      qts:            parseFloat_(d['Qts'] ?? d['qts']),
      qes:            parseFloat_(d['Qes'] ?? d['qes']),
      qms:            parseFloat_(d['Qms'] ?? d['qms']),
      vas_liters:     parseFloat_(d['Vas'] ?? d['vas']),
      xmax_mm:        parseFloat_(d['Xmax'] ?? d['xmax']),
      re_ohm:         parseFloat_(d['Re'] ?? d['re']),
      power_watts:    parseFloat_(d['Pmax'] ?? d['pe']),
      source:         'loudspeakerdatabase_scrape',
    };

    if (dryRun) {
      console.log(`  [dry] ${record.manufacturer} ${record.model}`);
      inserted++;
      await sleep(0);
      continue;
    }

    try {
      await sql!`
        INSERT INTO driver_database (
          manufacturer, model, driver_type, fs_hz, qts, qes, qms,
          vas_liters, xmax_mm, re_ohm, power_watts, source
        ) VALUES (
          ${record.manufacturer}, ${record.model}, ${record.driver_type}::driver_type,
          ${record.fs_hz}, ${record.qts}, ${record.qes}, ${record.qms},
          ${record.vas_liters}, ${record.xmax_mm}, ${record.re_ohm},
          ${record.power_watts}, ${record.source}
        )
        ON CONFLICT (manufacturer, model)
        DO UPDATE SET
          fs_hz = COALESCE(EXCLUDED.fs_hz, driver_database.fs_hz),
          qts = COALESCE(EXCLUDED.qts, driver_database.qts),
          source = EXCLUDED.source,
          updated_at = NOW()
      `;
      inserted++;
    } catch (e) {
      console.error(`  SKIP ${record.manufacturer} ${record.model}:`, (e as Error).message);
      skipped++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`Done. Inserted/updated: ${inserted}, skipped: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Add to package.json scripts**

```json
"scrape:loudspeakerdb": "npx tsx scripts/scrape-loudspeakerdatabase.ts",
"scrape:loudspeakerdb:dry": "npx tsx scripts/scrape-loudspeakerdatabase.ts --dry-run --limit 10"
```

- [ ] **Step 3: Dry run test**

```bash
cd web && npm run scrape:loudspeakerdb:dry
```

Expected: fetches main page, reports driver count, lists first 10 without writing. If site structure has changed, the script warns and exits gracefully.

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/scripts/scrape-loudspeakerdatabase.ts web/package.json
git commit -m "feat: loudspeakerdatabase.com scraper script with dry-run and rate limiting"
```

---

## Task 5: Driver Search API Endpoint

**Files:**
- Create: `web/app/api/drivers/search/route.ts`

- [ ] **Step 1: Create the search endpoint**

Create `web/app/api/drivers/search/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { driverDatabase } from '@/lib/db/schema';
import { and, gte, lte, eq, isNotNull, asc } from 'drizzle-orm';

// GET /api/drivers/search?type=woofer&sens_min=84&sens_max=92&fs_max=80&budget_max=150&limit=5
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;

  const type       = p.get('type');        // woofer | tweeter | midrange | fullrange
  const sensMin    = p.get('sens_min');
  const sensMax    = p.get('sens_max');
  const fsMax      = p.get('fs_max');
  const budgetMax  = p.get('budget_max');  // future: will need price column
  const limit      = Math.min(parseInt(p.get('limit') ?? '5'), 20);

  try {
    const conditions = [isNotNull(driverDatabase.fsHz)];

    if (type) conditions.push(eq(driverDatabase.driverType, type as 'woofer'));
    if (sensMin) conditions.push(gte(driverDatabase.sensitivity1m1w, parseFloat(sensMin)));
    if (sensMax) conditions.push(lte(driverDatabase.sensitivity1m1w, parseFloat(sensMax)));
    if (fsMax)   conditions.push(lte(driverDatabase.fsHz, parseFloat(fsMax)));

    const rows = await db
      .select({
        id:             driverDatabase.id,
        manufacturer:   driverDatabase.manufacturer,
        model:          driverDatabase.model,
        driverType:     driverDatabase.driverType,
        fsHz:           driverDatabase.fsHz,
        qts:            driverDatabase.qts,
        vasLiters:      driverDatabase.vasLiters,
        sdCm2:          driverDatabase.sdCm2,
        xmaxMm:         driverDatabase.xmaxMm,
        sensitivity1m1w: driverDatabase.sensitivity1m1w,
        nominalImpedanceOhm: driverDatabase.nominalImpedanceOhm,
      })
      .from(driverDatabase)
      .where(and(...conditions))
      .orderBy(asc(driverDatabase.fsHz))
      .limit(limit);

    return NextResponse.json({ drivers: rows, total: rows.length });
  } catch (e) {
    if (e instanceof Error && e.message.includes('DATABASE_URL')) {
      return NextResponse.json({ drivers: [], total: 0 });
    }
    console.error('[drivers/search] error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Test the endpoint (requires running dev server + populated DB)**

```bash
curl "http://localhost:3000/api/drivers/search?type=woofer&fs_max=80&limit=5"
```

Expected: JSON with up to 5 woofer drivers with fs < 80Hz.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/drivers/search/route.ts
git commit -m "feat: /api/drivers/search endpoint for wizard driver recommendations"
```

---

## Task 6: Run Real Imports + Verify Row Count

- [ ] **Step 1: Run VituixCAD import (real)**

```bash
cd web && npm run import:vituixcad -- --path "/c/Users/OriShavit/Documents/VituixCAD/Enclosure/VituixCAD_Drivers.txt"
```

Expected: `Inserted/updated: N, skipped: M` where N > 0.

- [ ] **Step 2: Run DeepSOIC import (real)**

```bash
cd web && npm run import:deepsoic
```

Expected: clones repo, inserts rows, reports count.

- [ ] **Step 3: Verify row count in DB**

```bash
npx tsx -e "
import { getNeon } from './lib/db/index';
const sql = getNeon();
const r = await sql\`SELECT COUNT(*) FROM driver_database\`;
console.log('Total drivers:', r[0].count);
"
```

Expected: count > 0.

- [ ] **Step 4: Test search endpoint against real data**

Start dev server:
```bash
npm run dev
```

In another terminal:
```bash
curl "http://localhost:3000/api/drivers/search?type=woofer&fs_max=80&limit=5" | python -m json.tool
```

Expected: 5 woofer drivers with real T/S params.

- [ ] **Step 5: Final TypeScript check**

```bash
cd web && npx tsc --noEmit 2>&1
```

Expected: exit code 0.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Sprint 4c complete — driver DB populated, search endpoint live"
```
