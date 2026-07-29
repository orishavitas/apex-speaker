# APEX Speaker — Repo & Code State Review

**Date:** 2026-07-29

## Executive Summary

The build is healthy at the mechanical level — TypeScript compiles clean, the production build succeeds, and the one existing test file passes in full — but that green surface is misleading because only one route out of fourteen has any test coverage at all, and the untested layer is exactly where the real defects live. The most serious problems are physics-correctness bugs in `web/lib/types/speaker-math.ts`: horn reference efficiency is computed 1000x too small (a unit mismatch, masked by a floor clamp so it always renders a flat 0.10%), and the sealed-box peak-dB formula is *inverted* — it reports +4.09 dB of peaking on a well-damped Qtc=0.8 box (true: +0.21 dB) and +0.22 dB on a boomy Qtc=1.5 box (true: +4.03 dB), with the two curves crossing at exactly Qtc=1.0. Two upload/parser paths (`web/app/api/upload/route.ts`, `web/lib/mappers/vxd-to-driver-insert.ts`) can throw uncaught TypeErrors on adversarial-but-legal input, leaving a partially-committed DB row behind. The confirmed, user-visible functional bug is the dead Pages-Router body-size config on the upload route — it does nothing in App Router, so there is no enforced upload limit in application code at all. Lint is the only failing gate (10 errors, mostly real React/Next correctness issues, not style noise), and several documentation files (TODO.md, CLAUDE.md working copy) have measurable drift from what the code actually does. Nothing here is a security breach or data-corruption event; the pattern is "silently wrong answers and dropped edits," not "broken app."

## Verified Gate Status

| Gate | Result | Detail |
|---|---|---|
| `vitest` | PASS (26/26) | Only one test file exists: `app/api/agents/design-wizard/route.test.ts`. No coverage for `lib/types/speaker-math.ts`, `lib/parser/*`, `lib/mappers/*`, or 13 of 14 API routes. |
| `tsc --noEmit` | PASS (exit 0) | Clean. |
| `next build` | PASS | 22 routes, 1 warning (vite-tsconfig-paths deprecation, see Repo Hygiene). |
| `eslint` | FAIL | 10 errors, 6 warnings. 8 errors are in live source: `chat/page.tsx:70` (refs), `projects/[id]/page.tsx:39` (raw `<a>`), `workspace/page.tsx:376/393/397` (set-state-in-effect), `workspace/page.tsx:588/657` (raw `<a>`), `landing-page.tsx:16` (set-state-in-effect). Remaining 2 errors are in archived `docs/wizard-sprint/versions/system-prompts.v2.ts`, which is not live code but is not excluded from lint scope. |

## Broken Features

Things a user (or an operator) would actually experience as broken, in order of how directly they touch the product.

1. **Upload size limit is not enforced anywhere.** `web/app/api/upload/route.ts:10` exports the Pages-Router-only `config = { api: { bodyParser: { sizeLimit: '10mb' } } }`. Next.js 16 App Router Route Handlers (`route.ts`) do not read this export at all — confirmed no other code in the file references `config`, and `next.config.ts` has no `serverActions.bodySizeLimit` or equivalent. There is also no manual `file.size` / `content-length` check in the handler before `file.text()` reads the whole upload into memory. **Why:** dead Pages-Router convention copy-pasted into an App Router file; nobody added the App Router equivalent. **Fix:** delete the dead `config` export; add an explicit `file.size > MAX_UPLOAD_BYTES` check returning 413 before `file.text()`.

2. **Horn designs always show a flat, meaningless 0.10% efficiency.** `web/lib/types/speaker-math.ts:207` computes reference efficiency with a liters-calibrated constant (`9.78e-10`) applied to Vas in cubic meters, producing a value ~1000x too small; the result then falls below the code's own floor clamp (`Math.max(eta_horn*100, 0.1)`, line 215) for every realistic input, so the UI always displays exactly 0.10% regardless of the actual driver/horn parameters. **Why:** unit mismatch — see Findings (critical). **Fix:** use Vas in liters for this formula, or use the SI-correct constant `9.783e-7` with Vas in m^3.

3. **Sealed-box "peak dB" warning is INVERTED — it reports high peaking on good alignments and near-zero on boomy ones.** `web/lib/types/speaker-math.ts:79` uses an incorrect closed-form formula for the resonant peak. Verified by brute-force numeric maximization of the actual 2nd-order highpass transfer function (`|H|² = ω⁴/((1-ω²)² + (ω/Q)²)`), the implemented formula *decreases* as Qtc rises, so it is not merely under-reporting — it is backwards:

   | Qtc | code reports | true peak |
   |---|---|---|
   | 0.8 | **+4.09 dB** | +0.21 dB |
   | 1.0 | +1.25 dB | +1.25 dB |
   | 1.2 | +0.56 dB | +2.41 dB |
   | 1.5 | **+0.22 dB** | +4.03 dB |
   | 2.0 | +0.07 dB | +6.30 dB |

   The two curves cross at exactly Qtc=1.0, which is why the bug can survive a casual spot-check at that one value. A user tuning a boomy Qtc=1.5 box is told the peak is +0.22 dB (benign) when it is really +4.03 dB; conversely a well-damped Qtc=0.8 box is flagged at +4.09 dB when it is really +0.21 dB. **Why:** wrong algebraic derivation — see Findings (high). **Fix:** replace with `20*log10(2*Qtc^2/sqrt(4*Qtc^2-1))`, keep the existing `Qtc > 1/sqrt(2)` onset gate (that part is already correct).

4. **Editing an enclosure/horn field and immediately clicking "change driver" or "import .vxp" silently drops the edit.** `web/app/dashboard/workspace/page.tsx:430` and `:657` use raw `<a href="...">` (no `next/link`) inside the same panel as live-editing controls; `use-design-state-persistence.ts:115` debounces saves by 800ms via `setTimeout`. A raw `<a>` forces a full page reload, which tears down the pending timer before the PATCH fires — no error is shown, the value just reverts on return. **Fix:** convert to `next/link`'s `<Link>`, and add a flush-on-navigate save path.

5. **A .vxp/.vxd upload containing a driver with a purely numeric or missing `name` attribute crashes the whole import batch, but leaves the parent project row committed.** `web/lib/mappers/vxd-to-driver-insert.ts:24` calls `raw._name.indexOf(' ')` with no guard; `fast-xml-parser`'s `parseAttributeValue: true` (`vituixcad-parser.ts:10`) coerces numeric-looking `name="8"` attributes to a JS number, and XML permits omitting the attribute entirely (making it `undefined`). Either case throws a TypeError that isn't caught until the generic 500 handler, by which point `web/app/api/upload/route.ts:66-75` has already inserted the `vituixcad_projects` row — so the project exists but zero of its drivers were imported, with a bare 500 and no partial-success message. **Fix:** `String(raw._name ?? '')` guard before any string method call; make the driver-insert loop per-item fault-tolerant instead of failing the whole array.

## Findings by Severity

### Critical

**1. Horn reference-efficiency formula is 1000x too small (unit mismatch: Vas in m^3 fed to a liters-calibrated constant)**
`web/lib/types/speaker-math.ts:207` — category: physics-error
`calcHornLoading` computes `eta_0 = (9.78e-10 * fs^3 * Vas_m3) / Qes`. The constant `9.78e-10` is the standard Thiele/Small reference-efficiency constant calibrated for Vas **in liters**; the SI-correct constant for Vas in m^3 is `4pi^2/c^3 ~= 9.783e-7` — exactly 1000x larger. For a realistic driver (fs=35Hz, Vas=40L, Qes=0.35) the correct efficiency is ~0.48%; the code computes ~0.00048%, which the floor clamp at line 215 (`Math.max(eta_horn*100, 0.1)`) then silently rounds up to a flat 0.10% for every horn design regardless of real parameters. Reachable from `app/dashboard/workspace/page.tsx:320` (HornResults component), rendered directly to the user.
**Fix:** pass Vas in liters (`ts.Vas_L`) into the `9.78e-10` formula, or switch the constant to `9.783e-7` when using Vas_m3. Add a unit test pinning eta_0 to ~0.1%-5% for a known reference driver, evaluated before the horn coupling multiplier and before the floor clamp.
**Verifier confidence:** high.

### High

**2. Sealed-box peak-dB formula uses the wrong closed-form expression (magnitude only — onset threshold is correct)**
`web/lib/types/speaker-math.ts:79` (gate at line 75-76) — category: physics-error
Code: `peak_dB = 20*log10(Qtc^2 / sqrt(Qtc^4 - 0.25))`. Correct closed form (confirmed via symbolic differentiation of the 2nd-order highpass transfer function): `peak_dB = 20*log10(2*Qtc^2 / sqrt(4*Qtc^2 - 1))`. At Qtc=1.2, correct is +2.41 dB vs code's +0.56 dB; at Qtc=1.5, correct is +4.03 dB vs code's +0.22 dB. **The error is directional, not just a magnitude offset:** independently verified by brute-force numeric maximization of `|H|² = ω⁴/((1-ω²)² + (ω/Q)²)`, the implemented expression *decreases* monotonically as Qtc rises while the true peak *increases* — the two agree only at Qtc=1.0, where they cross. So the bug also over-reports peaking below Qtc=1.0 (at Qtc=0.8 it claims +4.09 dB against a true +0.21 dB), not merely under-reports above it. See Broken Features #3 for the full table. **Important correction to an earlier read of this bug:** the existing onset gate `Qtc > 1/sqrt(2)` (line 75-76) is textbook-correct (standard Butterworth threshold) and must **not** be changed to `Qtc > 0.5` — a `Qtc > 0.5` threshold is a mathematical artifact with no real physical peak below `1/sqrt(2)`, confirmed by numeric sweep. Only the magnitude formula is wrong.
**Fix:** replace the formula with `20*Math.log10(2*Qtc*Qtc/Math.sqrt(4*Qtc*Qtc-1))`, keep the existing gate. Add reference-point tests: Qtc=1.0 -> +1.25dB, Qtc=1.2 -> +2.41dB, Qtc=1.5 -> +4.03dB.
**Verifier confidence:** high.

**3. Raw `<a>` tags force full page reloads, silently dropping unsaved edits inside the 800ms save-debounce window**
`web/app/dashboard/workspace/page.tsx:430, 657` (line 588 cited in original triage is an empty-state branch with no editable state, not a live instance) — category: correctness
No `next/link` import exists anywhere in the file. `use-design-state-persistence.ts:115` debounces saves by 800ms. A raw `<a>` click forces a hard navigation that aborts the pending `setTimeout` before the PATCH fires; no `beforeunload`/`sendBeacon`/flush safety net exists anywhere in the repo (grep confirmed zero hits).
**Fix:** replace the two live raw `<a>` instances with `next/link`'s `<Link>`; add a flush-pending-save call on navigation-intent clicks.
**Verifier confidence:** high.

**4. `vxdDriverToInsert` calls `.indexOf()`/`.slice()` on `raw._name` with no type or null guard — crashes on numeric-coerced or missing name attributes**
`web/lib/mappers/vxd-to-driver-insert.ts:24` — category: correctness *(this is one root cause with two failure triggers, merged from two originally-separate findings: numeric-coercion-via-fast-xml-parser, and a bare-missing-attribute case — both hit the identical unguarded line and produce the identical partial-write failure mode, so they are treated as a single finding here)*
`VxdDriverRaw._name` is typed as required `string`, but (a) `vituixcad-parser.ts:10` sets `parseAttributeValue: true`, which empirically coerces numeric-looking `name="8"` to a JS number, and (b) XML permits omitting the `name` attribute entirely, leaving it `undefined` — `parseVxd` (`vituixcad-parser.ts:37-53`) validates/defaults `PARAM` but never validates or defaults `_name`. Either case makes `raw._name.indexOf(' ')` throw. The uncaught throw propagates out of `drivers.map(vxdDriverToInsert)` (`app/api/upload/route.ts:83`), past a catch block that only special-cases the missing-`DATABASE_URL` error, to a generic 500 — after the parent `vituixcad_projects` row has already been committed (`route.ts:66-75`), leaving an inconsistent partial write (project exists, zero drivers imported).
**Fix:** `const name = String(raw._name ?? '')` guard before any string method; validate/normalize `_name` at parse time in `parseVxd` (mirroring its existing `PARAM` normalization); make the driver-insert loop tolerate and report per-item failures instead of aborting the whole batch.
**Verifier confidence:** high.

### Medium

**5. Ported-box port-velocity formula uses driver fs^2 instead of box tuning frequency fb — wrong chuffing-risk numbers whenever fs != fb**
`web/lib/types/speaker-math.ts:145` — category: physics-error
Code: `port_velocity_ms = (Sd_cm2 * Xmax_cm * fs_hz^2) / (port_area_cm2 * fb_hz) * 0.01`. Standard theory drives port velocity from the box tuning frequency: `v_port ~= 2*pi*fb*Xmax*Sd / S_port`. The code's own header comment (line 105) documents yet a *third*, different formula (`Qts * fs * Xmax * 100 / (port_area_cm2 * fb)`) than what's actually implemented — confirming this is an unintentional bug, not a deliberate simplification. Two designs with identical fb/Sd/Xmax/port area but different driver fs will get substantially different (and wrong) chuffing-risk warnings from `portVelocityWarning()` (`workspace/page.tsx:281`).
**Fix:** `port_velocity_ms = (2*Math.PI*fb_hz*Xmax_cm*Sd_cm2) / port_area_cm2 * 0.01` (unit-consistent variant); validate against a published reference design's port velocity figure.
**Verifier confidence:** high.

**6. Three POST handlers call `req.json()` with no try/catch — malformed body produces a generic 500 instead of a JSON 400**
`web/app/api/agents/design-wizard/route.ts:183`, `web/app/api/agents/manager/route.ts:40`, `web/app/api/agents/[domain]/route.ts:36` — category: correctness *(merged: same root cause — missing try/catch around `req.json()` — recurs identically in all three routes; also separately flagged as "no schema validation on body shape," which is the same underlying gap, not a distinct defect)*
Every other mutating route in the app (`design-state` PATCH, `upload` POST, `knowledge/search` POST) wraps body parsing in try/catch and returns a JSON error. These three do not, and additionally never validate `messages`/`projectId` shape before use — a malformed/empty JSON body throws a SyntaxError that escapes the handler uncaught.
**Fix:** wrap `req.json()` (or the whole handler body) in try/catch, returning `NextResponse.json({error: "Invalid request body"}, {status: 400})`, matching the existing convention in `design-state/route.ts`.
**Verifier confidence:** high.

**7. Upload route's dead Pages-Router size-limit config gives a false sense of a 10MB cap; no manual size check exists**
`web/app/api/upload/route.ts:10` — category: correctness
(Downgraded from the original "high" triage to medium: Vercel's platform-level function body-size ceiling still bounds the actual blast radius, even though the app-level check is entirely absent.) See Broken Features #1 for detail.
**Fix:** remove the dead `config` export; add an explicit `file.size` check with a 413 response.
**Verifier confidence:** high.

**8. system-prompts.ts tells the LLM to gate the wizard at 5 signals, contradicting the coded 4-of-6 threshold**
`web/lib/agents/system-prompts.ts:189, 197` (vs. correct statement at line 174) — category: correctness
`wizard-profile.ts`'s `isProfileComplete()` fires at `>= 4` of 6 signals, matching CLAUDE.md and matching line 174 of the prompt itself — but lines 189 and 197 separately instruct the model to wait for "5 or more signals." Since no server-side code force-fires the gate (the injected `profileComplete` boolean has no accompanying instruction telling the model to act on it), the prose is the only operative trigger, and it disagrees with the code-computed value.
**Fix:** make lines 189/197 consistent with line 174 (4 of 6), or better, replace the hardcoded number with "fire whenever the injected Profile complete state is true" so the prompt can't drift from `isProfileComplete()` again.
**Verifier confidence:** high.

**9. MonoInput forwards NaN (persisted as `null`) to design state when a number input is cleared or mid-edit**
`web/app/dashboard/workspace/page.tsx:134` — category: correctness
`onChange?.(parseFloat(e.target.value))` has no guard, unlike the sibling `netVolumeLiters` input (`page.tsx:471`) which already does `isNaN(v) ? null : v`. `JSON.stringify(NaN)` serializes to `null`; on reload, `HornResults`'s `!throatMm` check (line 306) treats `null` as "not set," silently replacing a previously-valid value with the empty placeholder — no error surfaced.
**Fix:** `const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange?.(v);`, matching the existing guarded sibling input; consider commit-on-blur instead of commit-on-keystroke.
**Verifier confidence:** high.

**10. Fragment shorthand `<>` used as `.map()` root has no key; the only key is on the inner `<tr>`**
`web/app/dashboard/drivers/page.tsx:174` — category: correctness
Shorthand fragments cannot carry a `key` prop; React has no key at the level it needs one (the array of fragments), producing a console warning and non-ideal reconciliation identity across sort/filter operations (can drop DOM-only state like scroll position or selection on reorder).
**Fix:** `<React.Fragment key={d.id}>...</React.Fragment>` (import `Fragment` from `react`).
**Verifier confidence:** high.

**11. `IngestOptions.fileName` is threaded through the whole ingest call chain and then silently discarded — no provenance column exists to store it anyway**
`web/lib/knowledge/upsert.ts:22` — category: data-loss
`fileName` is destructured and never used again; neither `sources` nor `knowledge_chunks` has a `file_name` column (only the unrelated `vituixcadProjects.fileName` exists). `scripts/ingest-conversations.ts:80-88` passes it believing it records provenance. Impact is narrow — `filePath` (full path) is the real dedup key — but two sources with colliding frontmatter `title` values become indistinguishable in any tool that displays only `title`.
**Fix:** either drop `fileName` from `IngestOptions` and its one caller, or add a `file_name` column and persist it.
**Verifier confidence:** high.

### Low

**12. Route params passed as raw strings into `eq()` against UUID columns — non-UUID input surfaces as a generic 500 instead of 400**
`web/app/api/drivers/[id]/route.ts:15` (and identically `web/app/api/projects/[id]/route.ts:16`) — category: correctness
Both `id` columns are genuine Postgres `uuid` columns (`schema.ts`); a non-UUID string throws a Postgres type error, caught only by a generic catch block that special-cases the missing-`DATABASE_URL` case.
**Fix:** validate `id` against a UUID regex/`z.string().uuid()` before querying in both routes, returning 400 on failure.
**Verifier confidence:** high.

**13. `[domain]/route.ts` reads `UIMessage.content` directly with no `parts[]` fallback — real defect, but currently dead code**
`web/app/api/agents/[domain]/route.ts:47, 107` — category: correctness
(Downgraded from medium to low on verification: no live caller reaches this route. `chat/page.tsx` and `workspace/page.tsx` only ever fetch `/api/agents/manager` or `/api/agents/design-wizard`; `manager/route.ts`'s `classifyDomain()` only alters its own prompt text and sets a response header — it never forwards to `[domain]/route.ts`. Grep-confirmed zero call sites for any `/api/agents/{acoustics|enclosure|...}` path anywhere in the repo.) The defect itself is real: `ChatMessage.content` (the outdated app-level type) would read as `undefined`/empty for a genuine AI SDK v6 `UIMessage`, if this route were ever wired up.
**Fix:** reuse the existing `parts[]`-aware text extraction already implemented in `manager/route.ts` (`getMsgText`) or `design-wizard/route.ts` (`extractText`), for both the `query` derivation and the `streamText` message mapping — cheap insurance before this route is ever connected.
**Verifier confidence:** high (on the code defect); high (on current unreachability).

**14. `HornConfig`'s declared type (`throat_area_cm2`/`mouth_area_cm2`) never matches what's actually stored (`throat_mm`/`mouth_mm`) — papered over by unsafe casts, not currently a functional bug**
`web/lib/types/speaker-domain.ts:62` — category: type-safety
The UI writer stores mm-diameter fields via an `as WaySlot['loading']` cast; the sole reader (`HornResults`, `workspace/page.tsx:302-328`) reads via `as unknown as Record<string, unknown>` and manually converts mm->area at render time before calling `calcHornLoading`. The round-trip works today only because writer and reader informally agree on the mm-based shape — this is a latent trap for future code that trusts the declared type without the escape hatch, not an active user-facing bug.
**Fix:** either rename `HornConfig`'s fields to the mm-based reality and move the mm->area conversion inside `calcHornLoading`, or keep area-based typing and convert at write time instead of read time, removing the `as unknown as` casts.
**Verifier confidence:** high.

**15. Ingest is not idempotent for path-only changes (rename/move without content change) — design gap, not a live-traffic bug**
`web/lib/knowledge/upsert.ts:28` — category: correctness
Keys exclusively on the literal `filePath` string with no content hash; renaming an already-ingested source file duplicates its chunks under a new `source_path` with no cleanup of the old rows. The only caller (`scripts/ingest-conversations.ts`) is a manually-run offline batch script, not part of any live request path — this requires a human to rename a file on disk and rerun `npm run ingest`.
**Fix:** lowest priority; add a content-hash column on `sources` (mirroring `vituixcadProjects.fileHash`), or a stale-row cleanup pass on full re-ingest.
**Verifier confidence:** high.

## Test Coverage Gap

Only **one** test file exists in the entire repo: `app/api/agents/design-wizard/route.test.ts` (26 passing tests). That leaves **13 of 14 API routes** and effectively all **23 lib modules** with zero automated coverage — including every pure-function physics module where three of the confirmed bugs above live undetected.

**Highest-value untested targets, in priority order:**

1. **`web/lib/types/speaker-math.ts`** — pure functions, zero coverage, contains the critical horn-efficiency bug, the high-severity sealed-box peak-dB bug, and the medium port-velocity bug. This is the single highest-leverage test target in the repo: these are deterministic, input->output pure functions with no I/O, trivially testable, currently silently wrong.
2. **`web/lib/parser/vituixcad-parser.ts` + `web/lib/mappers/vxd-to-driver-insert.ts`** — pure parsing/mapping functions, zero coverage, contains the confirmed crash-on-numeric-name and crash-on-missing-name bugs. Easy to fuzz with malformed/edge-case XML fixtures.
3. **`web/lib/agents/wizard-profile.ts`** — `profileConfidence()`/`isProfileComplete()` are the load-bearing gate logic referenced by CLAUDE.md as an invariant; currently only indirectly exercised via the one existing wizard route test.
4. **The 13 untested API routes**, especially `design-state` PATCH (the only other route with meaningful write logic) and `upload` (multi-step DB write with the partial-commit failure mode described above).

**Concrete test plan (prioritized):**
- Add `speaker-math.test.ts`: pin `calcHornLoading` reference efficiency for a known driver (fs=35Hz, Vas=40L, Qes=0.35) to the ~0.48% industry baseline; pin `calcSealedBox` peak_dB at Qtc=1.0/1.2/1.5 to +1.25/+2.41/+4.03 dB; pin `calcPortedBox` port velocity against a published reference design.
- Add `vxd-to-driver-insert.test.ts`: fixture with `name="8"` (numeric-coerced), fixture with missing `name` attribute entirely, assert no throw and a sane fallback value.
- Add `wizard-profile.test.ts`: table-test `profileConfidence()`/`isProfileComplete()` across 0-6 signal combinations, asserting the gate fires at exactly 4.
- Add a route-level smoke test for `upload/route.ts` covering the partial-commit scenario (malformed driver in an otherwise-valid `.vxd` file) to lock in whatever fix is applied for finding #4.

## Documentation Drift

- **Horn dimension persistence — contradictory completion status.** `TODO.md:79` claims "Horn dimension persistence: all MonoInput fields wired + diameter->area conversion" is DONE in Sprint 4-C, while `TODO.md:88` separately lists "Horn dimension fields full persistence" as an OPEN Sprint 4 candidate. **Which side is true:** persistence itself works at runtime (verified: `workspace/page.tsx:516-518` -> `onWayChange` -> `use-design-state-persistence.ts` -> PATCH, round-trips correctly today) and the mm->area conversion code does exist and run correctly (`workspace/page.tsx:316-317`, confirmed by `CHANGELOG.md` 2026-04-14 Sprint 4-C.2 entry). So line 79's *functional* claim is accurate. Line 88 is stale — it should be removed or reworded to describe the real remaining gap, which is the type-safety mismatch (finding #14 above: `HornConfig`'s declared fields never match what's stored), not missing persistence.
- **CLAUDE.md wizard-gate documentation is accurate; the system prompt is not.** CLAUDE.md's stated invariant ("gate fires at >= 4 of 6, experience_level excluded") exactly matches `wizard-profile.ts`'s implementation — no drift there. The drift is internal to the code itself: `system-prompts.ts` lines 189/197 disagree with the correct threshold stated at its own line 174 (see finding #8). CLAUDE.md is not wrong; the LLM-facing prompt text is.
- **PLANNING.md status framing is stale but not load-bearing.** `PLANNING.md:4-5` marks Phase 5 "(retroactive — Phases 1-4 complete, Phase 5 deploy pending)" while `TODO.md:5` and `CLAUDE.md` both confirm production has been live since an earlier sprint. Doesn't affect execution, just reduces confidence in doc currency — worth a cleanup pass but not urgent.
- **CLAUDE.md working copy lost significant navigational content** relative to what a "read this first" file should contain (opening banner, full Phase/Sprint status table, Key Files index, Next Steps/Wishlist sections — see `git diff CLAUDE.md`, -142 lines net). This is a real regression in new-session onboarding quality, distinct from the checked-in project CLAUDE.md shown in this session's context (which is the condensed version already). Recommend restoring a status table and key-files index rather than leaving it condensed indefinitely.

## Repo Hygiene

- **21 untracked screenshot PNGs** (`step1-chat-page.png` ... `turn4-sound-sig.png`) at repo root — browser-automation debris, not covered by `.gitignore`. Should be deleted and a `*.png` (or more targeted) pattern added, unless intentionally kept as review evidence in a dedicated `artifacts/` path.
- **`.playwright-mcp/` untracked directory** (40+ console/page dumps) — not covered by `.gitignore`. Add a `.playwright-mcp/` ignore pattern.
- **`docs/knowledge_base/`, `docs/wizard-sprint/`, `docs/superpowers/plans/2026-04-04-unblock-production.md` untracked** — unclear whether these are generated/session-scratch or intentional reference material; currently floating untracked either way. Needs an explicit decision (commit or ignore), not left ambiguous.
- **`.agent-harness/logs/vault-ingest.ndjson` is tracked and modified every session** — an append-only event log that changes on every run. Should be `.gitignore`'d (pattern: `.agent-harness/logs/`); the vault itself already retains this data.
- **`.claude/settings.local.json` is tracked** (currently showing a +75 line diff) — the `.local.json` suffix is the project's own convention for machine-local overrides; tracking it forces sync of one machine's local Bash-allowlist/plugin-path decisions onto all collaborators. Should be `.gitignore`'d.
- **ESLint has no exclusion for `docs/`** — `docs/wizard-sprint/versions/system-prompts.v2.ts` (an archived snapshot, not live code) contributes 2 of the reported 10 lint errors, inflating the apparent live-code lint-failure count. Add a `docs/` ignore pattern to `eslint.config.mjs`.
- **Build warning: `vite-tsconfig-paths` plugin is redundant** — Vite/Vitest now supports `resolve.tsconfigPaths: true` natively; the explicit plugin in `vitest.config.ts` triggers a deprecation warning on every test run. Low-effort cleanup.
- **No `typecheck` or `lint:fix` npm scripts** — `package.json` only exposes `dev`/`build`/`start`/`lint`/`test`. Minor DX gap for CI/pre-commit convenience; not a defect.
- **Clean, confirmed-fine:** all `package.json` script file references resolve to real files on disk; no deprecated packages in core dependencies (Next 16.2.1, React 19.2.4, ai@6.0.138, drizzle-orm@0.45.2 all current); all 14 API routes export the correct HTTP methods with no orphans; all queried schema tables exist and are correctly referenced (the one apparent exception, `conversations`, is a defined-but-never-queried table — dead schema, not a bug, worth a decision on whether to wire it up or drop it).

## Refuted Findings

Findings that did not survive verification — included to show what was checked and cleared, not just what was confirmed.

1. **"Specialist agent route reads only `UIMessage.content` — RAG context and message text silently empty" (claimed high).** The code defect at `[domain]/route.ts:47/107` is real (folded into finding #13 above at low severity), but the claim that this breaks the live chat experience is false: no caller anywhere in the app — not the frontend, not `manager/route.ts`, not `design-wizard/route.ts` — ever invokes `/api/agents/[domain]` or any specific domain path. It is unreachable dead code today, so the "high, user-facing" framing does not hold; downgraded and merged as a low-severity latent defect instead.
2. **"`projects/[id]/route.ts` queries `vituixcadProjects`, not the `projects` table — misleading route name/shape" (claimed low).** The code fact is true, but there is exactly one real caller (`app/dashboard/projects/[id]/page.tsx`), and every field it destructures (`fileName`, `fileType`, `parsedData`, `id` as `vxProjectId`) is a `vituixcadProjects` column, not a `projects`-table column. The consuming page is itself a VituixCAD-file viewer, not a generic project-metadata page — so the "hypothetical developer expecting projects-table fields" scenario has no real analog in this app. This is a naming inconsistency, not a functional bug with any actual failure scenario; refuted as a live defect.

## Prioritized Fix Queue

Ordered by (user impact x confidence) / effort.

1. **Fix horn reference-efficiency unit bug** — `web/lib/types/speaker-math.ts:207`. Effort: **S**. Every horn design currently shows a meaningless flat 0.10% efficiency; one-line constant/unit fix plus a pinning test.
2. **Fix sealed-box peak-dB formula** — `web/lib/types/speaker-math.ts:79`. Effort: **S**. Wrong-by-multiple-dB bass-hump warnings on every underdamped sealed alignment; one-line formula fix, keep existing gate threshold, add reference-point tests.
3. **Guard `raw._name` in the VXD driver mapper** — `web/lib/mappers/vxd-to-driver-insert.ts:24`, plus per-item fault tolerance in `web/app/api/upload/route.ts:83`. Effort: **S**. Prevents a crash-with-partial-DB-write on legal-but-adversarial upload input.
4. **Remove dead upload size-limit config and add a real check** — `web/app/api/upload/route.ts:10`. Effort: **S**. Closes the "no enforced upload limit in app code" gap; add `file.size` check + 413 response.
5. **Fix port-velocity formula** — `web/lib/types/speaker-math.ts:145`. Effort: **S**. Wrong chuffing-risk numbers whenever fs != fb; formula swap plus a reference-design test.
6. **Replace raw `<a>` tags with `next/link`, add save-flush on navigate** — `web/app/dashboard/workspace/page.tsx:430, 657` and `web/app/dashboard/projects/[id]/page.tsx:39`. Effort: **M**. Fixes silent data loss on a common navigation pattern; also clears 3 of the 8 live lint errors.
7. **Add try/catch around `req.json()` in the three agent POST routes** — `design-wizard/route.ts:183`, `manager/route.ts:40`, `[domain]/route.ts:36`. Effort: **S**. Brings error-handling in line with the rest of the codebase's convention.
8. **Reconcile wizard gate threshold in system prompt** — `web/lib/agents/system-prompts.ts:189, 197`. Effort: **S**. Removes an unnecessary extra conversational turn; tie prompt text to the injected `profileComplete` boolean instead of a hardcoded number.
9. **Guard `MonoInput`'s `onChange` against NaN** — `web/app/dashboard/workspace/page.tsx:134`. Effort: **S**. Mirrors the existing guarded sibling input (`page.tsx:471`); prevents silent wipe of valid user-entered values.
10. **Write the physics test suite** — new `speaker-math.test.ts`, `vxd-to-driver-insert.test.ts`, `wizard-profile.test.ts`. Effort: **M**. This is what would have caught findings #1, #2, #5, and #4 before merge; highest structural ROI in the whole queue.
11. **Fix fragment key on drivers list** — `web/app/dashboard/drivers/page.tsx:174`. Effort: **S**. Clears a React console warning and improves reconciliation correctness on sort/filter.
12. **Add UUID validation to `[id]` routes** — `web/app/api/drivers/[id]/route.ts:15`, `web/app/api/projects/[id]/route.ts:16`. Effort: **S**. Converts an opaque 500 into a proper 400 for malformed identifiers.
13. **Repo hygiene pass** — extend `.gitignore` for `*.png` debris, `.playwright-mcp/`, `.agent-harness/logs/`, `.claude/settings.local.json`; decide commit-vs-ignore for `docs/knowledge_base/` and `docs/wizard-sprint/`; exclude `docs/` from ESLint scope. Effort: **S**. No functional impact, but cheap and removes noise from every future `git status`/lint run.
14. **Resolve TODO.md horn-persistence contradiction (line 79 vs 88)** and reconcile `HornConfig`'s type with its actual stored shape — `TODO.md:79,88`, `web/lib/types/speaker-domain.ts:62`. Effort: **M**. Documentation clarity plus closing the type-safety gap (finding #14) so future refactors don't trust a type that was never true.
15. **Drop `vite-tsconfig-paths` in favor of native `resolve.tsconfigPaths`** — `vitest.config.ts`. Effort: **S**. Removes a build warning; cosmetic.
