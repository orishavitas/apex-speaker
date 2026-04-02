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
