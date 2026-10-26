# Result: bug-08-wizard-gate
**Executor:** Codex
**Completed:** 2026-07-29 22:54 +03:00
**Status:** completed

---
## Summary
Updated the design-wizard system prompt so the confirmation gate text consistently says 4 signals, matching the existing 4-of-6 gate in code. The root cause was prompt copy drift: two later prompt instructions still described an older 5-signal threshold while the canonical line 174 and `isProfileComplete()` already used 4.
---
## Changed Files
- `web/lib/agents/system-prompts.ts` — changed the refusal/skip and confirmation-gate prompt text from 5 signals to 4 signals.
---
## Commands Run
```bash
cd web && npx vitest run
cd web && npx tsc --noEmit
cd web && npx eslint
cd web && npx eslint lib/agents/system-prompts.ts
git add web/lib/agents/system-prompts.ts
git commit -m "fix(wizard): align prompt gate threshold"
```
---
## Results
Vitest passed with 1 test file passed and 26 tests passed; raw output is saved in `.agent-harness/artifacts/bug-08-wizard-gate/test_results.txt`. `npx tsc --noEmit` returned a pre-existing type issue in `web/docs/wizard-sprint/versions/system-prompts.v2.ts` for missing `./types`, outside the locked scope. Full `npx eslint` returned pre-existing lint issues in dashboard, landing, docs, knowledge, and speaker math files outside the locked scope; scoped ESLint for `lib/agents/system-prompts.ts` passed cleanly.
---
## Risks
The prompt-only fix was verified by the wizard test suite and changed-file linting, but full repo TypeScript and full repo ESLint remain blocked by unrelated existing issues outside the allowed edit scope. The wizard was not manually smoke-tested in a browser during this pass.
---
## Follow-ups
- [ ] Address the existing full-repo TypeScript and ESLint issues in a separate task.
---
## monday Update
Codex fixed bug-08-wizard-gate by aligning the design-wizard prompt instructions with the existing coded gate: both later prompt references now say the confirmation gate can fire at 4 signals instead of 5. Vitest passed with 26 tests, and scoped lint for the changed prompt file passed; full TypeScript and full ESLint still report unrelated pre-existing issues outside this packet's locked scope.
---
## Wiki Updates Needed
- none
