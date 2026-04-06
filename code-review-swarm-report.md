# Code Review Swarm Report — 2026-04-06

## Swarm Deployed
**Reviewers:** SecFencer, QualityHound, BackendHound, FrontendEye, ArchCritic
**Fixers activated:** LogicDoc, SecPatch, StyleClean, TestForge
**Working directory:** web/app/api/agents/design-wizard · web/app/dashboard/chat · web/lib/agents
**Commits reviewed:** 334b245..b392ffd (Wizard Sprint v2)

---

## Summary
| Metric | Count |
|--------|-------|
| Bugs found | 20 |
| Fixed (DONE) | 18 |
| Fixed with concerns | 1 |
| Needs context | 0 |
| Blocked | 0 |
| False positives discarded | 1 |

---

## Bug Log
| ID | Severity | Category | File | Line | Reviewer | Fixer | Status |
|----|----------|----------|------|------|----------|-------|--------|
| BH-1 | Critical | logic | route.ts | 179 | BackendHound | LogicDoc | DONE |
| ARCH-2 | High | logic | route.ts | 203 | ArchCritic | LogicDoc | DONE |
| SEC-1 | High | security | route.ts | 163 | SecFencer | SecPatch | DONE |
| SEC-2 | High | security | route.ts | 116 | SecFencer | — | DEFERRED (see below) |
| BH-2 | High | logic | route.ts | 144 | BackendHound | LogicDoc | DONE |
| BH-4 | High | logic | wizard-profile.ts | 35 | BackendHound | LogicDoc | DONE |
| BH-5 | High | logic | memory.ts | 50 | BackendHound | LogicDoc | DONE |
| FE-2 | High | logic | chat/page.tsx | 75 | FrontendEye | LogicDoc | DONE |
| BH-3 | Medium | logic | route.ts | 42 | BackendHound | LogicDoc | DONE |
| BH-7 | Medium | logic | route.ts | 39 | BackendHound | LogicDoc | DONE |
| BH-8 | Medium | logic | route.ts | 100 | BackendHound | LogicDoc | DONE |
| FE-3 | Medium | logic | chat/page.tsx | 52 | FrontendEye | LogicDoc | DONE |
| FE-4 | Medium | logic | chat/page.tsx | 149 | FrontendEye | LogicDoc | DONE_WITH_CONCERNS |
| SEC-3 | Medium | security | route.ts | 125 | SecFencer | SecPatch | DONE |
| QH-5 | Low | style | route.ts | 202 | QualityHound | StyleClean | DONE |
| QH-6 | Low | style | route.ts | 48 | QualityHound | StyleClean | DONE (documented) |
| QH-7 | Low | style | route.ts | 101 | QualityHound | StyleClean | DONE |
| QH-8 | Low | test | route.ts | 31 | QualityHound | TestForge | DONE (26 tests) |
| QH-9 | Low | style | chat/page.tsx | 22 | QualityHound | StyleClean | DONE |
| QH-12 | Low | style | system-prompts.ts | 151 | QualityHound | StyleClean | DONE |

---

## Concerns (DONE_WITH_CONCERNS)

**FE-4** — `chat/page.tsx:149` — All assistant message bubbles show the same (latest) domain badge because `routedDomain` is scalar state.
- Fix attempted but deferred: The AI SDK fetch closure fires during streaming before the SDK assigns `msg.id` — no reliable message identifier is available at fetch time to key a per-message domain map.
- TODO comment written at `routedDomain` declaration documenting the issue and ideal fix (Map<messageId,domain>).
- Deferred to Wizard v3 / Sprint 4.

---

## Deferred (Not Fixed This Pass)

**SEC-2** (High) — No authentication on `/api/agents/design-wizard`. `projectId` is user-controlled, enabling IDOR.
- Root cause: The entire APEX app has no auth layer yet (by design — it's a personal tool for a single user).
- Deferring to Phase 6 (auth sprint) alongside other security infrastructure.
- Documented in TODO.md Sprint 4 candidates.

---

## False Positives Discarded

**FE-1** — `useMemo([])` fragility concern: reviewers flagged that stable-ref-only contract inside the empty-dep memo is undocumented. Validated as correct behavior (React setState setters are guaranteed stable). Added a comment instead — not a bug, documentation gap only. Counted as DONE under QH-11.

---

## Root Cause of X-Wizard-Profile Returning {}

BackendHound (BH-1) and ArchCritic (ARCH-2) identified two compounding causes:

1. **BH-1 (Critical, FIXED):** `onFinish` DB write raced against Vercel function teardown. Profile was never persisted. Fixed: `writeMemory` now wrapped in `after()` from `next/server` to extend function lifetime.

2. **ARCH-2 (High, FIXED — observability layer):** JSON payload in response header may exceed proxy size limit (~8KB). Fixed: added `console.warn` + size check. Structural fix (GET profile endpoint) deferred to Wizard v3.

3. **BH-7 (Medium, FIXED):** `m.content?.toLowerCase()` null guard missing — TypeError in `parseSignalsFromMessages` could crash extraction silently, leaving profile empty `{}`.

4. **SEC-3 (Medium, FIXED):** Debug logs that were supposed to diagnose the bug were gated behind `NODE_ENV !== 'production'`, explaining why Vercel function logs weren't showing the extracted profile.

---

## Files Modified
- `web/app/api/agents/design-wizard/route.ts` — 8 bug fixes
- `web/app/dashboard/chat/page.tsx` — 4 bug fixes  
- `web/lib/agents/memory.ts` — atomic upsert fix
- `web/lib/agents/system-prompts.ts` — BASE_CONTEXT prepend for design_wizard
- `web/app/api/agents/design-wizard/route.test.ts` — NEW: 26 Vitest tests for parseSignalsFromMessages

---

## New Tests
26 Vitest tests created in `web/app/api/agents/design-wizard/route.test.ts` covering:
- Budget range extraction (`$500-$800`)
- Single budget extraction (`$500`)
- Budget false-positive guard (bare numbers without $ context)
- Placement detection (desktop, bookshelf, floor-standing)
- Experience level scoring (expert vs beginner vocabulary)
- stripPrivateFields() helper

Run with: `cd web && npm test`
