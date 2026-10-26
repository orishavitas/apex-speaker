# Unblock Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore all agent chat functionality in production and populate the driver database with properly-typed drivers (woofer/tweeter/midrange/subwoofer).

**Architecture:** Task 1 adds ANTHROPIC_API_KEY to Vercel env vars and redeploys — no code changes needed. Task 2 runs the already-written Playwright scraper against loudspeakerdatabase.com to import ~400 drivers across 10 brands, then verifies type diversity in the DB.

**Tech Stack:** Vercel CLI, @ai-sdk/anthropic, Playwright, Neon PostgreSQL, tsx

---

### Task 1: Add ANTHROPIC_API_KEY to Vercel and redeploy

**Files:**
- No code changes — env var addition + redeploy only

**Context:**
- Vercel project: `orishavitas-projects/web`
- Production URL: https://web-blue-theta-12.vercel.app
- The agents already use `anthropic("claude-sonnet-4.6")` from `@ai-sdk/anthropic` — the key just needs to be present at runtime

- [ ] **Step 1: Verify ANTHROPIC_API_KEY exists locally**

Run:
```bash
grep ANTHROPIC_API_KEY .env.local
```
Expected: a line like `ANTHROPIC_API_KEY=sk-ant-api03-...`

If missing — the user must supply the key from https://console.anthropic.com/settings/keys

- [ ] **Step 2: Add key to Vercel production environment**

Run:
```bash
echo "$ANTHROPIC_API_KEY" | npx vercel env add ANTHROPIC_API_KEY production
```
When prompted for value, paste the key. Select "production" environment.

If the env var already exists:
```bash
npx vercel env rm ANTHROPIC_API_KEY production
echo "$ANTHROPIC_API_KEY" | npx vercel env add ANTHROPIC_API_KEY production
```

- [ ] **Step 3: Also add to preview environment**

```bash
echo "$ANTHROPIC_API_KEY" | npx vercel env add ANTHROPIC_API_KEY preview
```

- [ ] **Step 4: Redeploy to pick up the new env var**

```bash
npx vercel --prod
```

Expected output ends with:
```
Aliased: https://web-blue-theta-12.vercel.app
```

- [ ] **Step 5: Smoke test — hit the manager agent**

```bash
curl -s -X POST https://web-blue-theta-12.vercel.app/api/agents/manager \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"what is Qts?"}]}' \
  --max-time 30 | head -c 300
```

Expected: streaming text chunks starting with `0:"` or `f:{"messageId"` — NOT `{"error":"..."}`.

- [ ] **Step 6: Smoke test — hit the design wizard**

```bash
curl -s -X POST https://web-blue-theta-12.vercel.app/api/agents/manager \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"__WIZARD_TRIGGER__ Help me design a speaker."}]}' \
  --max-time 30 | head -c 300
```

Expected: streaming text chunks — NOT an error.

---

### Task 2: Run Playwright scraper to populate driver database

**Files:**
- Run only: `web/scripts/scrape-loudspeakerdb-playwright.ts` (already written)
- Verify with: `web/scripts/check-driver-count.ts` (already written)

**Context:**
- Script already handles: User-Agent spoofing, 3s+jitter delay, 3-attempt retry with 10s/20s backoff
- Type classification fixed: reads `a.type-ribbon[href]` → maps to woofer/tweeter/midrange/subwoofer/fullrange
- Default brands: ScanSpeak, Seas, Dayton, Peerless, Wavecor, Morel, Purifi, Accuton, Vifa, Tang_Band
- Runtime estimate: ~40-60 min for all 10 brands (~400 drivers at 3-4s each)
- DB upserts: `ON CONFLICT (manufacturer, model) DO UPDATE` — safe to re-run

- [ ] **Step 1: Verify DB connection works**

```bash
NODE_OPTIONS="-r dotenv/config" DOTENV_CONFIG_PATH=.env.local npx tsx scripts/check-driver-count.ts
```

Expected: prints total driver count and breakdown by type. If error → check `.env.local` has `DATABASE_URL`.

- [ ] **Step 2: Run scraper for one brand first (verification)**

```bash
NODE_OPTIONS="-r dotenv/config" DOTENV_CONFIG_PATH=.env.local npx tsx scripts/scrape-loudspeakerdb-playwright.ts --brands=Seas 2>&1 | tee /tmp/scrape-seas.log
```

Expected output sample:
```
→ Seas
  Found N drivers
  ✓ Seas Excel W22EX001 [woofer]
  ✓ Seas Prestige H1499 [tweeter]
  ...
Done. Total: N, inserted/updated: N, skipped: M
```

Key check: types must NOT all be `[fullrange]` — must see `[woofer]`, `[tweeter]`, `[midrange]`.

- [ ] **Step 3: Check DB after single-brand run**

```bash
NODE_OPTIONS="-r dotenv/config" DOTENV_CONFIG_PATH=.env.local npx tsx scripts/check-driver-count.ts
```

Expected: woofer, tweeter, midrange counts > 0 in "By type" breakdown.

- [ ] **Step 4: Run full import for all 10 brands**

```bash
NODE_OPTIONS="-r dotenv/config" DOTENV_CONFIG_PATH=.env.local npx tsx scripts/scrape-loudspeakerdb-playwright.ts 2>&1 | tee /tmp/scrape-full.log
```

This takes ~40-60 minutes. Let it run. Watch for the final line:
```
Done. Total: ~400, inserted/updated: ~300, skipped: ~100
```

Skips are expected (rate-limit failures even after retry) — anything above 50% success rate is acceptable.

- [ ] **Step 5: Verify type diversity in DB**

```bash
NODE_OPTIONS="-r dotenv/config" DOTENV_CONFIG_PATH=.env.local npx tsx scripts/check-driver-count.ts
```

Expected "By type" breakdown includes:
- `woofer`: > 50
- `tweeter`: > 20
- `midrange`: > 10
- `subwoofer`: > 5
- `fullrange`: some (legitimate full-range drivers exist)

- [ ] **Step 6: Commit scraper changes**

```bash
git add scripts/scrape-loudspeakerdb-playwright.ts package.json package-lock.json
git commit -m "feat: Playwright scraper for loudspeakerdatabase.com with proper type classification"
```

- [ ] **Step 7: Playwright self-check on live driver DB page**

```bash
npx tsx -e "
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ headless: true });
  const p = await b.newPage();
  await p.goto('https://web-blue-theta-12.vercel.app/dashboard/drivers');
  await p.waitForTimeout(3000);
  const types = await p.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('td'));
    return [...new Set(cells.map(c => c.textContent?.trim()).filter(t => ['woofer','tweeter','midrange','subwoofer','fullrange'].includes(t ?? '')))];
  });
  console.log('Driver types visible on page:', types);
  await b.close();
})();
"
```

Expected: `Driver types visible on page: [ 'woofer', 'tweeter', 'midrange', ... ]`

---

## Done Criteria

- [ ] `curl` to `/api/agents/manager` returns streaming text (not error)
- [ ] `curl` with `__WIZARD_TRIGGER__` returns streaming text (not error)
- [ ] DB has woofer/tweeter/midrange/subwoofer types with counts > 0
- [ ] Live driver DB page shows type diversity
