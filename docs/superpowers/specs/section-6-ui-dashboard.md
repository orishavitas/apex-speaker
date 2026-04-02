# Section 6: UI & Dashboard Evolution

**Document:** APEX Speaker Design Intelligence — Phase 4 UI Spec
**Date:** 2026-03-28
**Status:** Ready for implementation
**Depends on:** Sections 1–5 (Foundation, Knowledge Pipeline, Agent Architecture)

---

## 6.1 Design Philosophy

APEX is a professional design tool, not a consumer app. Every layout decision prioritizes **information density, scanability, and workflow continuity** over spaciousness or decorative whitespace. The mental model is closer to an oscilloscope interface or a DAW than a SaaS dashboard.

**Guiding constraints:**
- Dark mode exclusively. Background is `#09090b` (zinc-950). Surfaces are `zinc-900`. Borders are `zinc-800`.
- Monospace for all technical values: frequencies (Hz), impedances (Ω), volumes (L), dimensions (mm), dB values.
- Domain-specific pill colors are the only accent color system — no random blues or greens outside the taxonomy.
- Every panel earns its screen real estate. If something isn't actionable or readable, it doesn't get a panel.
- Collapsible sidebars are the primary responsive mechanism — no layout reflows, no responsive grids that reflow awkwardly at intermediate widths.

**Typography:**
- `font-sans` (Geist Sans) — UI labels, headings, navigation, prose
- `font-mono` (Geist Mono) — all T/S parameters, frequencies, dimensions, file paths, code snippets, impedance values

**Domain color taxonomy** (pills only — never backgrounds):

| Domain | Color class | Hex approx |
|--------|-------------|------------|
| acoustics | violet | `#8b5cf6` |
| enclosure | amber | `#f59e0b` |
| crossover | sky | `#0ea5e9` |
| theory | emerald | `#10b981` |
| mechanical | orange | `#f97316` |
| research | rose | `#f43f5e` |
| manager | zinc | `#71717a` |

---

## 6.2 Route Structure

```
/dashboard
├── /chat                    ← Enhanced: + design state sidebar (right)
├── /projects                ← New: VituixCAD project list + upload
├── /projects/[id]           ← New: parsed project viewer
├── /knowledge               ← New: unified search across all source types
├── /literature              ← New: book/paper browser with TOC navigation
└── /workspace               ← Future (Phase 5): reactive design panels
```

All routes share a **root shell layout** (`dashboard/layout.tsx`) providing:
- Left navigation sidebar (collapsible, persisted in localStorage)
- Top-of-page breadcrumb bar
- No page-level padding — each route manages its own internal layout

### Route purposes

| Route | Primary job |
|-------|-------------|
| `/dashboard/chat` | Converse with agents; see reasoning + design state evolve in real time |
| `/dashboard/projects` | Upload and manage VituixCAD project files; see list of parsed projects |
| `/dashboard/projects/[id]` | Deep-inspect a single VituixCAD project: drivers, crossover, enclosure params |
| `/dashboard/knowledge` | Search across all knowledge types: conversations, literature, VituixCAD data |
| `/dashboard/literature` | Browse ingested books and papers; navigate by chapter; search within source |
| `/dashboard/workspace` | (Future) Reactive panel view of current design — enclosure, driver, crossover state |

---

## 6.3 Root Shell Layout

### Visual structure

```
┌─────────────────────────────────────────────────────────────────────┐
│ [◈ APEX]  Projects  Knowledge  Literature  Workspace  Chat     [···] │  ← top nav (48px)
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│                        <page content>                                 │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

The left sidebar from the current implementation becomes a **top navigation bar** at the root shell level. This frees the full vertical height for page content. The sidebar model is retained *within* individual pages (chat has a right sidebar; literature has a left TOC sidebar).

**Top nav bar (48px tall):**
- Far left: `◈ APEX` in `font-mono font-bold text-white` — links to `/dashboard/chat`
- Nav items (horizontal): Projects | Knowledge | Literature | Workspace | Chat
- Active item: white text, thin white underline (`border-b-2 border-white`)
- Inactive items: `text-zinc-400 hover:text-zinc-200`
- Far right: user avatar dropdown (future: project selector)

**Breadcrumb bar (32px, below top nav on detail pages):**
- Visible on `/projects/[id]` and `/literature/[id]`
- `text-zinc-500 text-xs font-mono` — `Projects / Woofer3Way.vxp`

---

## 6.4 `/dashboard/chat` — Enhanced Chat View

### Layout (three-column)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Top nav                                                               │
├─────────────┬──────────────────────────────────────┬─────────────────┤
│             │                                      │                 │
│  Agent      │         Chat stream                  │  Design State   │
│  Status     │                                      │  Panel          │
│  (200px)    │         (flex-1, scrollable)         │  (280px)        │
│             │                                      │                 │
│  collapsed  │                                      │  collapsible    │
│  ←→         │                                      │        →        │
├─────────────┴──────────────────────────────────────┴─────────────────┤
│  [ Message input — full width, sticky bottom ]                        │
└──────────────────────────────────────────────────────────────────────┘
```

**Left panel — Agent Status (200px, collapsible):**
- List of 7 agents, each as a compact row
- Row: colored left border (domain color) + agent name + status dot
- Status dot: gray (idle) / amber (thinking) / green (responded last turn)
- Clicking an agent row filters chat view to show only that agent's messages
- Collapsed state: icon-only column (28px) showing colored dots

**Center — Chat Stream (flex-1):**
- Existing streaming implementation retained
- Message bubbles: user messages right-aligned in `zinc-800` bg; agent messages left-aligned with domain color left border (`border-l-2`)
- Agent label above each response: `[ENCLOSURE]` in domain pill style
- No avatars — wastes horizontal space. Domain pill + agent label is sufficient.
- Code blocks: `bg-zinc-950 font-mono text-sm` with syntax highlight for JSON/params
- Citations: inline superscript `[1]` in `text-sky-400`, clickable → opens literature browser at that source

**Right panel — Design State Panel (280px, collapsible):**

This is the key new addition to the chat view. It is a **persistent reactive panel** that updates as agents reason.

```
Design State                                              [collapse →]
──────────────────────────────────────────────────────────
ENCLOSURE
  Type          Vented (bass reflex)
  Volume        42 L
  Port diam.    75 mm
  Port length   180 mm
──────────────────────────────────────────────────────────
DRIVER(S)
  Woofer        SB Acoustics SB17NAC35-4
  Tweeter       —
──────────────────────────────────────────────────────────
CROSSOVER
  Topology      2-way LR4
  Frequency     2,400 Hz
  Woofer order  4th (LR4)
  Tweeter order 4th (LR4)
──────────────────────────────────────────────────────────
SESSION
  Started       14:32
  Turns         12
  Active agent  Enclosure ●
──────────────────────────────────────────────────────────
```

- All numeric values in `font-mono text-sm text-zinc-200`
- Section headers (`ENCLOSURE`, `DRIVER(S)`, `CROSSOVER`, `SESSION`) in `text-xs font-mono text-zinc-500 uppercase tracking-widest`
- Empty/unknown values shown as `—` in `text-zinc-600`
- Panel updates via server-sent event stream or polling the `/api/design-state` endpoint
- Animate value changes: number transitions with a brief `text-amber-400` flash (150ms) when a value updates
- "Active agent" row shows a pulsing dot in the domain color when an agent is streaming

**Collapsed state:** Panel hides to a 28px tab labeled `◁ STATE` on the right edge. Click to expand.

**Message input (sticky bottom):**
- Full-width, `bg-zinc-900 border-t border-zinc-800`
- `textarea` auto-grows up to 6 lines
- Right side: send button + model indicator badge (`claude-sonnet-4-6` in `font-mono text-xs text-zinc-500`)
- Keyboard: `Enter` sends, `Shift+Enter` newline

---

## 6.5 `/dashboard/projects` — VituixCAD Project List

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Top nav                                                               │
├──────────────────────────────────────────────────────────────────────┤
│  Projects                                      [+ Upload Project]     │
│  ─────────────────────────────────────────────────────────────       │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │  Drop .vxp or .vxd files here, or click to browse          │     │
│  │  (dashed border, zinc-800, 120px tall)                      │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│  Recent Projects                                                      │
│  ─────────────                                                        │
│  ○ Woofer3Way.vxp         3-way · 3 drivers · 2026-03-27  [Open]     │
│  ○ BassReflexV2.vxd       2-way · 2 drivers · 2026-03-25  [Open]     │
│  ○ SubwooferSeal.vxp      1-way · 1 driver  · 2026-03-20  [Open]     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Upload zone:**
- Drag-and-drop target: `border-2 border-dashed border-zinc-700 rounded-md` with centered label
- On drag-over: border color shifts to `sky-500`, background becomes `zinc-800`
- Accepts: `.vxp`, `.vxd` (VituixCAD project formats)
- On upload: POST to `/api/projects/upload`, server parses file, redirects to `/dashboard/projects/[id]`
- Upload progress: inline progress bar in `sky-500` below drop zone during upload

**Project list:**
- Each row: filename (with extension in `text-zinc-500 font-mono`) + descriptor (Nway · N drivers) + date + `[Open]` button
- Rows are `hover:bg-zinc-900 cursor-pointer` — full row is clickable
- Empty state: "No projects yet. Upload a .vxp or .vxd file to begin."
- Sort: most recently uploaded first

---

## 6.6 `/dashboard/projects/[id]` — VituixCAD Project Viewer

### Layout (two-column with tabbed detail area)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Top nav                                                               │
│ Projects / Woofer3Way.vxp                         [Use in Chat →]     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────────────┐  ┌───────────────────────────────┐  │
│  │  Driver List                │  │  [Crossover] [Enclosure] [Sim]│  │
│  │  ─────────────────────────  │  │  ─────────────────────────── │  │
│  │  ◉ SB17NAC35-4 (Woofer)    │  │                               │  │
│  │    Fs  28 Hz               │  │    Crossover Topology         │  │
│  │    Vas 26.6 L              │  │    (SVG diagram)              │  │
│  │    Qts 0.33                │  │                               │  │
│  │    Re  3.5 Ω               │  │                               │  │
│  │    Sd  136 cm²             │  │                               │  │
│  │    Xmax 9.5 mm             │  │                               │  │
│  │                             │  │                               │  │
│  │  ◉ SB26CDC-C000-4 (Tweet.) │  │                               │  │
│  │    Fs  800 Hz              │  │                               │  │
│  │    Re  3.2 Ω               │  │                               │  │
│  │    ...                     │  │                               │  │
│  └─────────────────────────────┘  └───────────────────────────────┘  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Left panel — Driver List (fixed 320px):**
- Heading: `Driver List` in `text-sm font-semibold text-zinc-200`
- Each driver card: `bg-zinc-900 border border-zinc-800 rounded p-3 mb-2`
- Driver role badge: `Woofer` / `Tweeter` / `Midrange` in domain pill style (enclosure=amber for woofer; crossover=sky for tweeter; theory=emerald for midrange)
- Driver model name: `font-mono text-sm text-zinc-100`
- T/S parameters in a two-column grid: label `text-zinc-500 text-xs` + value `font-mono text-xs text-zinc-200`
- Parameters shown: Fs, Vas, Qts, Qes, Qms, Re, Le, Sd, Xmax, BL, Mms, Cms, Rms
- If a param is missing from the file: show `—` in `text-zinc-600`

**Right panel — Tabbed detail area:**

Three tabs: `Crossover` | `Enclosure` | `Simulation`

**Tab: Crossover**

Renders a simplified crossover topology diagram in SVG. The diagram is auto-generated from the parsed crossover component data.

SVG layout conventions:
- Input (left) → component chain → output (right)
- Each component is a labeled rectangle: `L1: 1.5 mH`, `C1: 10 µF`, `R1: 5.6 Ω`
- Inductor symbol: coil graphic or labeled box with `L` prefix
- Capacitor: labeled box with `C` prefix
- Resistor: labeled box with `R` prefix
- Parallel branches: drawn as vertical splits with horizontal reconnect
- Color: component boxes in `zinc-800 border zinc-700`, component labels in `font-mono text-xs`
- Driver loads shown as rectangles labeled with driver model name
- Crossover frequency annotation: `ƒc = 2,400 Hz` in `text-sky-400 font-mono text-xs` at the branch point

If crossover data is absent or too complex to auto-render: fall back to a structured table listing all components with values.

**Tab: Enclosure**

```
Enclosure Parameters
─────────────────────────────────────────
Type              Vented (bass reflex)
Net volume        42.0 L
Port diameter     75 mm
Port length       178 mm
Tuning frequency  38 Hz
Panel thickness   19 mm
Material          MDF
─────────────────────────────────────────
```

Same label/value grid pattern as the driver list. `font-mono` values, `text-zinc-500` labels.

If multiple enclosure sections exist (e.g., isobaric or MLTL), show each as a titled sub-section.

**Tab: Simulation**

Parsed simulation settings from the VituixCAD file:

```
Simulation Settings
─────────────────────────────────────────
Frequency range   20 Hz – 20,000 Hz
Resolution        1/48 octave
Baffle width      350 mm
Baffle height     600 mm
Measurement dist. 1 m
─────────────────────────────────────────
```

**Action button — `[Use in Chat →]`:**
- Top-right of the page, `bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded px-3 py-1.5`
- On click: opens `/dashboard/chat` with a pre-populated message context: "I've loaded project Woofer3Way.vxp. Here are the drivers and enclosure specs: [summary]. Let's optimize the crossover."
- The design state panel on the chat page auto-populates from this project's data

---

## 6.7 `/dashboard/knowledge` — Unified Search

### Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Top nav                                                               │
├──────────────────────────────────────────────────────────────────────┤
│  Knowledge Search                                                     │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ 🔍  Search conversations, literature, projects...               │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Filter by source:  [All ▼]  [Conversations]  [Literature]  [Projects]│
│  Filter by domain:  [All ▼]  [Acoustics] [Enclosure] [Crossover] ...  │
│                                                                       │
│  ─── Results ──────────────────────────────────────────────────────  │
│                                                                       │
│  ┌─ LITERATURE ──────────────────────────────────────────────────┐   │
│  │  Vented Box Alignments — Dickason, Ch. 4                       │   │
│  │  "...the Butterworth B4 alignment yields flat response when    │   │
│  │  Qtc = 0.707 and the box tuning frequency Fb equals..."        │   │
│  │  [enclosure]                                     [Open source] │   │
│  └──────────────────────────────────────────────────────────────── │   │
│                                                                       │
│  ┌─ CONVERSATION ────────────────────────────────────────────────┐   │
│  │  Port tuning for SB17 — 2026-03-15                             │   │
│  │  "The port should be tuned to 38Hz for a Qtc of 0.707..."      │   │
│  │  [enclosure] [theory]                       [Open in chat]     │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Search input:**
- Full-width, `bg-zinc-900 border border-zinc-800 rounded-md px-4 py-2.5 text-zinc-100 placeholder:text-zinc-500`
- Debounced at 300ms — triggers pgvector cosine similarity search via `/api/knowledge/search`
- Search covers: `knowledge_chunks` table (all source types)

**Filter bar:**
- Source type toggles: pill buttons. Active = `bg-zinc-700 text-white`. Inactive = `bg-transparent text-zinc-400 border border-zinc-800`
- Domain filter: same pill button pattern using domain colors (text color, not background)
- Filters compose with AND logic

**Result cards:**
- Grouped by source type with a `text-xs font-mono text-zinc-500 uppercase tracking-widest` group header
- Each card: `bg-zinc-900 border border-zinc-800 rounded p-3`
  - Source title + location (chapter / date) in `text-sm text-zinc-200`
  - Excerpt: 2–3 lines, `text-sm text-zinc-400`, with search terms bolded (`font-semibold text-zinc-200`)
  - Domain pills (small, `text-xs`)
  - Action link: `[Open source]` → routes to literature viewer or project viewer or conversation replay

**Empty/loading states:**
- Loading: 3 skeleton cards with `animate-pulse bg-zinc-800`
- No results: "No results for '{query}'. Try broader terms or different domain filters."
- Zero-state (no query): show "Recently added knowledge" — 6 most recent chunks across all types

---

## 6.8 `/dashboard/literature` — Book & Paper Browser

This page functions like a documentation site for speaker design books — TOC navigation on the left, chapter content on the right, search within the source.

### Layout (three-zone)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Top nav                                                               │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────────────────────────────┐   │
│  │  Library        │  │  [ Search within source... ]             │   │
│  │  ─────────────  │  │  ─────────────────────────────────────── │   │
│  │                 │  │                                           │   │
│  │  Books          │  │  Chapter 4 — Vented Box Alignments        │   │
│  │  › Dickason     │  │                                           │   │
│  │    Ch. 1        │  │  The fundamental design equations for     │   │
│  │    Ch. 2        │  │  vented enclosures were derived by...     │   │
│  │    Ch. 3        │  │                                           │   │
│  │  ▸ Ch. 4 ←      │  │  Qtc = 0.707 achieves maximally flat     │   │
│  │    Ch. 5        │  │  Butterworth response. Port tuning Fb     │   │
│  │                 │  │  should satisfy: Fb = Fs · (Qts/0.2)^... │   │
│  │  Papers         │  │                                           │   │
│  │  › AES #1234    │  │  [enclosure] [theory]                    │   │
│  │  › ASR thread   │  │                                           │   │
│  │                 │  │  ─────────────────────────────────────── │   │
│  │  [+ Add source] │  │  < Chapter 3       Chapter 5 >            │   │
│  └─────────────────┘  └──────────────────────────────────────────┘   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

**Left panel — Library TOC (240px, fixed):**
- Source list grouped: `Books` | `Papers` | `Conversations` (as section headers)
- Each book: expandable tree. Collapsed = book title only. Expanded = book title + chapter list
- Active chapter: `bg-zinc-800 text-white rounded`
- Chapter items: `text-sm text-zinc-400 hover:text-zinc-200 py-0.5 pl-4 cursor-pointer`
- `[+ Add source]` button at bottom: opens upload modal for PDF or markdown files

**Center — Chapter content viewer:**
- `max-w-2xl mx-auto` — readable line length even on wide screens
- Chapter/section title: `text-lg font-semibold text-zinc-100 mb-4`
- Body text: `text-sm text-zinc-300 leading-relaxed` — prose rendering
- Technical values inline: `font-mono text-zinc-200` for any numbers with units
- Equations: rendered via KaTeX if LaTeX markup present in source; plain text fallback
- Domain pills below title: indicate which domains this chunk covers
- Prev/Next chapter navigation at bottom

**Search within source:**
- Scoped to the current book/paper only — filters pgvector search by `source_id`
- Results highlight matching chunks, clicking navigates to that chapter position

---

## 6.9 `/dashboard/workspace` — Reactive Design Panels (Future)

This route is **stubbed** in Phase 4 and fully implemented in Phase 5. Navigation link is visible but shows a "Coming in Phase 5" state.

### Planned layout (for spec purposes)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Top nav                                                               │
├───────────────────┬──────────────────────┬───────────────────────────┤
│                   │                      │                           │
│  Enclosure Panel  │   Driver Panel       │   Crossover Panel         │
│  (flex-1/3)       │   (flex-1/3)         │   (flex-1/3)              │
│                   │                      │                           │
│  Type: BR         │  Woofer: SB17NAC35   │  Topology: LR4 2-way      │
│  Vol:  42 L       │  Tweeter: SB26CDC    │  ƒc: 2,400 Hz             │
│  Fb:   38 Hz      │                      │                           │
│  Port: ø75×178mm  │  [T/S params table]  │  [Component list]         │
│                   │                      │                           │
│  [Optimize →]     │  [Swap driver →]     │  [Simulate →]             │
│                   │                      │                           │
├───────────────────┴──────────────────────┴───────────────────────────┤
│  Chat input (workspace-scoped — messages go to relevant agent only)   │
└──────────────────────────────────────────────────────────────────────┘
```

Each panel is a module that:
1. Reads current design state from `/api/design-state`
2. Displays current values in an editable form
3. Sends changes to the appropriate specialist agent via the workspace chat input
4. Updates in real time as agent responses arrive

The workspace chat input differs from `/chat` — it routes directly to the domain agent of the panel being edited, bypassing the Project Manager routing layer.

---

## 6.10 Component Architecture

### Shared components

```
components/
├── ui/                           ← shadcn/ui primitives (untouched)
│   ├── badge.tsx
│   ├── button.tsx
│   ├── input.tsx
│   ├── tabs.tsx
│   └── ...
│
├── apex/                         ← APEX-specific components
│   ├── DomainPill.tsx            ← Domain badge pill (color by domain prop)
│   ├── TechValue.tsx             ← font-mono value with optional unit
│   ├── ParamGrid.tsx             ← label/value 2-col grid for T/S params
│   ├── AgentStatusDot.tsx        ← pulsing dot with domain color
│   ├── SectionHeader.tsx         ← UPPERCASE zinc-500 section label
│   └── CollapsiblePanel.tsx      ← right/left collapsible panel wrapper
│
├── chat/
│   ├── ChatStream.tsx            ← message list with streaming support
│   ├── ChatMessage.tsx           ← single message bubble with domain pill
│   ├── ChatInput.tsx             ← sticky textarea + send button
│   ├── AgentStatusPanel.tsx      ← left panel: 7 agent rows
│   └── DesignStatePanel.tsx      ← right panel: enclosure/driver/xover state
│
├── projects/
│   ├── ProjectUploadZone.tsx     ← drag-and-drop upload area
│   ├── ProjectListRow.tsx        ← single row in project list
│   ├── DriverCard.tsx            ← driver with T/S param grid
│   ├── CrossoverDiagram.tsx      ← SVG topology renderer
│   └── EnclosureParams.tsx       ← enclosure tab content
│
├── knowledge/
│   ├── KnowledgeSearchBar.tsx    ← debounced search input
│   ├── SearchFilterBar.tsx       ← source type + domain filter pills
│   ├── KnowledgeResultCard.tsx   ← single result with excerpt + pills
│   └── KnowledgeResultGroup.tsx  ← grouped results by source type
│
└── literature/
    ├── LibraryTOC.tsx            ← left panel: source tree + chapter list
    ├── ChapterContent.tsx        ← prose renderer with tech value handling
    ├── ChapterNav.tsx            ← prev/next chapter navigation
    └── InSourceSearch.tsx        ← search scoped to current source
```

### Key component contracts

**`DomainPill`**
```tsx
// Props
domain: 'acoustics' | 'enclosure' | 'crossover' | 'theory' | 'mechanical' | 'research' | 'manager'
size?: 'xs' | 'sm'  // default 'sm'
```
Renders a `<Badge>` with domain-specific text color and `bg-zinc-800` background.

**`ParamGrid`**
```tsx
// Props
params: Array<{ label: string; value: string | number | null; unit?: string }>
columns?: 1 | 2  // default 2
```
Renders label/value pairs. Values are wrapped in `<TechValue>`. Null values render `—`.

**`DesignStatePanel`**
```tsx
// Props
projectId?: string       // if loaded from VituixCAD file
sessionId: string        // current chat session
collapsed: boolean
onToggle: () => void
```
Polls `/api/design-state?session={sessionId}` every 2 seconds, or subscribes to SSE if available. Animates changed values.

**`CrossoverDiagram`**
```tsx
// Props
components: CrossoverComponent[]  // parsed from VituixCAD file
topology: 'series' | 'parallel' | 'mixed'
```
Returns an SVG element. Max width 100% of container. Viewbox auto-sized to component count.

### State management

No global state library. State flows as follows:
- Chat session state: managed by AI SDK `useChat` hook
- Design state: React Query polling of `/api/design-state`
- Sidebar collapse state: `localStorage` via a `useLocalStorage` hook
- VituixCAD project data: React Query cache by project ID
- Knowledge search results: React Query keyed by `[query, filters]`

---

## 6.11 Responsive Considerations

APEX is **primarily a desktop application**. Target viewport: 1280px+. All layouts are designed for 1440px wide screens.

### Breakpoint behavior

| Viewport | Behavior |
|----------|----------|
| ≥ 1280px | Full three-column chat, full two-column project viewer |
| 1024–1279px | Left agent panel auto-collapses; right design state panel remains |
| 768–1023px | Both sidebars collapsed by default; single-column chat |
| < 768px | Navigation collapses to hamburger menu; project viewer shows driver list only (tabs hidden) |

### Collapsible panel rules
- Collapse state persists in `localStorage` per panel per route
- Panels always collapse inward (push, not overlay) — no overlays except mobile hamburger
- Collapsed panels show a thin tab (28px) with rotated label text for quick expand
- Keyboard shortcut: `Cmd+[` collapses left panel, `Cmd+]` collapses right panel

### Minimum usable viewport
The application is unusable below 640px width. A polite banner is shown at < 640px: "APEX is designed for desktop use. Some features may not display correctly on small screens."

---

## 6.12 Visual Layout Descriptions

### Chat page — full state

The chat page at 1440px wide shows:

- Top nav (48px): `◈ APEX` → `Chat` (active, underlined) → other nav items
- Left panel (200px): 7 agent rows. Each row is 32px tall: 4px colored left border, 8px gap, agent name `text-sm text-zinc-300`, status dot (8px circle) right-aligned. Example: `[violet border] Acoustics ●`
- Center (flex-1, ~760px): chat stream. Messages are 80% of center width, right-aligned for user (`bg-zinc-800`), left-aligned for agent. Agent messages have a 2px left border in domain color and a domain pill + agent name label 8px above the bubble.
- Right panel (280px): Design State Panel. Zinc-900 background, zinc-800 border on the left edge. Three sections (ENCLOSURE / DRIVER(S) / CROSSOVER) each separated by a single-pixel `border-t border-zinc-800`. Values change with a 150ms amber flash transition.
- Bottom bar (72px): `bg-zinc-950 border-t border-zinc-800`. Textarea 56px tall (expandable). Send button far right: `bg-white text-zinc-950 text-sm font-semibold rounded px-4 py-1.5 hover:bg-zinc-200`.

### Project viewer — loaded project

At 1440px:

- Breadcrumb (32px): `text-zinc-500 font-mono text-xs` — `Projects / Woofer3Way.vxp` + `[Use in Chat →]` button far right
- Left panel (320px): Driver cards stacked vertically. Each card: 16px padding, enclosure-amber left border for woofer, sky left border for tweeter. Driver name bold at top, T/S param grid below in 2 columns.
- Right area (flex-1): Tab bar at top (`Crossover | Enclosure | Simulation`) in `zinc-800` background with active tab white underline. Content below is the selected tab view.
- Crossover tab: SVG diagram centered in available width. Components drawn left-to-right. Parallel paths split vertically. All labels in `font-mono text-xs`.

### Knowledge search — active query

- Search bar (full width, centered max-w-3xl): prominent, 48px tall
- Filter pills below search bar, single row
- Results in a single column, max-w-3xl, grouped by source type
- Each result card: 8px top/bottom padding, source name in `text-sm text-zinc-200`, excerpt in `text-sm text-zinc-400`, pills at bottom right, action link at bottom right

### Literature browser — open chapter

- Left TOC panel (240px, full page height, independent scroll): book list at top, chapter list expands inline. Active chapter highlighted.
- Right content area (flex-1, max-w-2xl for text, centered): chapter title at top, body text below. Domain pills above title. Prev/Next at page bottom. Inline search bar fixed at top of content area (below breadcrumb), always visible.

---

## 6.13 Implementation Priority

Build these UI routes in order:

| Priority | Route | Reason |
|----------|-------|--------|
| 1 | `/dashboard/chat` (enhanced) | Core interaction surface; design state panel unlocks agent value |
| 2 | `/dashboard/projects` + `/projects/[id]` | VituixCAD integration is a key differentiator |
| 3 | `/dashboard/knowledge` | Enables discovery of ingested knowledge |
| 4 | `/dashboard/literature` | Makes knowledge browsable and citable |
| 5 | `/dashboard/workspace` | Phase 5 — deferred |

Each route should be independently deployable. Stub missing routes with a tasteful `[Coming soon]` state (not a 404).

---

*End of Section 6 — UI & Dashboard Evolution*
