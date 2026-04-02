// Imports VituixCAD's bundled VituixCAD_Drivers.txt into driver_database.
// Usage: npx tsx scripts/import-vituixcad-drivers.ts [--path /path/to/VituixCAD_Drivers.txt] [--dry-run]
// Default path: ~/Documents/VituixCAD/Enclosure/VituixCAD_Drivers.txt (Windows default)

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getNeon } from '../lib/db/index';

const DEFAULT_PATH = path.join(
  os.homedir(),
  'Documents', 'VituixCAD', 'Enclosure', 'VituixCAD_Drivers.txt'
);

function parseNum(s: string | undefined): number | null {
  if (!s || s.trim() === '' || s.trim() === '-') return null;
  const n = parseFloat(s.replace(',', '.'));
  return isNaN(n) ? null : n;
}

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

  const headers = lines[0].split('\t').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    const cols = line.split('\t');
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = cols[i]?.trim() ?? ''; });
    return obj;
  });

  console.log(`Parsed ${rows.length} drivers from ${filePath}`);
  if (dryRun) console.log('[DRY RUN] — no DB writes');

  let inserted = 0;
  let skipped = 0;
  const sql = dryRun ? null : getNeon();

  for (const row of rows) {
    if (!row['Manufacturer'] || !row['Model']) { skipped++; continue; }

    const sizeInches = parseNum(row['Size']);
    const record = {
      manufacturer:        row['Manufacturer'],
      model:               row['Model'],
      driver_type:         mapType(row['Type'] ?? ''),
      nominal_diameter_mm: sizeInches ? sizeInches * 25.4 : null,
      re_ohm:              parseNum(row['Re']),
      le_mh:               parseNum(row['Le']),
      fs_hz:               parseNum(row['fs']),
      qms:                 parseNum(row['Qms']),
      qes:                 parseNum(row['Qes']),
      qts:                 parseNum(row['Qts']),
      rms_kg_s:            parseNum(row['Rms']),
      mms_grams:           parseNum(row['Mms']),
      cms_mm_per_n:        parseNum(row['Cms']),
      vas_liters:          parseNum(row['Vas']),
      sd_cm2:              parseNum(row['Sd']),
      bl:                  parseNum(row['Bl']),
      power_watts:         parseNum(row['Pmax']),
      xmax_mm:             parseNum(row['Xmax']),
      source:              'vituixcad_import',
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
