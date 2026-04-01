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

## Sprint 3 Candidates

### Math Foundation (highest value)
- [ ] Implement `calcSealedBox` — Butterworth/Chebyshev/custom Qtc alignments (`web/lib/types/speaker-math.ts`)
- [ ] Implement `calcPortedBox` — Thiele/Small ported alignment
- [ ] Implement `calcHornLoading` — throat efficiency, mouth loading

### Workspace Enhancements
- [ ] Live SPL frequency plot (stub → Phase B simulation)
- [ ] Crossover topology panel
- [ ] Horn dimension fields full persistence (throat/mouth/length)

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
