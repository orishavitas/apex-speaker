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

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!fs.existsSync(CLONE_DIR)) {
    console.log('Cloning DeepSOIC/loudspeaker-database...');
    execSync(`git clone --depth=1 ${REPO_URL} "${CLONE_DIR}"`, { stdio: 'inherit' });
  } else {
    console.log('Repo already cloned — pulling latest...');
    try {
      execSync(`git -C "${CLONE_DIR}" pull`, { stdio: 'inherit' });
    } catch {
      console.log('Pull failed — using cached clone.');
    }
  }

  if (!fs.existsSync(XLSX_FILE)) {
    // Try alternate filename
    const files = fs.readdirSync(CLONE_DIR).filter(f => f.endsWith('.xlsx'));
    if (files.length === 0) {
      console.error(`No XLSX found in: ${CLONE_DIR}`);
      process.exit(1);
    }
    console.log(`Using: ${files[0]}`);
    const altPath = path.join(CLONE_DIR, files[0]);
    const workbook = XLSX.readFile(altPath);
    return processWorkbook(workbook, dryRun);
  }

  const workbook = XLSX.readFile(XLSX_FILE);
  return processWorkbook(workbook, dryRun);
}

async function processWorkbook(workbook: XLSX.WorkBook, dryRun: boolean) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // Sheet uses numeric col keys — read as array of arrays to get real headers from row 0
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 }) as unknown[][];

  if (rawRows.length < 2) {
    console.error('No data rows found in XLSX');
    process.exit(1);
  }

  // Row 0 = column numbers (1-31), Row 1 = actual header names, Row 2+ = data
  const headerRow = (rawRows[1] as unknown[]).map(h => String(h ?? '').trim());
  const dataRows = rawRows.slice(2);

  // Build named-column objects using the header map
  const rows = dataRows.map(r => {
    const arr = r as unknown[];
    const obj: Record<string, unknown> = {};
    headerRow.forEach((h, i) => { if (h) obj[h] = arr[i]; });
    return obj;
  });

  console.log(`Parsed ${rows.length} data rows (headers: ${headerRow.slice(0, 5).join(', ')}...)`);
  if (dryRun) console.log('[DRY RUN] — no DB writes');

  let inserted = 0;
  let skipped = 0;
  const sql = dryRun ? null : getNeon();

  for (const row of rows) {
    // 'Column1' holds the model name (e.g. "jbl flip 4")
    const rawName = String(row['Column1'] ?? row['part number'] ?? '').trim();
    if (!rawName) { skipped++; continue; }

    // Attempt to extract brand from model name (first word)
    const parts = rawName.split(' ');
    const manufacturer = parts[0].toUpperCase();
    const model = rawName;

    const record = {
      manufacturer,
      model,
      driver_type:   'fullrange',
      fs_hz:         parseNum(row['fs']),
      qts:           parseNum(row['Qts']),
      qes:           parseNum(row['Qes']),
      qms:           parseNum(row['Qms']),
      vas_liters:    parseNum(row['Vas']),
      mms_grams:     parseNum(row['Mms']),
      cms_mm_per_n:  parseNum(row['Cms']),
      sd_cm2:        null as number | null,   // not in this dataset
      xmax_mm:       null as number | null,   // not in this dataset
      re_ohm:        parseNum(row['R']),
      bl:            parseNum(row['BxL']),
      power_watts:   parseNum(row['power rating']),
      source:        'deepsoic_import',
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
