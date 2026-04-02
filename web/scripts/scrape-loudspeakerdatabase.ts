// Scrapes T/S parameter data from loudspeakerdatabase.com.
// Data is embedded as JSON in page responses — no formal API.
// Run offline, not during sessions. Respects a 1s delay between requests.
// Usage: npx tsx scripts/scrape-loudspeakerdatabase.ts [--dry-run] [--limit N]

import { getNeon } from '../lib/db/index';

const BASE_URL = 'https://loudspeakerdatabase.com';
const DELAY_MS = 1000;

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function parseNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}

function extractDriverData(html: string): Record<string, unknown>[] {
  // loudspeakerdatabase.com embeds data as a JS variable in <script> tags
  const patterns = [
    /var\s+driversData\s*=\s*(\[[\s\S]+?\]);/,
    /window\.__DRIVERS__\s*=\s*(\[[\s\S]+?\]);/,
    /window\.__NEXT_DATA__\s*=\s*(\{[\s\S]+?\})\s*<\/script>/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        // Handle Next.js __NEXT_DATA__ structure
        if (parsed?.props?.pageProps?.drivers) {
          return parsed.props.pageProps.drivers as Record<string, unknown>[];
        }
        if (Array.isArray(parsed)) return parsed as Record<string, unknown>[];
      } catch { /* try next pattern */ }
    }
  }
  return [];
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : Infinity;

  console.log(`Scraping loudspeakerdatabase.com${dryRun ? ' [DRY RUN]' : ''}...`);

  const mainResp = await fetch(`${BASE_URL}/`);
  const mainHtml = await mainResp.text();
  const drivers = extractDriverData(mainHtml);

  if (drivers.length === 0) {
    console.warn('No driver data found in main page. Site structure may have changed.');
    console.warn('The scraper is built to gracefully handle this — no data will be written.');
    console.warn('To update: inspect page source and update extractDriverData() patterns.');
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

    const manufacturer = String(d['brand'] ?? d['manufacturer'] ?? d['Manufacturer'] ?? '').trim();
    const model = String(d['model'] ?? d['name'] ?? d['Model'] ?? '').trim();
    if (!manufacturer || !model) { skipped++; continue; }

    const record = {
      manufacturer,
      model,
      driver_type:  'fullrange',
      fs_hz:        parseNum(d['Fs'] ?? d['fs']),
      qts:          parseNum(d['Qts'] ?? d['qts']),
      qes:          parseNum(d['Qes'] ?? d['qes']),
      qms:          parseNum(d['Qms'] ?? d['qms']),
      vas_liters:   parseNum(d['Vas'] ?? d['vas']),
      xmax_mm:      parseNum(d['Xmax'] ?? d['xmax']),
      re_ohm:       parseNum(d['Re'] ?? d['re']),
      power_watts:  parseNum(d['Pmax'] ?? d['pe'] ?? d['Pe']),
      source:       'loudspeakerdatabase_scrape',
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
