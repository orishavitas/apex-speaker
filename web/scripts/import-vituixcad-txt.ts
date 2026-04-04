// Imports drivers from VituixCAD_Drivers.txt into driver_database.
// Usage: npx tsx scripts/import-vituixcad-txt.ts [--dry-run]
// File: C:\Users\Public\Documents\VituixCAD\Enclosure\VituixCAD_Drivers.txt

import { readFileSync } from 'fs';
import { getNeon } from '../lib/db/index';

const FILE_PATH = 'C:\\Users\\Public\\Documents\\VituixCAD\\Enclosure\\VituixCAD_Drivers.txt';

// VituixCAD Type column → driver_type enum
const TYPE_MAP: Record<string, string> = {
  'W':  'woofer',
  'S':  'subwoofer',
  'M':  'midrange',
  'WM': 'midrange',
  'T':  'tweeter',
  'C':  'compression_driver',
  'F':  'fullrange',
  'PR': 'fullrange',  // passive radiator — no direct enum, treat as fullrange
  '':   'woofer',    // blank = woofer (most common unlabeled type in the file)
};

function parseNum(v: string | undefined): number | null {
  if (!v || v.trim() === '') return null;
  const n = parseFloat(v.trim());
  return isNaN(n) ? null : n;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const lines = readFileSync(FILE_PATH, 'utf8').split('\n');
  const headers = lines[0].split('\t').map(h => h.trim());

  const idx = (name: string) => headers.indexOf(name);

  // Column indices
  const iMfr   = idx('Manufacturer');
  const iModel = idx('Model');
  const iType  = idx('Type');
  const iFs    = idx('fs [Hz]');
  const iQts   = idx('Qts');
  const iVas   = idx('Vas [l]');
  const iSd    = idx('Sd [cm2]');
  const iXmax  = idx('Xmax [mm]');
  const iSPL   = idx('USPL [dB]');
  const iPmax  = idx('Pmax [W]');

  console.log(`Columns found: Manufacturer=${iMfr} Model=${iModel} Type=${iType} fs=${iFs} Qts=${iQts}`);
  console.log(`File: ${lines.length - 1} data rows`);

  const sql = dryRun ? null : getNeon();
  let inserted = 0, skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split('\t');
    const mfr   = cols[iMfr]?.trim();
    const model = cols[iModel]?.trim();
    if (!mfr || !model) { skipped++; continue; }

    const typeCode = cols[iType]?.trim() ?? '';
    const driverType = TYPE_MAP[typeCode] ?? 'woofer';

    const record = {
      manufacturer:     mfr,
      model,
      driver_type:      driverType,
      fs_hz:            parseNum(cols[iFs]),
      qts:              parseNum(cols[iQts]),
      vas_liters:       parseNum(cols[iVas]),
      sd_cm2:           parseNum(cols[iSd]),
      xmax_mm:          parseNum(cols[iXmax]),
      sensitivity_1m1w: parseNum(cols[iSPL]),
      power_watts:      parseNum(cols[iPmax]),
      source:           'vituixcad_bundled',
    };

    if (dryRun) {
      console.log(`  [dry] ${record.manufacturer} ${record.model} [${driverType}] fs=${record.fs_hz} qts=${record.qts}`);
      inserted++;
      continue;
    }

    try {
      await sql!`
        INSERT INTO driver_database (
          manufacturer, model, driver_type, fs_hz, qts,
          vas_liters, sd_cm2, xmax_mm, sensitivity_1m1w, power_watts, source
        ) VALUES (
          ${record.manufacturer}, ${record.model}, ${record.driver_type}::driver_type,
          ${record.fs_hz}, ${record.qts},
          ${record.vas_liters}, ${record.sd_cm2}, ${record.xmax_mm},
          ${record.sensitivity_1m1w}, ${record.power_watts}, ${record.source}
        )
        ON CONFLICT (manufacturer, model)
        DO UPDATE SET
          driver_type         = EXCLUDED.driver_type,
          fs_hz               = COALESCE(EXCLUDED.fs_hz, driver_database.fs_hz),
          qts                 = COALESCE(EXCLUDED.qts, driver_database.qts),
          vas_liters          = COALESCE(EXCLUDED.vas_liters, driver_database.vas_liters),
          sd_cm2              = COALESCE(EXCLUDED.sd_cm2, driver_database.sd_cm2),
          xmax_mm             = COALESCE(EXCLUDED.xmax_mm, driver_database.xmax_mm),
          sensitivity_1m1w    = COALESCE(EXCLUDED.sensitivity_1m1w, driver_database.sensitivity_1m1w),
          power_watts         = COALESCE(EXCLUDED.power_watts, driver_database.power_watts),
          source              = EXCLUDED.source,
          updated_at          = NOW()
      `;
      inserted++;
      if (inserted % 100 === 0) console.log(`  ${inserted} drivers imported...`);
    } catch (e) {
      console.error(`  SKIP ${mfr} ${model}: ${(e as Error).message}`);
      skipped++;
    }
  }

  console.log(`\nDone. inserted/updated: ${inserted}, skipped: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
