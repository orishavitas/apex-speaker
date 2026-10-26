# Review: bug-08-wizard-gate
**Reviewer:** Claude (Evaluator)
**Reviewed:** 2026-07-29
**Task type:** bug_fix

---

## Verdict
NEEDS_CHANGES

---

## Criteria Results

| Criterion | Result | Notes |
|---|---|---|
| Line 189: "5 signals" -> "4 signals" | PASS | Confirmed in worktree working tree at `web/lib/agents/system-prompts.ts:189` — reads "...once you have 4 signals even if some are marked flexible." |
| Line 197: "5 or more signals" -> "4 or more signals" | PASS | Confirmed at `web/lib/agents/system-prompts.ts:197` — reads "Once you have 4 or more signals, fire the confirmation gate." |
| Line 174 left unchanged | PASS | Still reads "You need 4 of the 6 user-provided signals..." — untouched, matches finding instruction not to alter it. |
| `wizard-profile.ts` left unchanged | PASS | `git diff` against master for this file is empty in the worktree. |
| Fix scoped only to files in finding | FAIL | `.claude/settings.local.json` modified with 108 unrelated inserted lines (permission-list/tooling accumulation) — out of scope for a prompt-text fix. Untracked `.agent-harness/` and `web/.npm-cache/` also present in the worktree, though these are less concerning than the settings file edit. |
| Work actually committed | FAIL | `git log --oneline master..task/bug-08-wizard-gate` and `git diff master...task/bug-08-wizard-gate --stat` both return empty — the branch has zero commits ahead of its base. The fix exists ONLY as an uncommitted working-tree modification. Nothing has actually been delivered/landed on this branch. |
| Live test run (vitest/tsc/eslint) | PARTIAL | Worktree's `node_modules` is corrupted (`rolldown-binding.win32-x64-msvc.node is not a valid Win32 application`, `vitest` binary altogether missing) — `npx vitest run` fails to even start in the worktree. Independently ran the identical diff against the main repo's healthy install: `npx tsc --noEmit` clean, `npx vitest run` 26/26 passing (pre-existing suite; none assert on this prompt string, so this is a non-regression check only, not a targeted pass for the fix itself). |
| Outbox result file exists | FAIL | `.agent-harness/outbox/bug-08-wizard-gate.result.md` does not exist anywhere in the repo (checked main repo and both active worktrees). |
| Artifacts/test_results.txt valid | FAIL | `.agent-harness/artifacts/bug-08-wizard-gate/test_results.txt` is not test output — it is a captured PowerShell/npm `EPERM` crash log ("npm error code EPERM ... FetchError: Invalid response body while trying to fetch https://registry.npmjs.org/vitest") proving vitest never ran successfully. This is placeholder/garbage evidence, not a real test result. |
| Implementer self-report coherent | FAIL | Self-reported output is unrelated to this task: "I'll stop issuing no-op commands and simply wait for the notification about the real background task `bgde5nehm` to arrive." Does not describe the fix, root cause, or verification in any way. |

---

## Defects

1. **No commit exists on `task/bug-08-wizard-gate`.** `git log --oneline master..task/bug-08-wizard-gate` is empty; `git diff master...task/bug-08-wizard-gate --stat` is empty. The correct prompt-text fix is present only as an uncommitted working-tree edit in the worktree at `.claude/worktrees/wf_bc52feb5-977-1`. Nothing has actually landed on the branch.
2. **Scope expansion:** `.claude/settings.local.json` was modified with ~108 unrelated inserted lines (permission allowlist entries from unrelated sessions/tooling) in the same working tree as the fix. This file is not named in the finding's scope.
3. **Missing writeback contract:** `.agent-harness/outbox/bug-08-wizard-gate.result.md` does not exist anywhere in the repo (main or either worktree) — required deliverable per harness contract is absent, and the requirement that it contain the phrase "root cause" cannot be checked because the file doesn't exist.
4. **Invalid/garbage test evidence:** `.agent-harness/artifacts/bug-08-wizard-gate/test_results.txt` contains an npm `EPERM` failure trace (vitest could not be fetched/installed), not actual test output. This does not satisfy "test output, verification logs" as required evidence.
5. **Incoherent self-report:** the implementer's reported completion message is about an unrelated background task ID and does not describe this fix, its root cause, or any verification performed.

---

## Recommendation

Do not merge/advance this task yet. Required before re-review:
1. Commit the working-tree fix (`web/lib/agents/system-prompts.ts` lines 189 and 197 only) to `task/bug-08-wizard-gate` with a clear message referencing the root cause (prompt text said "5 or more"/"5 signals," contradicting line 174 and the coded gate `profileConfidence(p) >= 4` in `wizard-profile.ts`).
2. Revert the unrelated `.claude/settings.local.json` changes from this branch/worktree — out of scope.
3. Repair the worktree's `node_modules` (reinstall cleanly; current install has a broken native binding for `rolldown` and is missing the `vitest` binary) and produce a real, passing `npx vitest run` / `npx tsc --noEmit` output as evidence.
4. Write `.agent-harness/outbox/bug-08-wizard-gate.result.md` containing the phrase "root cause" and an accurate description of the change, plus regenerate `.agent-harness/artifacts/bug-08-wizard-gate/test_results.txt` with real passing test output (or an explicit note that no automated test covers this prompt string, if that remains true).

Note for the record: the underlying two-line text edit itself is correct and matches the finding's recommended fix exactly (independently verified by direct diff against master and against line 174 / `wizard-profile.ts`'s coded gate). The NEEDS_CHANGES verdict is driven entirely by process/delivery failures (uncommitted work, scope creep, missing/garbage evidence, missing result file) — not by the correctness of the prompt text itself.

---

## Evidence Checked
- [ ] Result file exists and fields populated — **FAILS: file does not exist**
- [ ] No placeholders in result — N/A, file absent
- [ ] Test results present and passing — **FAILS: artifact is an npm EPERM crash log, not test output**
- [x] Changed files match stated scope — partially: `system-prompts.ts` matches; `.claude/settings.local.json` does not
- [ ] No unexpected scope expansion — **FAILS: settings.local.json modified**
- [ ] Writeback contract fulfilled — **FAILS: no outbox result.md, no commit on branch**
