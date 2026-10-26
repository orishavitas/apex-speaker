# Graph Report - wf_bc52feb5-977-5  (2026-07-29)

## Corpus Check
- 140 files · ~118,126 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1293 nodes · 1595 edges · 81 communities (74 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `89175f06`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]

## God Nodes (most connected - your core abstractions)
1. `skillOverrides` - 32 edges
2. `getNeon()` - 20 edges
3. `cn()` - 19 edges
4. `scripts` - 18 edges
5. `AgentDomain` - 16 edges
6. `db` - 16 edges
7. `compilerOptions` - 16 edges
8. `VituixCAD Sprint 1 — Authoritative Spec` - 14 edges
9. `Section 2: Technical Literature Ingestion Pipeline` - 14 edges
10. `Section 6: UI & Dashboard Evolution` - 14 edges

## Surprising Connections (you probably didn't know these)
- `SheetHeader()` --calls--> `cn()`  [EXTRACTED]
  web/components/ui/sheet.tsx → web/lib/utils.ts
- `SheetFooter()` --calls--> `cn()`  [EXTRACTED]
  web/components/ui/sheet.tsx → web/lib/utils.ts
- `AgentBadge()` --calls--> `cn()`  [EXTRACTED]
  web/components/apex/agent-badge.tsx → web/lib/utils.ts
- `DomainBadgeProps` --references--> `AgentDomain`  [EXTRACTED]
  web/components/apex/chat/domain-badge.tsx → web/lib/agents/types.ts
- `MessageBubbleProps` --references--> `AgentDomain`  [EXTRACTED]
  web/components/apex/chat/message-bubble.tsx → web/lib/agents/types.ts

## Import Cycles
- None detected.

## Communities (81 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (52): formatMemory(), MemoryEntry, readMemory(), writeMemory(), getModel(), formatRAGContext(), getRAGContext(), BASE_CONTEXT (+44 more)

### Community 1 - "Community 1"
Cohesion: 0.06
Nodes (45): DesignState, SaveStatus, useDesignStatePersistence(), UseDesignStatePersistenceReturn, PARAM_MAP, VxdParamRaw, defaultWaySlot(), DesignState (+37 more)

### Community 2 - "Community 2"
Cohesion: 0.04
Nodes (48): dependencies, ai, @ai-sdk/anthropic, @ai-sdk/gateway, @ai-sdk/google, @ai-sdk/openai, @ai-sdk/react, class-variance-authority (+40 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (46): 3.0 Overview, 3.10 Open Questions, 3.1.1 Responsibility, 3.1.2 System Prompt, 3.1.3 Data Access Pattern, 3.1.4 Database Schema, 3.1 New Agent: `vituixcad`, 3.2.1 Current Routing (Keyword-Only) (+38 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (44): 7.10 Estimated Total Effort, 7.11 Session Start Checklist (Template), 7.1 Overview, 7.2 Session Dependency Graph, 7.3.1 `web/lib/vituixcad/types.ts`, 7.3.2 `web/lib/literature/types.ts`, 7.3.3 `web/lib/design/types.ts`, 7.3.4 `web/lib/db/schema.ts` (+36 more)

### Community 5 - "Community 5"
Cohesion: 0.05
Nodes (37): 2026-03-27 — Phases 1–4 Complete, 2026-03-30 — Sprint 1: VituixCAD Integration, 2026-03-31 — Sprint 2: Workspace Hardening, 2026-04-01 — Sprint 2 Hardening + Phase 5 Production Deploy, 2026-04-02 — Sprint 3: Math Engine + Workspace Results UI, 2026-04-05 — Wizard Sprint v2, 2026-04-06 — Wizard Sprint v2: Code Review Swarm, 2026-04-13 — Sprint 4-A: Production Unblock + Wizard Sprint v2 Close-Out (+29 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (19): db, agentDomainEnum, agentMemory, agents, conversations, driverDatabase, driverTypeEnum, hornTypeEnum (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.09
Nodes (30): CATEGORY_MAP, DriverType, inferDriverType(), DriverInsert, vxdDriverToInsert(), mapThieleSmall(), VxbBaffleRaw, VxbCornerRaw (+22 more)

### Community 8 - "Community 8"
Cohesion: 0.06
Nodes (34): permissions, allow, skillOverrides, monday-swarm, safe-yolo, seed:checklists:planning-quality, seed:data:application:config, seed:data:application:guide (+26 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (34): APEX v2 --- VituixCAD Integration & Knowledge Expansion, API Endpoints, Artifact Contract Summary, Consistency Issues Found, Critical Path, Cross-Reference Table: Shared Artifacts & Interfaces, Database Tables, Executive Summary (+26 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (32): 1.10 Migration, 1.11 Integration Points for Specialist Agents, 1.12 Testing Strategy, 1.1 Overview, 1.2 Library Choice: fast-xml-parser, 1.3.1 Shared Primitives, 1.3.2 .vxp Project Types, 1.3.3 .vxd Driver Database Types (+24 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (32): 6.10 Component Architecture, 6.11 Responsive Considerations, 6.12 Visual Layout Descriptions, 6.13 Implementation Priority, 6.1 Design Philosophy, 6.2 Route Structure, 6.3 Root Shell Layout, 6.4 `/dashboard/chat` — Enhanced Chat View (+24 more)

### Community 12 - "Community 12"
Cohesion: 0.06
Nodes (30): 2.0 Overview, 2.10 Implementation Checklist, 2.11 Environment Variables, 2.12 Performance Expectations, 2.1 Directory Structure, 2.2.1 Marker (textbooks and papers), 2.2.2 Docling (datasheets), 2.2.3 Node.js subprocess wrapper (+22 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (30): 4.0 Baseline, 4.1 New Enums, 4.2.1 `vituixcad_projects`, 4.2.2 `literature_sources`, 4.2.3 `driver_database`, 4.2.4 `design_state`, 4.2 New Tables, 4.3.1 `source_type` enum extension (+22 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (28): Agent Orchestration, APEX Guided Design Wizard — Design Spec, Architecture Summary, Complexity Tags, Complexity Tags on Drivers, Confirmation Gate, Dependencies, Easter Eggs (+20 more)

### Community 15 - "Community 15"
Cohesion: 0.07
Nodes (26): 10. Out of Scope (Sprint 3), 1. Sprint Summary, 2.1 Singleton `WORKSPACE_PROJECT_ID`, 2.2 Debounce Timing: 800ms, 2.3 WayCard Stays Inline, 2.4 No Schema Migration, 2.5 `.vxd` Driver Import: Inline in `/api/upload`, 2.6 Handoff via URL Query Parameter (+18 more)

### Community 16 - "Community 16"
Cohesion: 0.08
Nodes (25): 5.0 Purpose of This Section, 5.10 Summary, 5.1 Canonical Unit System, 5.2.1 FrequencyGrid, 5.2.2 FrequencyResponse, 5.2.3 ImpedanceResponse, 5.2.4 ThieleSmallParams, 5.2 Primitive Acoustic Types (+17 more)

### Community 17 - "Community 17"
Cohesion: 0.16
Nodes (14): CRTOverlay(), BRAND_LABELS, EasterEggHandlers, KONAMI, useEasterEggs(), LandingPage(), SpeakerCanvas(), SpeakerCanvasProps (+6 more)

### Community 18 - "Community 18"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (13): cn(), DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle, ScrollArea (+5 more)

### Community 20 - "Community 20"
Cohesion: 0.11
Nodes (18): Apex Speaker — PLANNING.md, API Surface, Architecture, Data Model, Deployment Strategy, Open Questions, Phase 1: Foundation [DONE], Phase 2: Knowledge Pipeline [DONE] (+10 more)

### Community 21 - "Community 21"
Cohesion: 0.19
Nodes (13): Chunk, chunkConversation(), embedChunks(), AgentDomain, IngestOptions, upsertKnowledgeChunks(), FrontMatter, KNOWLEDGE_DIR (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.11
Nodes (17): Add a new agent domain, Add a new source type, Connect to Neon database, Deliverables, Design Decisions, How to Extend, Issues Encountered + Fixes, Next Phase (+9 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (17): Agent Endpoints, Call a Specialist, Call the Project Manager, Deliverables, Design Decisions, Graceful Degradation When DB Is Unavailable, How to Use, Issues Encountered + Fixes (+9 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (18): scripts, build, dev, import:deepsoic, import:deepsoic:dry, import:vituixcad, import:vituixcad:dry, import:vituixcad-txt (+10 more)

### Community 25 - "Community 25"
Cohesion: 0.12
Nodes (16): Files Modified, Scenario 1: Happy Path (Beginner), Scenario 2: Expert Shortcut, Scenario 3: Refusal / "You Decide", Scenario 4: Off-Topic Wandering, Scenario 5: Edge — Zero / Minimal Budget, Task 1: Save v1 Baseline Copies, Task 2: Fix `WizardProfile` — Falsy Guard + New Signals (+8 more)

### Community 26 - "Community 26"
Cohesion: 0.12
Nodes (16): Chunking Strategy: Conversation-Aware Splitting, Deliverables, Design Decisions, Embedding Model: `openai/text-embedding-3-small` via AI Gateway, Expected Output (after ingestion), `force-dynamic` on API Routes, How to Run the Pipeline, Issues Encountered + Fixes (+8 more)

### Community 27 - "Community 27"
Cohesion: 0.12
Nodes (16): Data flow, Design, Design, Design, Done Criteria, Error handling, Feature 1: Workspace Chat Wiring, Feature 2: Horn Dimension Persistence (+8 more)

### Community 28 - "Community 28"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 29 - "Community 29"
Cohesion: 0.12
Nodes (15): APEX Speaker Design Intelligence — Project Context, Architecture, Core (Phases 1–4), Critical Implementation Notes, Current Status, Design Language, Key Files, Live URLs (+7 more)

### Community 30 - "Community 30"
Cohesion: 0.12
Nodes (15): Changes Made, [CRITICAL] experience_level leaked into system prompt — DW-001, [CRITICAL] isProfileComplete always false — W-002, [CRITICAL] Profile never persisted — DW-002 / W-001, Findings Deferred to v3, [HIGH] budget_low falsy guard — DW-005, [HIGH] Signal extraction added — W-001 (root fix), [HIGH] __WIZARD_TRIGGER__ regex not global — DW-010 (+7 more)

### Community 31 - "Community 31"
Cohesion: 0.12
Nodes (15): Agent Roster, APEX — Speaker Design Intelligence Platform: System Spec, Design Language: APEX Visual System, External Resources, Knowledge Taxonomy, NotebookLM — Speaker Building Knowledge Base, Phase 1: Foundation, Phase 2: Knowledge Pipeline (+7 more)

### Community 32 - "Community 32"
Cohesion: 0.25
Nodes (9): getDb(), getNeon(), main(), main(), main(), main(), parseNum(), TYPE_MAP (+1 more)

### Community 33 - "Community 33"
Cohesion: 0.13
Nodes (14): API Reference (After Phase 3), Call a Specialist Agent, Call the Project Manager, File Structure, Phase 3: Agent Architecture — Implementation Plan, Seed Agents Table, Task 1: Types, Task 2: System Prompts (+6 more)

### Community 34 - "Community 34"
Cohesion: 0.13
Nodes (14): Architecture After Deployment, Deployment Checklist, Environment Variables Required, Phase 5: Vercel Deployment — Process Document, Step 1: Push repo to GitHub, Step 2: Link to Vercel, Step 3: Add Neon via Vercel Marketplace, Step 4: Pull env vars locally (+6 more)

### Community 35 - "Community 35"
Cohesion: 0.13
Nodes (14): APEX — TODO, Completed (code-review-swarm 2026-04-06 — commit 4e2b4fa), Completed (original v2 fixes), ✅ Done This Session, Driver DB, Phase 6 Wishlist, Resume Here, ✅ Sprint 3 — Math Engine + Workspace Results (2026-04-02) (+6 more)

### Community 36 - "Community 36"
Cohesion: 0.18
Nodes (8): ALL_TYPES, DRIVER_TYPE_COLORS, DriverRow, SortKey, Button, ButtonProps, buttonVariants, Input

### Community 37 - "Community 37"
Cohesion: 0.15
Nodes (12): File Structure, Phase 2: Knowledge Pipeline — Implementation Plan, Running the Full Pipeline (After DB Setup), Task 1: Domain Tagging Map, Task 2: Conversation Chunker, Task 3: Embedder, Task 4: DB Upsert Helper, Task 5: Main Ingestion Script (+4 more)

### Community 38 - "Community 38"
Cohesion: 0.15
Nodes (12): AI SDK v6 Chat API, Deliverables, Design Decisions, Domain Routing via Custom `fetch`, How to Run, Issues Encountered + Fixes, Message Content Extraction (UIMessage v6 Format), Next Phase (+4 more)

### Community 39 - "Community 39"
Cohesion: 0.27
Nodes (7): AGENT_CONFIG, AgentBadge(), AgentBadgeProps, AgentDomain, AGENTS, Sidebar(), PHASE_STATUS

### Community 40 - "Community 40"
Cohesion: 0.17
Nodes (11): APEX Phase 1: Foundation Implementation Plan, Completion Checklist, File Map, Next Phase, Task 1: Scaffold Next.js 16 App, Task 2: Configure APEX Design System, Task 3: Build Agent Badge Component, Task 4: Database Schema (+3 more)

### Community 41 - "Community 41"
Cohesion: 0.18
Nodes (9): ProjectRow, UploadResult, UploadState, Card, CardContent, CardDescription, CardFooter, CardHeader (+1 more)

### Community 42 - "Community 42"
Cohesion: 0.18
Nodes (10): Bug Log, Code Review Swarm Report — 2026-04-06, Concerns (DONE_WITH_CONCERNS), Deferred (Not Fixed This Pass), False Positives Discarded, Files Modified, New Tests, Root Cause of X-Wizard-Profile Returning {} (+2 more)

### Community 43 - "Community 43"
Cohesion: 0.18
Nodes (10): File Map, Sprint 4a — Landing Page Implementation Plan, Task 1: Install Three.js, Task 2: Root Page Shell, Task 3: CRT Overlay, Task 4: Speaker Mesh Registry, Task 5: Three.js Speaker Canvas, Task 6: Easter Egg Logic (+2 more)

### Community 44 - "Community 44"
Cohesion: 0.18
Nodes (10): File Map, Sprint 4b — Guided Design Wizard Agent Implementation Plan, Task 1: Add design_wizard to AgentDomain, Task 2: Wizard Profile Logic, Task 3: Wizard System Prompt, Task 4: Manager Routing for Wizard, Task 5: Wizard Agent Endpoint, Task 6: Wizard Pane Component (+2 more)

### Community 45 - "Community 45"
Cohesion: 0.31
Nodes (8): designState, projects, GET(), isNoDatabaseError(), PATCH(), PatchSchema, WaySlotSchema, defaultDesignState()

### Community 46 - "Community 46"
Cohesion: 0.22
Nodes (8): File Map, Sprint 4c — Driver Database Population Implementation Plan, Task 1: Add New source_type Enum Values, Task 2: VituixCAD Drivers Import Script, Task 3: DeepSOIC XLSX Import Script, Task 4: loudspeakerdatabase.com Scraper, Task 5: Driver Search API Endpoint, Task 6: Run Real Imports + Verify Row Count

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (9): 2.1 Table Count: 3, Not 4, 2.2 Horn Loading: DB Enum + TypeScript Discriminated Union, 2.3 File Structure: Domain Logic Wins on Type Organization, 2.4 Workspace Scaffold vs Full Implementation, 2.5 T/S Parameter Naming: Unit-Suffixed Canonical, 2.6 Parser Export Shape: Three Named Exports, No Dispatcher, 2.7 Ways Storage: JSONB This Sprint, Relational Later, 2.8 Enum Extension Strategy (+1 more)

### Community 48 - "Community 48"
Cohesion: 0.22
Nodes (8): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants

### Community 49 - "Community 49"
Cohesion: 0.25
Nodes (4): isProfileComplete(), profileConfidence(), ProjectedBuild, WizardProfile

### Community 50 - "Community 50"
Cohesion: 0.25
Nodes (4): isProfileComplete(), profileConfidence(), ProjectedBuild, WizardProfile

### Community 51 - "Community 51"
Cohesion: 0.25
Nodes (7): Done Criteria, File Map, Sprint 4-C: Workspace Enhancements Implementation Plan, Task 1: WizardPane — add room_size and amplifier signals, Task 2: Horn dimension persistence — extend HornLoadingPanel, Task 3: Workspace Chat — wire Col 3 to real agent, Task 4: Final verification + push

### Community 52 - "Community 52"
Cohesion: 0.25
Nodes (7): 10. Critical Path + Parallelism Windows, 11. Risk Register, 12. Definition of Done, 3. File Structure, 9. Sprint Backlog, Appendix: Decision Log, VituixCAD Sprint 1 — Authoritative Spec

### Community 53 - "Community 53"
Cohesion: 0.25
Nodes (8): 7. API Endpoints, `GET /api/design-state/[projectId]`, `GET /api/drivers`, `GET /api/vituixcad/projects`, `GET /api/vituixcad/projects/[id]`, `PATCH /api/design-state/[projectId]`, `POST /api/drivers`, `POST /api/vituixcad/upload`

### Community 54 - "Community 54"
Cohesion: 0.33
Nodes (3): LoadIntoWorkspacButtonProps, LoadIntoWorkspaceButton(), ProjectDetailPageProps

### Community 55 - "Community 55"
Cohesion: 0.29
Nodes (6): Context Notes, Decisions Made, Files Modified This Session, Session Log — 2026-04-01, State at Handoff, What Was Accomplished

### Community 56 - "Community 56"
Cohesion: 0.29
Nodes (6): Context Notes, Decisions Made, Files Modified This Session, Session Log — 2026-04-02, State at Handoff, What Was Accomplished

### Community 57 - "Community 57"
Cohesion: 0.47
Nodes (5): CLONE_DIR, main(), parseNum(), processWorkbook(), XLSX_FILE

### Community 58 - "Community 58"
Cohesion: 0.33
Nodes (6): 4. TypeScript Types, `web/lib/parser/ts-param-mapper.ts`, `web/lib/types/index.ts`, `web/lib/types/speaker-domain.ts`, `web/lib/types/speaker-math.ts`, `web/lib/types/vituixcad-native.ts`

### Community 59 - "Community 59"
Cohesion: 0.33
Nodes (6): 6. Migration Strategy, Notes, Step 1: Extend `agentDomainEnum` (outside transaction), Step 2: Verify pgvector extension, Step 3: Generate and push, Step 4: Verify

### Community 61 - "Community 61"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 62 - "Community 62"
Cohesion: 0.60
Nodes (4): DEFAULT_PATH, main(), mapType(), parseNum()

### Community 63 - "Community 63"
Cohesion: 0.40
Nodes (4): CLONE_DIR, rawArr, wb, XLSX_FILE

### Community 64 - "Community 64"
Cohesion: 0.70
Nodes (4): extractDriverData(), main(), parseNum(), sleep()

### Community 65 - "Community 65"
Cohesion: 0.40
Nodes (5): 5. Database Schema, New Enums (add to `web/lib/db/schema.ts`), Table: `design_state`, Table: `driver_database`, Table: `vituixcad_projects`

### Community 66 - "Community 66"
Cohesion: 0.40
Nodes (5): 8.1 Workspace — Three-Column Layout, 8.2 Horn Loading — Inline Conditional Fields, 8.3 Driver Database Table, 8.4 Projects Page — Upload Zone, 8. UI Layout

### Community 67 - "Community 67"
Cohesion: 0.67
Nodes (3): Badge(), BadgeProps, badgeVariants

### Community 68 - "Community 68"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

### Community 69 - "Community 69"
Cohesion: 0.67
Nodes (3): 1. Sprint Overview, Success Criteria, What We're Building

## Knowledge Gaps
- **814 isolated node(s):** `allow`, `monday-swarm`, `safe-yolo`, `seed:checklists:planning-quality`, `seed:data:application:config` (+809 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AgentDomain` connect `Community 0` to `Community 1`, `Community 6`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `cn()` connect `Community 19` to `Community 0`, `Community 67`, `Community 36`, `Community 39`, `Community 41`, `Community 48`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **What connects `allow`, `monday-swarm`, `safe-yolo` to the rest of the system?**
  _814 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.06450617283950617 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.055191256830601096 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._