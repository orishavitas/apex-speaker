# Wizard Sprint v2 — Executive Brief
**Date:** 2026-04-06 | **Method:** code-review-swarm | **Commit:** 4e2b4fa

---

## TL;DR

5 specialist reviewer agents audited the Wizard Sprint v2 code. Found 20 bugs. Fixed 18. Root cause of the production `X-Wizard-Profile {}` bug identified and resolved — it was never a regex issue. The Vercel serverless function was tearing down before the DB write completed.

---

## What We Found

### The Real Bug (X-Wizard-Profile returns `{}`)

Three compounding causes, all fixed:

1. **`onFinish` race condition (Critical)** — `streamText`'s `onFinish` callback fires after the HTTP response is already returned. Vercel serverless functions do not guarantee the runtime stays alive after the response body closes. `writeMemory()` was silently skipped on nearly every request. **Fix:** wrapped in `after()` from `next/server` — the official Vercel API for extending function lifetime.

2. **Wrong memory row loaded (High)** — `readMemory()` returned the most-recently-updated row for the domain, regardless of key. Any other agent_memory write for `design_wizard` would poison the profile read. **Fix:** filter by `key === 'wizard_profile'`.

3. **Null content crash (Medium)** — `m.content.toLowerCase()` in `parseSignalsFromMessages` threw an uncaught TypeError on messages with undefined content, crashing signal extraction outside the try/catch. Profile stayed empty `{}`. **Fix:** `(m.content ?? '').toLowerCase()`.

---

## Security Findings (2 High)

**Prompt injection** — Extracted profile signals (use_case, placement, room_size, etc.) were injected verbatim into the LLM system prompt without validation. A crafted user message containing adversarial text would end up in the system prompt. **Fixed:** all 7 fields validated against closed enum allowlists before injection.

**PII in production logs** — Debug `console.log` statements added during the `{}` investigation were logging raw user message content to Vercel function logs on every request. **Fixed:** gated behind `NODE_ENV !== 'production'`.

*Note: SEC-2 (no auth on the wizard endpoint — IDOR via user-controlled projectId) is real but deferred. APEX is a personal single-user tool; auth is Phase 6 scope.*

---

## Data Integrity Findings (2 High)

**Non-atomic upsert** — `writeMemory` used a SELECT → INSERT/UPDATE pattern without a transaction. Two concurrent requests (user sends a second message before the first stream completes) could both read "no existing row" and both INSERT, crashing on a duplicate key. The error was silently swallowed. **Fixed:** `db.transaction()`.

**Budget update blocked** — The budget guard `budget_low === undefined && budget_high === undefined` was so broad it prevented any re-extraction once either field was set. A user correcting their budget mid-conversation was silently ignored. **Fixed:** `||` instead of `&&`.

---

## Logic Findings (3 Medium)

- **`experience_level` write-once** — Was locked to whatever the first message scored. Now computes the running ceiling across all messages.
- **Signal extraction TypeError** — `m.content` null guard (above, root cause section).
- **Silent header parse failure** — `JSON.parse` on the wizard profile header failed silently. WizardPane stayed blank with no feedback. Now `console.warn`s with the raw value.

---

## Code Quality (Low)

| Fix | Impact |
|-----|--------|
| `experience_level` stripped in two places → `stripPrivateFields()` helper | Future private fields only need one edit |
| `EXPERT_TERMS` arrays inside message loop → module constants | Allocated once, not per-message |
| `WIZARD_PROMPT` duplicate string literal → use the constant | Can't silently diverge |
| `wizardProfile` state typed as `WizardProfile \| null` → removed `as` casts | TypeScript safety restored |
| `BASE_CONTEXT` added to design_wizard prompt | Consistent with all 8 other agents |

---

## Tests Added

26 Vitest tests in `web/app/api/agents/design-wizard/route.test.ts`:
- Budget range extraction (`$500–$800` → both bounds)
- Single budget extraction (`$500` → budget_low)
- False-positive guard (bare numbers without `$` — current behavior documented)
- Placement detection
- Experience level scoring (expert vs beginner vocabulary)
- `stripPrivateFields()` helper

Run with: `cd web && npm test`

---

## What's Still Open

| Item | Why Deferred |
|------|-------------|
| SEC-2: No auth on `/api/agents/design-wizard` | Single-user personal tool; Phase 6 auth sprint |
| FE-4: Per-message domain badge | AI SDK doesn't expose message ID at fetch time |
| LLM echoing `## Current profile state` block | One-line prompt fix, not reviewed yet |
| Budget regex false positives | Bare numbers match without `$` sign — needs regex tightening |
| `experience_level` counted in 5-signal completion gate | Auto-inferred field inflates completion score |

---

## Next Action

Push (`git push`) → Vercel auto-deploy → send "Help me design a speaker from scratch →" in chat → inspect `X-Wizard-Profile` response header. Should now contain populated JSON instead of `{}`.
