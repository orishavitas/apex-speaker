// Scrapes T/S parameter data from loudspeakerdatabase.com using Playwright.
// Uses a real browser to avoid rate-limiting and handle JS-rendered content.
// Usage: npx tsx scripts/scrape-loudspeakerdb-playwright.ts [--dry-run] [--brands ScanSpeak,Seas,...]
//
// Default brands: ScanSpeak, Seas, Dayton, Peerless, Wavecor, Morel, Purifi, Accuton, Vifa, Tang_Band

import { chromium } from 'playwright';
import { getNeon } from '../lib/db/index';

const BASE_URL = 'https://loudspeakerdatabase.com';
const DELAY_MS = 3000;  // 3s between driver requests to avoid rate-limiting

// Map site type slugs → our driver_type enum
const TYPE_MAP: Record<string, string> = {
  'Woofer':           'woofer',
  'Subwoofer':        'subwoofer',
  'Tweeter':          'tweeter',
  'Midrange':         'midrange',
  'Mid_Range':        'midrange',
  'Mid_Bass':         'midrange',
  'Mid-Bass':         'midrange',
  'MidBass':          'midrange',
  'Midbass':          'midrange',
  'Full_Range':       'fullrange',
  'Full-Range':       'fullrange',
  'Fullrange':        'fullrange',
  'Compression_Driver': 'compression_driver',
  'Coaxial':          'fullrange',
  'Supertweeter':     'supertweeter',
};

const DEFAULT_BRANDS = [
  'ScanSpeak', 'Seas', 'Dayton', 'Peerless', 'Wavecor',
  'Morel', 'Purifi', 'Accuton', 'Vifa', 'Tang_Band',
];

function parseNum(v: string | undefined): number | null {
  if (!v) return null;
  // Strip units: "28 Hz" → "28", "± 6.5 mm" → "6.5", "87.2 dB" → "87.2"
  const cleaned = v.replace(/[^0-9.-]/g, ' ').trim().split(/\s+/)[0];
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function mapType(typeHref: string | null): string {
  if (!typeHref) return 'fullrange';
  const slug = typeHref.replace(/^\//, '');
  for (const [key, val] of Object.entries(TYPE_MAP)) {
    if (slug.toLowerCase() === key.toLowerCase()) return val;
  }
  // Fallback: try partial match
  const lower = slug.toLowerCase();
  if (lower.includes('sub')) return 'subwoofer';
  if (lower.includes('tweet')) return 'tweeter';
  if (lower.includes('mid')) return 'midrange';
  if (lower.includes('woof')) return 'woofer';
  if (lower.includes('full') || lower.includes('range')) return 'fullrange';
  if (lower.includes('compress')) return 'compression_driver';
  return 'fullrange';
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function scrapeDriverLinks(page: import('playwright').Page, brand: string): Promise<string[]> {
  await page.goto(`${BASE_URL}/${brand}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(800);
  const links = await page.evaluate((b) => {
    const anchors = Array.from(document.querySelectorAll(`a[href^="/${b}/"]`));
    return [...new Set(anchors.map((a) => (a as HTMLAnchorElement).getAttribute('href')!))];
  }, brand);
  return links;
}

async function scrapeDriver(page: import('playwright').Page, href: string): Promise<Record<string, unknown> | null> {
  // Retry up to 3 times with backoff on network errors
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(`${BASE_URL}${href}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await sleep(600);
      return await page.evaluate(() => {
      const rows = document.querySelectorAll('table tr');
      const params: Record<string, string> = {};
      rows.forEach((r) => {
        const cells = r.querySelectorAll('td');
        if (cells.length >= 2) params[cells[0].textContent?.trim() ?? ''] = cells[1].textContent?.trim() ?? '';
      });
      const model = document.querySelector('h1')?.textContent?.trim() ?? '';
      // Type link: <a class="type-ribbon" href="/Mid_Bass"><h2>Mid Bass</h2></a>
      const typeRibbon = document.querySelector('a.type-ribbon') as HTMLAnchorElement | null;
      const typeHref = typeRibbon?.getAttribute('href') ?? null;
      // Brand: extract from URL path (first segment)
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const brand = pathParts.length >= 1 ? pathParts[0] : '';
        return { model, brand, typeHref, params };
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (attempt < 3 && (msg.includes('ERR_EMPTY_RESPONSE') || msg.includes('net::'))) {
        console.warn(`  RETRY ${href} (attempt ${attempt}): ${msg.split('\n')[0]}`);
        await sleep(10000 * attempt);  // 10s, 20s backoff
        continue;
      }
      console.warn(`  SKIP ${href}: ${msg.split('\n')[0]}`);
      return null;
    }
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const brandsArg = args.find(a => a.startsWith('--brands='))?.split('=')[1];
  const brands = brandsArg ? brandsArg.split(',') : DEFAULT_BRANDS;

  console.log(`Scraping loudspeakerdatabase.com [brands: ${brands.join(', ')}]${dryRun ? ' [DRY RUN]' : ''}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });

  const sql = dryRun ? null : getNeon();
  let inserted = 0;
  let skipped = 0;
  let total = 0;

  for (const brand of brands) {
    console.log(`\n→ ${brand}`);
    let links: string[];
    try {
      links = await scrapeDriverLinks(page, brand);
    } catch (e) {
      console.warn(`  SKIP brand ${brand}: ${(e as Error).message}`);
      continue;
    }
    console.log(`  Found ${links.length} drivers`);

    for (const href of links) {
      total++;
      // Random jitter: 2.5s–4.5s to avoid pattern detection
      await sleep(DELAY_MS + Math.floor(Math.random() * 1500));
      const raw = await scrapeDriver(page, href);
      if (!raw) { skipped++; continue; }

      const { model, brand: mfr, typeHref, params } = raw as {
        model: string; brand: string; typeHref: string | null;
        params: Record<string, string>;
      };

      if (!model || !mfr) { skipped++; continue; }

      const driverType = mapType(typeHref);

      // Map table rows to T/S params
      // Site uses: fS, QTS, xmax, SD, SPL1W, Pmax, Bl/√RE, Resonance, Q factor, Sensitivity, Linear excursion, Program power
      const record = {
        manufacturer:          mfr,
        model,
        driver_type:           driverType,
        fs_hz:                 parseNum(params['fS'] ?? params['Resonance']),
        qts:                   parseNum(params['QTS'] ?? params['Q factor']),
        vas_liters:            parseNum(params['VAS'] ?? params['Vas']),
        sd_cm2:                parseNum(params['SD']),
        xmax_mm:               parseNum(params['xmax'] ?? params['Linear excursion']),
        sensitivity_1m1w:      parseNum(params['SPL1W'] ?? params['Sensitivity']),
        power_watts:           parseNum(params['Pmax'] ?? params['Program power']),
        source:                'loudspeakerdatabase_scrape',
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
        console.log(`  ✓ ${record.manufacturer} ${record.model} [${driverType}]`);
      } catch (e) {
        console.error(`  SKIP ${record.manufacturer} ${record.model}:`, (e as Error).message);
        skipped++;
      }
    }
  }

  await context.close();
  await browser.close();
  console.log(`\nDone. Total: ${total}, inserted/updated: ${inserted}, skipped: ${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); });
