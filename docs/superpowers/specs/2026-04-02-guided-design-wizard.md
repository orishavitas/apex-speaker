# APEX Guided Design Wizard — Design Spec

**Date:** 2026-04-02
**Status:** Approved — Ready for Implementation Planning
**Author:** Brainstormed with Ori

---

## Executive Summary

The Guided Design Wizard transforms APEX from a tool for experts into a platform for anyone who wants to build a speaker. It lives inside the existing chat interface, triggered by a starter prompt. It builds an invisible user profile through conversation, orchestrates existing specialist agents to generate a recommendation, surfaces complexity-tagged research and buy links, and files all discovered resources into the shared knowledge base. The landing page sets the tone: procedurally generated isometric wireframe speaker, cyberpunk/dot-matrix aesthetic, easter eggs for the curious.

---

## Section 1 — Landing Page

### Visual

Full-viewport canvas animation. A wireframe isometric speaker rotates slowly on a dot-matrix grid floor. Aesthetic: 1983 CAD terminal meets cyberpunk hologram — scanline overlays, neon phosphor edge glow on the wireframe geometry, subtle CRT curvature. The APEX symbol ◈ anchors top-center. No nav, no onboarding copy. A single input fades in after 2 seconds — the user types or presses Enter to enter the dashboard.

**Implementation:** Three.js or raw canvas. Geometry is parametric (cone + surround + basket + cabinet) so brand easter eggs can swap the mesh.

### Easter Eggs

| Trigger | Effect |
|---------|--------|
| Konami code (↑↑↓↓←→←→BA) | Speaker explodes into isometric exploded-view parts (woofer, tweeter, crossover, cabinet), slow rotation, then reassembles. CRT flash: "CHEAT ACTIVATED" |
| Click ◈ three times | Mesh briefly switches from wireframe to photorealistic render, snaps back. "Seeing through the simulation." |
| Type any speaker brand name | Speaker geometry swaps to that brand's signature model silhouette. Unknown brands: "MANUFACTURER NOT IN DATABASE" CRT blink, then generic renders. |
| Idle 60 seconds | Speaker de-renders to dot-matrix grid only. Blinking cursor. Mainframe sleep mode. |
| Type "sudo" | Prints `Permission denied. You are not authorised.` — continues normally. |
| Mobile visit | Miniature pocket-sized speaker renders. Label: "PORTABLE UNIT DETECTED" |

**Brand mesh library (MVP):** KLIPSCH (Klipschorn), FOCAL (Utopia), JBL (4350), GENELEC (8050), BOWERS (802), HARBETH (M30). Expand over time.

### Route

`/` is the landing page. `/dashboard` is the app entry point. No auth currently — the landing page is always shown at root, with a click/keypress advancing to `/dashboard/chat`.

---

## Section 2 — Chat Wizard Trigger & Profile Pane

### Trigger

The existing `/dashboard/chat` starter prompts gain one new entry:

> **"Help me design a speaker from scratch →"**

Clicking sends a fixed system trigger message to the manager agent. Manager routes to `design_wizard` domain. No routing ambiguity — the trigger is explicit, not inferred from free-form input.

### Wizard Opening

First response is character-setting, not explanatory. No "I'm a wizard that will help you..." preamble. Just:

> *"Let's build something. First — what's your budget, roughly?"*

The user can break out at any time by asking something off-topic. The wizard recognises this, delegates to the appropriate specialist agent, then offers to return: *"Want to continue with the design?"*

### Invisible Profile

The wizard builds a profile silently as the conversation progresses. It is **never shown to the user as a form or score.** It exists only as internal agent state stored in the `agent_memory` table (already exists, keyed to conversation).

**Profile signals (5 required before confirmation gate):**

| Signal | Example inference |
|--------|------------------|
| Budget | "$300" → mid-range component budget |
| Placement | "living room shelf" → bookshelf, ~1m listening distance |
| Use case | "music, mostly jazz" → flat response, detail over bass |
| Sound signature | "warm but clear" → slight low-mid lift, extended highs |
| Experience level | Hidden. Inferred from vocabulary, specificity, questions asked. Never displayed. |

**Experience level (hidden, internal only):**
- 1 — No acoustics knowledge, exploring
- 2 — Understands basic speaker anatomy, knows why ported differs from sealed
- 3 — Hi-fi enthusiast considering first DIY build
- 4 — Has built a kit before, comfortable with measurements
- 5 — Experienced builder, exploring new tools

The level calibrates language depth and recommendation detail. It never surfaces in UI.

### Confirmation Gate

Once all 5 signals reach confidence threshold:

> *"Here's what I'm thinking you need — 2-way bookshelf, ~5" woofer, sealed or small ported, budget ~$280 for drivers. Want me to run with this, or is there something I got wrong?"*

User approves → wizard hands off to specialist agents.
User pushes back → wizard adjusts profile, recalibrates.

### Right-Side Profile Pane

A live pane in Column 3 (same slot as the workspace agent panel) shows two sections:

**Captured signals** — fills in as wizard progresses, starts as `···`:
```
BUDGET        $300–400
PLACEMENT     bookshelf / desktop
USE CASE      music listening
SOUND SIG     warm, detailed
```

**Projected build** — generative summary, updates every few turns:
```
PROJECTED BUILD
─────────────────
2-way bookshelf
~5" woofer + 1" dome tweeter
sealed or small ported
est. f3: 65–80 Hz
sensitivity: ~86–88 dB
cabinet budget: ~$120
```

This is the wizard thinking out loud — not a recommendation yet. When the confirmation gate fires, the pane highlights and locks.

The pane is **read-only**. The user interacts only through chat.

---

## Section 3 — Research & Recommendation Flow

### Agent Orchestration

After confirmation, the wizard orchestrates three specialist agents in sequence. The chat stream shows visible hand-offs (not a spinner):

```
◈ enclosure agent — evaluating box alignment...
◈ research agent  — finding similar builds...
◈ acoustics agent — validating driver fit...
```

Each agent streams 3–4 sentences into chat, written at the user's inferred level. Level 1 gets plain language. Level 5 gets T/S parameters and alignment theory.

### Complexity Tags

Every piece of information surfaced by the wizard — research links, datasheets, buy links, similar builds — carries a visible complexity rating:

```
→ Thiele/Small alignment theory (AES 1971)    [●●●●○] advanced
→ diyAudio: Budget bookshelf build thread     [●●○○○] beginner-friendly
→ SB Acoustics SB13PFC datasheet              [●●●○○] intermediate
→ Parts Express: SB13PFC — $42               [○○○○○] buy link
```

Five dots. Informational only — nothing is hidden. Users self-select based on dots. Low-level users skip the AES paper naturally. High-level users go straight to it.

### Where-to-Buy Links

Buy links are surfaced alongside driver recommendations. MVP vendors: Parts Express, Madisound, Meniscus Audio, Solen, Digikey (components).

**Affiliate note:** Affiliate tracking is a future revenue layer. Must be:
- Disclosed with an "affiliate link" badge in UI
- Stored in a `vendor_links` table with per-vendor affiliate codes
- Never the basis of recommendation — merit first, convenience second

Not in MVP scope. Links are plain URLs at launch.

### Similar Builds Panel

Below the projected build summary in the right pane, after research completes:

```
SIMILAR BUILDS
─────────────────
→ diyAudio: "Budget bookshelf 2026"           [●●○○○]
   SB Acoustics 5" + Seas 27TBFC, $280
→ Erin's Audio Corner: Overnight Sensations   [●●●○○]
   matched: placement, budget, signature
→ AES J.Audio 1971: Thiele alignment study    [●●●●○]
   theoretical basis for this box type
```

Sources: diyAudio, AudioScienceReview, Erin's Audio Corner, spinorama.org, AES papers, manufacturer datasheets. No personal history references. Purely objective, sourced, citable.

### Research Filing (KB Side Effect)

Every research item the wizard surfaces is simultaneously embedded into the knowledge base:
- `source_type: 'community_build'` for forum threads and builds
- `source_type: 'measurement'` for spinorama/Erin's data
- `source_type: 'literature'` for AES papers
- `agent_domain` tagged to relevant specialist (enclosure, acoustics, etc.)

The KB grows every time anyone uses the wizard. The research value compounds.

**Complexity note:** Live web scraping during a chat session is deferred. MVP uses pre-ingested static sources. The offline scraper pipeline (diyAudio, spinorama, Erin's) runs as a separate script and pre-populates the KB. Live research is Sprint 6+.

### Final Recommendation

After all three agents report back, the wizard synthesises:

> *"Based on your profile and what's worked in similar builds, here's what I'd start with: SB Acoustics SB13PFC + Seas 27TBFC, sealed ~8L, estimated f3 ~72Hz. Want me to load this into the workspace, or keep exploring?"*

Two exits offered:
1. **Load to workspace** — pushes the recommended config into `/dashboard/workspace` as a pre-populated design state
2. **Keep exploring** — conversation continues, wizard stays active

No hard push to workspace. User leads.

---

## Section 4 — Driver Database as Foundation

### Population Strategy (Phased)

**Phase 1 — Immediate, offline scripts:**
- `web/scripts/import-vituixcad-drivers.ts` — reads user's local `VituixCAD_Drivers.txt` (TSV, full T/S params), maps columns to `driver_database` schema, upserts on `(manufacturer, model)`. Supports `--dry-run` flag.
- `web/scripts/import-deepsoic-drivers.ts` — git clones `DeepSOIC/loudspeaker-database`, parses XLSX, upserts. Small dataset but clean open-source baseline.

**Phase 2 — Periodic scraper:**
- `web/scripts/scrape-loudspeakerdatabase.ts` — fetches pages from loudspeakerdatabase.com (~6,000 drivers), extracts embedded JSON, maps to schema. Runs offline on demand, not during sessions.

**Phase 3 — Literature pipeline feeds it:**
- Driver datasheets ingested via Docling (specced in `section-2-literature-pipeline.md`) become structured `driver_database` rows, not just RAG chunks.

### How the Wizard Uses the Database

Raw T/S parameters are never shown to low-level users. The wizard translates:

| T/S signal | Plain language |
|-----------|---------------|
| Low Qts + low fs | "Works well in a ported box, good bass extension" |
| High Qts | "Sealed box friendly, forgiving of volume errors" |
| High sensitivity (>90dB) | "Efficient — works with low-power amps" |
| Large Xmax + Sd | "Moves serious air, good for bass" |
| Small Sd, high fs | "Better suited for midrange or high frequencies" |

**Recommendation query:** filter by `driver_type`, `sensitivity_1m1w` range, `fs_hz` ceiling, `nominal_impedance_ohm`; rank by profile fit score; return top 3 with plain-language reasoning.

### Complexity Tags on Drivers

Each driver card in wizard chat:
```
→ Dayton RS150-8         $35    [●○○○○] entry point, very forgiving
→ SB Acoustics SB13PFC   $42    [●●○○○] excellent beginner-intermediate woofer
→ ScanSpeak 18W/8535     $180   [●●●●○] reference-grade, unforgiving of bad boxes
```

Name, price, buy link (affiliate-flagged in future), complexity dots, one sentence reasoning. More detail only if user asks.

---

## Architecture Summary

```
/                          ← Landing page (Three.js isometric speaker)
/dashboard/chat            ← Wizard triggered by starter prompt
  → manager agent          ← Routes trigger to design_wizard domain
    → design_wizard agent  ← Profile builder + orchestrator
      → enclosure agent    ← Box alignment reasoning
      → research agent     ← Similar builds + KB filing
      → acoustics agent    ← Driver fit validation
      → driver_database    ← Filtered recommendation query
      → agent_memory       ← Profile state persistence
      → knowledge_chunks   ← Research filing (side effect)
```

---

## Implementation Decomposition

This spec covers 3 implementation sprints:

| Sprint | Scope |
|--------|-------|
| Sprint 4a | Landing page — Three.js canvas, easter eggs, brand meshes |
| Sprint 4b | Wizard agent + profile pane — `design_wizard` domain, starter prompt, Column 3 pane, confirmation gate |
| Sprint 4c | Driver DB population + recommendation flow — import scripts, agent orchestration, complexity tags, similar builds panel |

Each sprint ships independently. 4a has no dependencies. 4b requires no driver data (wizard can recommend without DB, just less specific). 4c requires 4b + populated DB.

**Implementation note:** `community_build` and `measurement` are new `source_type` enum values — confirm they don't exist and add via `ALTER TYPE source_type ADD VALUE` (must run outside a transaction in PostgreSQL).

---

## What Is NOT In Scope (MVP)

- Live web scraping during chat sessions (deferred to Sprint 6+)
- Affiliate link tracking (future revenue layer — links are plain URLs at launch)
- User authentication / personal build history
- Literature pipeline (Marker + Docling) — specced separately, feeds this later
- VituixCAD frequency response plots in wizard output
- Visual brand mesh library beyond 6 initial brands

---

## Dependencies

| Dependency | Status | Blocks |
|-----------|--------|--------|
| driver_database populated | Not started | Wizard recommendations |
| VituixCAD_Drivers.txt import script | Not started | Driver DB population |
| `design_wizard` agent domain + system prompt | Not started | Wizard flow |
| Landing page Three.js canvas | Not started | Entry experience |
| Profile pane component (right column) | Not started | Live profile display |
| Pre-ingested community builds in KB | Not started | Similar builds panel |

---

## Open Questions (Resolved)

- Experience level display → **Hidden. Internal only. Never shown.**
- Personal history references → **Dropped. Objective sources only.**
- Live research during session → **Deferred. Pre-ingested KB only for MVP.**
- Affiliate links → **Noted for future. Plain URLs at launch.**
- Wizard trigger mechanism → **Explicit starter prompt. No implicit detection.**
