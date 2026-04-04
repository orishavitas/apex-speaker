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

## 🔄 Wizard Sprint v2 — CHECKPOINT 2026-04-05

### Completed
- [x] Profile persistence via `onFinish` + `writeMemory` (was never called in v1)
- [x] `experience_level` stripped from system prompt JSON before injection
- [x] `isProfileComplete` root cause fixed (was always false due to missing persistence)
- [x] `budget_low` falsy guard → `=== undefined`
- [x] `__WIZARD_TRIGGER__` regex made global (`/g` flag)
- [x] `parseSignalsFromMessages()` — extracts 7 signals from conversation history
- [x] 7 signals: added `room_size` + `amplifier` to `WizardProfile`
- [x] `useEffect` syncs `wizardActive` state → `wizardActiveRef`
- [x] `streamText` wrapped in try/catch with 500 response
- [x] System prompt: expert shortcut, refusal handling, adaptive confirmation gate
- [x] v1 + v2 copies saved to `docs/wizard-sprint/versions/`
- [x] Improvement log written: `docs/wizard-sprint/logs/v2-improvements.md`
- [x] All commits pushed to origin/master, Vercel auto-deploy triggered

### Open Bug (Resume Here)
- [ ] `X-Wizard-Profile` header returns `{}` despite signal extraction being correct locally
  - Regex logic verified correct in Node REPL
  - Possible: Vercel serving stale deployment — run `vercel ls` to confirm active SHA matches `5bfb4f2`
  - Debug log added in `5bfb4f2` — check Vercel function logs after next test request
  - If stale: force redeploy via `vercel --prod` or trigger via empty commit + push

### After Bug Fixed
- [ ] Run 5 test scenarios from sprint plan (`docs/superpowers/plans/2026-04-03-wizard-sprint-v2.md`)
- [ ] Fix LLM echoing `## Current profile state` block back to user (prompt needs "this is internal context, do not repeat it")
- [ ] Save v2-final copies, update improvement log
- [ ] Call wizard sprint DONE

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
