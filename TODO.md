# APEX — TODO

## ✅ Done This Session

- [x] Phase 5 deployment — production live at https://web-blue-theta-12.vercel.app
- [x] Sprint 1 VituixCAD integration — merged to master
- [x] Sprint 2 Workspace Hardening — merged to master
- [x] Knowledge ingest — 23/23 files, 78 chunks, HNSW index created
- [x] Fixed Drizzle vector serialization bug in upsert.ts
- [x] Fixed embedder to bypass AI Gateway (use OpenAI provider directly)
- [x] Fixed chunker token hard-cap (28000 chars)

---

## ✅ Sprint 3 — Math Engine + Workspace Results (2026-04-02)

- [x] Implement `calcSealedBox` — Qtc, f3, fb, peak_dB via Butterworth/Chebyshev alignment
- [x] Implement `calcPortedBox` — B4 alignment, group delay, port velocity
- [x] Implement `calcHornLoading` — fc by profile, throat coupling efficiency
- [x] Fix RAG embedder (`rag-context.ts`) — AI Gateway string → `openai.embedding()` directly
- [x] `/api/drivers/[id]` — single driver endpoint
- [x] `WaySlot.netVolumeLiters` — volume persists in design state
- [x] WayCard volume input (L) for sealed/ported
- [x] WayCard T/S fetch from driver DB when driver assigned
- [x] SealedResults panel: Qtc, f3, fb, peak_dB + quality label
- [x] PortedResults panel: fb, f3, group delay, port velocity + chuffing warning
- [x] HornResults panel: fc, efficiency%, mouth loading

---

## ✅ Wizard Sprint v2 — COMPLETE (2026-04-06)

### Completed (original v2 fixes)
- [x] Profile persistence via `onFinish` + `writeMemory`
- [x] `experience_level` stripped from system prompt JSON
- [x] `isProfileComplete` root cause fixed
- [x] `budget_low` falsy guard → `=== undefined`
- [x] `__WIZARD_TRIGGER__` regex global
- [x] `parseSignalsFromMessages()` — 7 signals
- [x] `wizardActiveRef` useEffect sync
- [x] `streamText` try/catch
- [x] System prompt hardened

### Completed (code-review-swarm 2026-04-06 — commit 4e2b4fa)
- [x] `onFinish` writeMemory uses `after()` from next/server — root cause of `X-Wizard-Profile {}` bug
- [x] `readMemory` key-filtered — no longer loads wrong row as profile
- [x] `writeMemory` atomic via `db.transaction()`
- [x] Budget guard `&&` → `||` — user corrections applied
- [x] `experience_level` computes running max across all messages
- [x] Prompt injection allowlist on all 7 signals
- [x] Debug console.logs gated behind `NODE_ENV !== 'production'`
- [x] `m.content ?? ''` null guard in signal extraction
- [x] Silent header parse failure now console.warns
- [x] `stripPrivateFields()` helper extracted
- [x] `EXPERT_TERMS`/`INTERMEDIATE_TERMS` hoisted to module constants
- [x] `WIZARD_PROMPT` used in `STARTER_PROMPTS[0]`
- [x] `wizardProfile` state typed as `WizardProfile | null`
- [x] `BASE_CONTEXT` prepended to design_wizard prompt
- [x] 26 Vitest tests for `parseSignalsFromMessages`

### Resume Here
- [x] `git push` → Vercel auto-deploy → smoke-test X-Wizard-Profile header
- [x] Run 5 test scenarios from sprint plan (smoke-test confirms basic flow working)
- [x] Fix LLM echoing `## Current profile state` block
- [x] Call wizard sprint fully done, archive docs

---

## Sprint 4-A — COMPLETE (2026-04-13)
- [x] Push wizard fixes to production
- [x] Fix LLM echo of profile state block
- [x] Verify ANTHROPIC_API_KEY in Vercel production
- [x] Smoke-test all agents in production

---

## Sprint 4-C — COMPLETE (2026-04-14)
- [x] WizardPane: room_size + amplifier signals (6 rows visible)
- [x] Horn dimension persistence: all MonoInput fields wired + diameter→area conversion
- [x] WorkspaceChat: real useChat wiring, MessageBubble rendering, domain badge
- [x] Fix backtick parse error in system-prompts.ts (was blocking Vitest)

---

## Sprint 4 Candidates

### Workspace Enhancements
- [ ] Horn dimension fields full persistence (throat/mouth/length persist in design state)
- [ ] Live SPL frequency plot
- [ ] Crossover topology panel

### Driver DB
- [ ] Driver fuzzy-match: auto-link VXP DRIVER refs to driver_database rows
- [ ] `vxd_source_id` FK column on driver_database for import traceability
- [ ] T/S param edit modal
- [ ] CSV import endpoint

### VituixCAD
- [ ] VXP crossover frequency derivation from L/C component values

### Phase 6 Wishlist
- [ ] Project memory UI
- [ ] Knowledge search at /knowledge
- [ ] Sources page at /sources
- [ ] New chat button
- [ ] Domain badge animation
- [ ] Theme toggle
- [ ] Rename Vercel project from "web" to "apex-speaker" (cosmetic)
