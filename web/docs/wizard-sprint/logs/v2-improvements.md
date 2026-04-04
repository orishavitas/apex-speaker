# Wizard Sprint v2 — Improvement Log

**Date:** 2026-04-05
**Sprint:** v1 → v2
**Swarm reviewers:** Backend engineer (18 findings DW-001–DW-018), UX expert (18 findings W-001–W-018)

---

## Summary

10 critical and high-severity issues addressed. The wizard was fundamentally stateless in v1 — profile was read from memory but never written back, making the confirmation gate permanently unreachable. Every conversation started from zero.

---

## Changes Made

### [CRITICAL] Profile never persisted — DW-002 / W-001
- **v1:** `readMemory` called at request start. `writeMemory` never called. Wizard had no memory between turns or sessions.
- **v2:** `onFinish` callback in `streamText` writes `serializeProfile(profile)` to `agent_memory` under key `wizard_profile`. Profile now survives every turn and session restart.
- **Impact:** Confirmation gate can now fire. Context accumulates correctly.

### [CRITICAL] experience_level leaked into system prompt — DW-001
- **v1:** `JSON.stringify(profile, null, 2)` dumped the full profile including `experience_level` into the LLM system prompt. The strip (`{ experience_level: _hidden, ...publicProfile }`) only applied to the response header, not the prompt.
- **v2:** `const { experience_level, ...profileForPrompt } = profile` before building system prompt. Level is injected separately in a clearly labelled internal-only section (`## Inferred experience level (internal only — never mention to user)`).
- **Impact:** LLM no longer sees the numeric level in the raw profile JSON — cannot accidentally echo it back to the user.

### [CRITICAL] isProfileComplete always false — W-002
- **v1:** `profileConfidence({})` = 0 because profile was never persisted. Confirmation gate permanently unreachable.
- **v2:** Fixed by persistence (above) + `profileConfidence` now counts budget as 1 signal if *either* `budget_low` or `budget_high` is set (covers the case where only a range high is known).
- **Impact:** Gate fires correctly once 5 of 7 signals are collected.

### [HIGH] budget_low falsy guard — DW-005
- **v1:** `if (!p.budget_low || !p.placement)` evaluates true (skips build derivation) when budget_low is 0.
- **v2:** `const hasBudget = p.budget_low !== undefined || p.budget_high !== undefined` — strict undefined check.
- **Impact:** $0 or sub-$50 budgets no longer silently suppress the projected build panel.

### [HIGH] __WIZARD_TRIGGER__ regex not global — DW-010
- **v1:** `raw.replace("__WIZARD_TRIGGER__", "")` removes only the first occurrence.
- **v2:** `raw.replace(/__WIZARD_TRIGGER__/g, "")` removes all occurrences.
- **Impact:** No sentinel token can leak through to the LLM regardless of message structure.

### [HIGH] Signal extraction added — W-001 (root fix)
- **v1:** Profile only populated from memory. Since memory was never written, profile was always `{}`.
- **v2:** `parseSignalsFromMessages()` scans all user messages on every request, extracting budget (range + single), placement, use case, sound signature, room size, amplifier, and experience level using keyword patterns. Merged into loaded profile before building system prompt.
- **Impact:** Profile builds incrementally even without DB. Stateless graceful degradation preserved.

### [MEDIUM] Missing signals: room_size and amplifier — W-006 / W-007
- **v1:** 5 signals: budget, placement, use_case, sound_signature, experience_level.
- **v2:** 7 signals, gate fires at 5 of 7. New signals: `room_size` (small / medium / large / open plan) and `amplifier` (has amp / needs amp / active/powered / class D).
- **Impact:** More complete topology and budget recommendations. Room size informs enclosure sizing.

### [MEDIUM] wizardActive / wizardActiveRef sync — DW-013
- **v1:** `wizardActiveRef.current = true` set only in `triggerWizard()`. Possible race if React batches state update before next fetch.
- **v2:** `useEffect(() => { wizardActiveRef.current = wizardActive; }, [wizardActive])` added. Direct ref set in `triggerWizard` retained for the immediate fetch call (belt-and-suspenders).
- **Impact:** Follow-up routing to `/api/agents/design-wizard` is reliable in all React scheduling scenarios.

### [MEDIUM] streamText unguarded — DW-006
- **v1:** Any model error produced a garbled or empty stream response.
- **v2:** `try/catch` around `streamText` returns a clean `{ error: "Wizard agent failed to respond" }` 500 response.
- **Impact:** User sees a readable error instead of silent hang.

### [MEDIUM] System prompt hardened
- **v1:** No handling for refusals, expert shortcut, or repeat off-topic messages.
- **v2:** Added: expert shortcut (3+ signals in one message → skip repeated questions), refusal/skip handling (accept flexible signal, move on, never press), off-topic escalation (answer + redirect once; on second off-topic, drop redirect), experience-adaptive confirmation gate language (3 register variants: beginner / intermediate / expert).
- **Impact:** Handles power users (expert shortcut), reluctant users (refusal handling), and wandering conversations (off-topic escalation). No more wizard stuck asking placement after user already said "bookshelf" three messages ago.

---

## Findings Deferred to v3

| ID | Description | Reason |
|----|-------------|--------|
| DW-003 | No session ID → profile key collision across users | Requires auth system |
| DW-007 | No rate limiting on wizard endpoint | Infrastructure change |
| DW-011 | WizardPane doesn't show all 7 signals (room_size, amplifier missing) | UI sprint |
| W-003 | No visual progress indicator for signal collection | UX sprint |
| W-011 | Workspace chat (Col 3) not wired to agent API | Separate task |

---

## Test Scenarios (run against production)

| # | Scenario | Expected result |
|---|----------|----------------|
| 1 | Happy path — beginner, one signal per turn | Confirmation gate fires within 6 turns, beginner language |
| 2 | Expert shortcut — all signals in one message | Gate fires in 1–2 turns, expert register ("Correct, or tune constraints?") |
| 3 | Refusal — "you decide" / "doesn't matter" on 2 questions | Accepted as flexible, gate still fires |
| 4 | Off-topic wandering — 2 technical questions mid-wizard | Redirected once, not twice; flow continues |
| 5 | Edge — $0 budget stated | No crash, projected build still rendered, WizardPane visible |
