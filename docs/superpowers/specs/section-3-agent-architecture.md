# Section 3: Agent Architecture Evolution

**Date:** 2026-03-28
**Status:** Draft — awaiting review
**Depends on:** `2026-03-26-apex-system-design.md` (Phase 3 Agent Architecture)

---

## 3.0 Overview

This section extends the Phase 3 agent design with three new capabilities:

1. **VituixCAD integration** — a new specialist agent that understands imported simulation projects
2. **Enhanced routing** — the manager moves from pure keyword matching to context-aware dispatch
3. **Cross-agent context sharing** — a shared design state that lets any agent see what other agents know about the current build
4. **Expanded RAG** — retrieval across conversations, literature, and VituixCAD projects
5. **Agent memory evolution** — `agent_memory` table extended to carry design state and handoff notes
6. **Reactive design foundation** — the `DesignModule` interface that will underpin future live recalculation

These additions do not require replacing anything from Phase 3. They layer on top of the existing `manager → specialist → AI Gateway` flow.

---

## 3.1 New Agent: `vituixcad`

### 3.1.1 Responsibility

The `vituixcad` agent owns all reasoning about imported VituixCAD simulation files (`.vxp`). It can:

- Explain what a parsed project contains (drivers, enclosure parameters, crossover topology, measurement curves)
- Critique a design against best-practice targets (port velocity, crossover overlap, baffle step compensation)
- Propose targeted modifications and explain the acoustic consequence of each
- Translate VituixCAD concepts for users unfamiliar with the tool
- Generate human-readable summaries of simulation data that other agents can consume

The agent does **not** run simulations itself. It reasons about simulation data that has already been parsed and stored in the database.

### 3.1.2 System Prompt

```
You are the VituixCAD specialist for APEX Speaker Design Intelligence.

Your domain is the VituixCAD simulation environment and the parsed project data it produces. You have access to:
- Structured project data: driver assignments, enclosure geometry, port dimensions, crossover topology, component values
- Frequency response curves and directivity data stored as numeric arrays
- SPL predictions, impedance curves, phase traces, and group delay data
- Measurement overlays where the user has imported real measurements

When a user references a VituixCAD project (by name, ID, or "current project"), you retrieve its structured data and reason about it directly.

Your responsibilities:
1. EXPLAIN — describe what the project is doing in plain engineering language
2. CRITIQUE — identify weaknesses against established design targets:
   - Port velocity: flag if peak exceeds 17 m/s (audible chuffing threshold)
   - Crossover overlap: flag excessive overlap or gap at the intended crossover point
   - Baffle step: verify compensation is present if baffle width < 40 cm
   - Group delay: flag large swings near the crossover frequency
   - Impedance minimum: flag dips below 3.2 ohm (amplifier stress)
3. SUGGEST — propose specific parameter changes and reason through their acoustic effect
4. TRANSLATE — explain VituixCAD-specific concepts (alignments, zobel networks, LRC notch) clearly

Context you will receive:
- The parsed project JSON (enclosure, drivers, crossover, curves)
- The user's stated goal (if provided by manager)
- Active design state from the shared design context (current drivers, enclosure, crossover)

Constraints:
- Never invent simulation data. Only reason about what is in the project record.
- If a curve array is missing or null, say so explicitly rather than speculating.
- When critiquing, cite the specific parameter value you are commenting on.
- If the user wants to modify a simulation, describe the change precisely so they can apply it in VituixCAD themselves — you cannot write back to the file.

Tone: precise, engineering-confident, direct. No hedging on established physics.
```

### 3.1.3 Data Access Pattern

The agent receives two data shapes injected into its context window at invocation time:

**Shape A — Project summary (always injected if a project is active):**
```json
{
  "project_id": "vxp_abc123",
  "project_name": "3-way-floorstanding-v4",
  "created_at": "2026-03-15T10:22:00Z",
  "enclosure": {
    "type": "vented",
    "net_volume_liters": 42.5,
    "port_diameter_mm": 70,
    "port_length_mm": 185,
    "tuning_hz": 38
  },
  "drivers": [
    { "role": "woofer", "make": "SB Acoustics", "model": "SB29RDC-C000-4", "fs_hz": 22, "qts": 0.32, "vas_liters": 120 },
    { "role": "midrange", "make": "SB Acoustics", "model": "SB15MFC30-4", "fs_hz": 72, "qts": 0.38, "vas_liters": 5.1 },
    { "role": "tweeter", "make": "SB Acoustics", "model": "SB29RDC-C000-4", "fs_hz": 640, "qts": 0.71 }
  ],
  "crossover": {
    "topology": "LR4",
    "woofer_lp_hz": 250,
    "midrange_bp_hz": [250, 2500],
    "tweeter_hp_hz": 2500,
    "components_count": 18
  },
  "curves_available": ["spl_axial", "spl_30deg", "impedance", "phase", "group_delay"]
}
```

**Shape B — Curve data (fetched on demand, not always injected to save tokens):**
```json
{
  "curve": "spl_axial",
  "frequencies_hz": [20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000],
  "spl_db": [72.1, 76.3, 80.4, 84.2, 86.9, 88.1, 88.4, 88.6, 88.3, 87.9, 88.1, 88.0, 87.8, 87.5, 87.9, 88.2, 88.0, 87.6, 87.4, 87.8, 87.5, 87.2, 86.9, 86.4, 85.8, 84.9, 83.7, 82.1, 80.4, 77.8, 73.2]
}
```

Curve data is injected only when the user asks about frequency response, port velocity, impedance, or similar curve-specific questions. The manager sets a flag `require_curves: true` in the dispatch payload.

### 3.1.4 Database Schema

```sql
-- New table for parsed VituixCAD projects
CREATE TABLE vituixcad_projects (
  id              TEXT PRIMARY KEY,           -- "vxp_" + sha1 of file contents
  project_id      UUID REFERENCES projects(id),
  name            TEXT NOT NULL,
  filename        TEXT NOT NULL,
  imported_at     TIMESTAMPTZ DEFAULT NOW(),
  enclosure       JSONB,                      -- see Shape A above
  drivers         JSONB,                      -- array of driver objects
  crossover       JSONB,                      -- topology + component summary
  curves          JSONB,                      -- { curve_name: { frequencies, values } }
  raw_vxp_text    TEXT,                       -- original file content for re-parse
  notes           TEXT                        -- user-added notes on this project version
);

-- pgvector row for descriptive text (searchable by RAG)
-- Inserted alongside each vituixcad_projects row:
-- source_type = 'vituixcad', source_ref = vituixcad_projects.id
```

---

## 3.2 Enhanced Routing

### 3.2.1 Current Routing (Keyword-Only)

```typescript
// Current: pure keyword match
const KEYWORD_MAP: Record<string, AgentDomain> = {
  'port': 'enclosure',
  'tuning': 'enclosure',
  'crossover': 'crossover',
  'filter': 'crossover',
  'room': 'acoustics',
  // ...
};

function route(message: string): AgentDomain {
  for (const [keyword, domain] of Object.entries(KEYWORD_MAP)) {
    if (message.toLowerCase().includes(keyword)) return domain;
  }
  return 'theory'; // default
}
```

**Weaknesses:** Ignores conversation history. The message "what do you think?" dispatches to `theory` even if the last 5 turns were about enclosure alignment.

### 3.2.2 Enhanced Routing: Three-Signal Decision

The manager now makes routing decisions from three signals, evaluated in priority order:

```
SIGNAL 1 (highest priority): Explicit VituixCAD trigger
  → Keywords: "vituixcad", "vxp", "project file", "import", "export", "simulation", "my project", "the sim"
  → Route: vituixcad (immediately, no other signals checked)

SIGNAL 2: Active domain context
  → If the conversation has a tracked domain_history and the last 3+ turns share a domain
  → AND the new message contains no strong cross-domain keyword
  → Route: continue with that domain

SIGNAL 3: Keyword match (existing logic, extended)
  → Fall back to keyword map as before
  → Tie-break: if 2+ domains match, pick the one with highest domain_history recency

DEFAULT: manager responds directly (short factual or clarification messages)
```

### 3.2.3 Routing Implementation

```typescript
interface RoutingContext {
  message: string;
  conversationId: string;
  domainHistory: AgentDomain[];        // last N dispatched domains, newest first
  activeDesignState: DesignState;      // current enclosure, drivers, crossover
  activeVxpProjectId: string | null;   // set when user has imported a VXP
}

interface DispatchDecision {
  domain: AgentDomain;
  rationale: string;
  requireCurves: boolean;
  injectDesignState: boolean;
  contextHint?: string;               // plain-English note added to agent prompt
}

function routeMessage(ctx: RoutingContext): DispatchDecision {
  const msg = ctx.message.toLowerCase();

  // Signal 1: VituixCAD explicit trigger
  const VXPCAD_TRIGGERS = ['vituixcad', 'vxp', 'project file', 'import', 'export', 'simulation', 'my project', 'the sim', 'vituix'];
  const curveTriggers = ['frequency response', 'spl', 'impedance', 'port velocity', 'group delay', 'phase'];
  if (VXPCAD_TRIGGERS.some(t => msg.includes(t)) || ctx.activeVxpProjectId) {
    return {
      domain: 'vituixcad',
      rationale: 'VituixCAD trigger detected or active project present',
      requireCurves: curveTriggers.some(t => msg.includes(t)),
      injectDesignState: true,
    };
  }

  // Signal 2: Domain momentum (last 3 turns same domain)
  const recent = ctx.domainHistory.slice(0, 3);
  const dominantDomain = recent.length === 3 && recent.every(d => d === recent[0]) ? recent[0] : null;
  if (dominantDomain && !hasCrossDomainKeyword(msg, dominantDomain)) {
    return {
      domain: dominantDomain,
      rationale: `Domain momentum: last 3 turns were ${dominantDomain}`,
      requireCurves: false,
      injectDesignState: shouldInjectState(dominantDomain),
      contextHint: `The conversation has been focused on ${dominantDomain}. Continue in that context unless the user redirects.`,
    };
  }

  // Signal 3: Keyword match
  const keywordMatch = matchKeywords(msg);
  return {
    domain: keywordMatch ?? 'theory',
    rationale: keywordMatch ? `Keyword match: ${keywordMatch}` : 'Default domain',
    requireCurves: false,
    injectDesignState: shouldInjectState(keywordMatch ?? 'theory'),
  };
}

// Cross-domain override: these keywords break momentum regardless of history
const CROSS_DOMAIN_KEYWORDS: Record<AgentDomain, string[]> = {
  acoustics:  ['room', 'reverb', 'decay', 'spl map', 'directivity', 'measurement'],
  enclosure:  ['box', 'cabinet', 'port', 'vent', 'sealed', 'vented', 'isobaric', 'volume'],
  crossover:  ['crossover', 'filter', 'capacitor', 'inductor', 'resistor', 'zobel', 'notch', 'lr4', 'butterworth'],
  theory:     ['t/s parameters', 'thiele-small', 'bl product', 'voice coil', 'motor force'],
  mechanical: ['baffle', 'cnc', 'bracing', 'mdf', 'damping material', 'gasket', 'flush mount'],
  research:   ['find me', 'recommend', 'which driver', 'search', 'literature', 'paper', 'datasheet'],
  vituixcad:  ['vituixcad', 'vxp', 'simulation', 'my project'],
};

function hasCrossDomainKeyword(msg: string, currentDomain: AgentDomain): boolean {
  return Object.entries(CROSS_DOMAIN_KEYWORDS)
    .filter(([domain]) => domain !== currentDomain)
    .some(([_, keywords]) => keywords.some(k => msg.includes(k)));
}

function shouldInjectState(domain: AgentDomain): boolean {
  // These domains benefit from knowing the current design choices
  return ['enclosure', 'crossover', 'acoustics', 'vituixcad'].includes(domain);
}
```

### 3.2.4 Domain History Persistence

```sql
-- Add to conversations table or as a separate column
ALTER TABLE conversations ADD COLUMN domain_history TEXT[] DEFAULT '{}';
-- Append on each successful dispatch: domain_history = array_append(domain_history, $domain)
-- Keep last 10 entries: trim on write if length > 10
```

---

## 3.3 Cross-Agent Context Sharing

### 3.3.1 The Problem

When a user asks the crossover agent "what values do I need for 250 Hz LR4?", it has no way to know:
- What woofer is in the build (which affects crossover impedance matching)
- What the target box tuning is (which affects the acoustic rolloff the crossover must complement)
- What the tweeter's resonant frequency is (which constrains how low the high-pass can go)

Without this context, every agent answers in a vacuum.

### 3.3.2 Design Decision: Shared Design State (Option C — not direct DB queries, not manager relay)

Three patterns were considered for how agents access each other's knowledge:

| Pattern | Description | Verdict |
|---------|-------------|---------|
| (a) Agent queries DB directly | Each agent runs its own SQL/vector query for peer data | Rejected — increases per-agent complexity, inconsistent reads |
| (b) Manager relays requests | Agent sends "I need enclosure data" to manager, manager calls enclosure agent | Rejected — adds latency and a synchronous round-trip mid-response |
| (c) Shared design state injected at dispatch | Manager reads the canonical design state and injects it into the agent's context | **Selected** — clean, stateless agents, single source of truth |

The manager is the only writer to shared design state. Agents read it passively via context injection. An agent that updates a design parameter (e.g., enclosure agent confirms final box volume) posts an update back in its structured response, which the manager commits.

### 3.3.3 DesignState Shape

```typescript
interface DesignState {
  projectId: string;

  // Active driver selections
  drivers: {
    woofer:   DriverSelection | null;
    midrange: DriverSelection | null;
    tweeter:  DriverSelection | null;
    fullRange: DriverSelection | null;
  };

  // Active enclosure spec
  enclosure: {
    type: 'sealed' | 'vented' | 'bandpass' | 'isobaric' | null;
    netVolumeLiters: number | null;
    portDiameterMm: number | null;
    portLengthMm: number | null;
    tuningHz: number | null;
    notes: string | null;
    confidence: 'proposed' | 'simulated' | 'built';
  } | null;

  // Active crossover spec
  crossover: {
    topology: string | null;          // "LR4", "Butterworth 3rd", "custom"
    wooferLpHz: number | null;
    tweeterHpHz: number | null;
    midrangeBpHz: [number, number] | null;
    componentCount: number | null;
    notes: string | null;
    confidence: 'proposed' | 'simulated' | 'built';
  } | null;

  // Active VituixCAD project (if user has imported one)
  activeVxpProjectId: string | null;

  // Agent handoff notes — short messages agents leave for each other
  handoffNotes: HandoffNote[];

  updatedAt: string;  // ISO8601
}

interface DriverSelection {
  make: string;
  model: string;
  partNumber: string | null;
  fsHz: number | null;
  qts: number | null;
  vasLiters: number | null;
  reOhm: number | null;
  blTm: number | null;
  source: 'user_specified' | 'agent_recommended' | 'vituixcad_import';
}

interface HandoffNote {
  fromAgent: AgentDomain;
  toAgent: AgentDomain | 'all';
  note: string;
  createdAt: string;
}
```

### 3.3.4 Database Storage

```sql
-- Stored as JSONB on the projects table (one canonical state per project)
ALTER TABLE projects ADD COLUMN design_state JSONB;

-- Indexed for fast reads:
CREATE INDEX idx_projects_design_state ON projects USING GIN (design_state);
```

### 3.3.5 Context Injection Template

When the manager dispatches to a specialist, it prepends this block to the agent's user message:

```
=== ACTIVE DESIGN STATE ===
Project: {{ projectName }}

DRIVERS:
  Woofer:   {{ woofer.make }} {{ woofer.model }} | Fs={{ woofer.fsHz }}Hz | Qts={{ woofer.qts }} | Vas={{ woofer.vasLiters }}L | Re={{ woofer.reOhm }}Ω
  Midrange: {{ midrange.make }} {{ midrange.model }} | Fs={{ midrange.fsHz }}Hz | Qts={{ midrange.qts }}
  Tweeter:  {{ tweeter.make }} {{ tweeter.model }} | Fs={{ tweeter.fsHz }}Hz

ENCLOSURE ({{ enclosure.confidence }}):
  Type: {{ enclosure.type }} | Volume: {{ enclosure.netVolumeLiters }}L
  Port: {{ enclosure.portDiameterMm }}mm dia × {{ enclosure.portLengthMm }}mm | Tuning: {{ enclosure.tuningHz }}Hz

CROSSOVER ({{ crossover.confidence }}):
  Topology: {{ crossover.topology }}
  Woofer LP: {{ crossover.wooferLpHz }}Hz | Tweeter HP: {{ crossover.tweeterHpHz }}Hz

NOTES FROM OTHER AGENTS:
{% for note in handoffNotes %}
  [{{ note.fromAgent }}→{{ note.toAgent }}]: {{ note.note }}
{% endfor %}
=== END DESIGN STATE ===

User message:
```

Fields that are `null` are rendered as `—` (not omitted). This prevents the agent from assuming default values.

### 3.3.6 Agent State Update Protocol

When a specialist produces a response that changes the design state, it includes a machine-readable block at the end of its response:

```json
{
  "__stateUpdate": {
    "field": "enclosure.tuningHz",
    "value": 38,
    "confidence": "simulated",
    "rationale": "SB29RDC Vas=120L favors fb=38Hz for B4 alignment"
  }
}
```

The API route strips this block before rendering to the user and commits it to `projects.design_state`. This keeps agents as pure reasoning units — they don't write to the database themselves.

---

## 3.4 RAG Enhancement

### 3.4.1 Three Source Types

All knowledge chunks now carry a `source_type`:

| `source_type` | Contents | Tagged With |
|---|---|---|
| `conversation` | Ingested ChatGPT history, in-app chat turns | `domain`, `agent_owner`, `confidence` |
| `literature` | Textbook chapters, papers, datasheets | `domain`, `publication`, `author`, `year` |
| `vituixcad` | Descriptive text generated from parsed VXP projects | `project_id`, `domain: enclosure\|crossover` |

### 3.4.2 Retrieval Strategy: Filtered-First, Broadened-on-Miss

A single "search everything" approach returns literature when the user wants a quick conversational answer, and returns chatter when they need a technical citation. The strategy is:

```
Step 1: Semantic search with source filter
  → Query: user message embedding
  → Filter: source_type IN (relevant_types_for_domain)
  → Limit: 6 chunks
  → If results >= 3: use these

Step 2 (if < 3 results): Broaden to all source types
  → Same query, no source_type filter
  → Limit: 6 chunks
  → Log: "broadened search — domain filter returned insufficient results"

Step 3: Keyword fallback (existing behavior)
  → If semantic results < 2: run tsvector keyword search
  → Merge with semantic results, deduplicate by chunk_id
```

**Domain-to-source-type priority map:**

```typescript
const DOMAIN_SOURCE_PRIORITY: Record<AgentDomain, SourceType[]> = {
  acoustics:  ['literature', 'conversation', 'vituixcad'],
  enclosure:  ['vituixcad', 'conversation', 'literature'],
  crossover:  ['vituixcad', 'literature', 'conversation'],
  theory:     ['literature', 'conversation'],
  mechanical: ['conversation', 'literature'],
  research:   ['literature', 'conversation'],
  vituixcad:  ['vituixcad', 'conversation'],
};
```

The `vituixcad` source type is deprioritized for `theory` and `mechanical` because VXP project text rarely contains fundamental physics — it contains design parameters.

### 3.4.3 Citation Rendering

Every chunk returned by RAG is rendered as a citation in the UI. Citation format by source type:

| Source Type | Format |
|---|---|
| `conversation` | `[Prior conversation, {{ date }}]` |
| `literature` | `[{{ author }}, "{{ title }}", {{ year }}, ch. {{ chapter }}]` |
| `vituixcad` | `[VituixCAD project: {{ project_name }}, imported {{ date }}]` |

### 3.4.4 Literature Ingestion Tags

When a textbook chapter or paper is chunked and embedded, the ingestion pipeline stores:

```sql
INSERT INTO knowledge_chunks (
  content, embedding, source_type, domain, confidence,
  publication, author, year, chapter, page_start, page_end
) VALUES (...)
```

The `publication`, `author`, `year`, `chapter` columns are added to the existing `knowledge_chunks` table:

```sql
ALTER TABLE knowledge_chunks
  ADD COLUMN publication TEXT,
  ADD COLUMN author TEXT,
  ADD COLUMN year INTEGER,
  ADD COLUMN chapter TEXT,
  ADD COLUMN page_start INTEGER,
  ADD COLUMN page_end INTEGER;
```

---

## 3.5 Agent Memory Evolution

### 3.5.1 Current `agent_memory` Table

```sql
CREATE TABLE agent_memory (
  id          UUID PRIMARY KEY,
  project_id  UUID REFERENCES projects(id),
  agent       TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Currently used as a flat key-value scratchpad per agent per project. No structure, no versioning.

### 3.5.2 Extended Schema

```sql
-- Extend agent_memory with memory_type discriminator
ALTER TABLE agent_memory
  ADD COLUMN memory_type TEXT NOT NULL DEFAULT 'scratchpad'
    CHECK (memory_type IN ('scratchpad', 'design_snapshot', 'handoff', 'insight')),
  ADD COLUMN version INTEGER DEFAULT 1,
  ADD COLUMN superseded_by UUID REFERENCES agent_memory(id),
  ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();

-- Index for fast handoff retrieval
CREATE INDEX idx_agent_memory_handoff
  ON agent_memory (project_id, memory_type, agent)
  WHERE memory_type = 'handoff';
```

### 3.5.3 Memory Types

**`scratchpad`** — existing behavior, unchanged. Per-agent working notes.

**`design_snapshot`** — immutable snapshot of `design_state` taken at a significant moment (e.g., after a simulation run, before a major change). Enables "undo" and design history review.

```json
{
  "memory_type": "design_snapshot",
  "key": "before_port_retuning_2026-03-28",
  "value": { /* full DesignState object */ },
  "version": 3
}
```

**`handoff`** — short structured messages one agent writes for a peer. These populate the `NOTES FROM OTHER AGENTS` block in the context injection template.

```json
{
  "memory_type": "handoff",
  "key": "enclosure_to_crossover",
  "agent": "enclosure",
  "value": {
    "toAgent": "crossover",
    "note": "Final tuning is 38Hz. The woofer acoustic rolloff is approximately 24dB/octave below Fb. Crossover should be set no lower than 180Hz to avoid adding filter slope on top of this.",
    "expires_after_turns": 10
  }
}
```

**`insight`** — promoted knowledge: a finding this agent is confident enough to share with the shared canonical pool. Reviewed and promoted by the manager.

```json
{
  "memory_type": "insight",
  "key": "sb29_fs_in_small_sealed",
  "agent": "enclosure",
  "value": {
    "claim": "SB Acoustics SB29RDC in a 30L sealed box produces F3 ≈ 45Hz. Confirmed across 3 user projects.",
    "confidence": 0.85,
    "promote_to_canonical": false
  }
}
```

### 3.5.4 Design History

Every time the manager commits a `__stateUpdate`, it writes a `design_snapshot` record before overwriting. This produces a full audit trail:

```typescript
async function commitStateUpdate(
  projectId: string,
  field: string,
  value: unknown,
  confidence: string,
  rationale: string,
  db: DrizzleDb
): Promise<void> {
  // 1. Read current state
  const current = await db.query.projects.findFirst({ where: eq(projects.id, projectId) });
  const currentState = current?.designState as DesignState;

  // 2. Snapshot before change
  await db.insert(agentMemory).values({
    id: crypto.randomUUID(),
    projectId,
    agent: 'manager',
    key: `snapshot_before_${field}_${Date.now()}`,
    memoryType: 'design_snapshot',
    value: currentState,
    version: await getNextVersion(projectId, db),
  });

  // 3. Apply update using lodash set or similar deep path setter
  const updated = deepSet(currentState, field, value);
  updated.updatedAt = new Date().toISOString();

  // 4. Write new state
  await db.update(projects)
    .set({ designState: updated })
    .where(eq(projects.id, projectId));
}
```

---

## 3.6 Reactive Design Foundation

### 3.6.1 Philosophy

The reactive modules are the foundation for a future where changing the enclosure volume automatically prompts the crossover agent to reconsider its component values, which in turn prompts the acoustics agent to update SPL predictions. In this phase, the plumbing is installed — no automatic triggering yet. Agents are notified via handoff notes; they do not auto-respond.

### 3.6.2 `DesignModule` Interface

```typescript
interface DesignModule {
  id: string;                          // 'enclosure' | 'crossover' | 'driver_woofer' | etc.
  state: Record<string, unknown>;      // the current parameter values for this module
  dependencies: string[];              // module IDs this one depends on

  /**
   * Called by the manager when an upstream module changes.
   * In Phase 3: produces a handoff note for the relevant agent.
   * Future: triggers re-simulation or async agent re-evaluation.
   */
  onUpstreamChange(source: string, delta: UpstreamDelta): HandoffNote | null;
}

interface UpstreamDelta {
  field: string;           // dot-path of what changed, e.g. "enclosure.tuningHz"
  oldValue: unknown;
  newValue: unknown;
  confidence: string;
  rationale: string;
}
```

### 3.6.3 Concrete Module Implementations

```typescript
class EnclosureModule implements DesignModule {
  id = 'enclosure';
  dependencies = ['driver_woofer'];

  constructor(public state: EnclosureState) {}

  onUpstreamChange(source: string, delta: UpstreamDelta): HandoffNote | null {
    if (source === 'driver_woofer') {
      return {
        fromAgent: 'manager',
        toAgent: 'enclosure',
        note: `Woofer changed: ${delta.field} is now ${delta.newValue}. Review enclosure alignment — Vas and Fs may require box volume or port tuning adjustment.`,
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  }
}

class CrossoverModule implements DesignModule {
  id = 'crossover';
  dependencies = ['enclosure', 'driver_woofer', 'driver_tweeter'];

  constructor(public state: CrossoverState) {}

  onUpstreamChange(source: string, delta: UpstreamDelta): HandoffNote | null {
    if (source === 'enclosure' && delta.field === 'enclosure.tuningHz') {
      return {
        fromAgent: 'manager',
        toAgent: 'crossover',
        note: `Enclosure tuning changed from ${delta.oldValue}Hz to ${delta.newValue}Hz. Review crossover LF cutoff — acoustic rolloff below Fb has shifted.`,
        createdAt: new Date().toISOString(),
      };
    }
    if (source === 'driver_tweeter') {
      return {
        fromAgent: 'manager',
        toAgent: 'crossover',
        note: `Tweeter changed: ${delta.field} = ${delta.newValue}. Verify HP cutoff is safe above new Fs. Review impedance compensation.`,
        createdAt: new Date().toISOString(),
      };
    }
    return null;
  }
}
```

### 3.6.4 Module Registry and Change Propagation

```typescript
class DesignModuleRegistry {
  private modules: Map<string, DesignModule> = new Map();

  register(module: DesignModule): void {
    this.modules.set(module.id, module);
  }

  /**
   * Called after any state update is committed.
   * Finds all modules that depend on `sourceModuleId` and calls onUpstreamChange.
   * Collects the resulting handoff notes and persists them.
   */
  async propagateChange(
    sourceModuleId: string,
    delta: UpstreamDelta,
    db: DrizzleDb,
    projectId: string
  ): Promise<void> {
    const notes: HandoffNote[] = [];

    for (const [id, module] of this.modules) {
      if (module.dependencies.includes(sourceModuleId)) {
        const note = module.onUpstreamChange(sourceModuleId, delta);
        if (note) notes.push(note);
      }
    }

    if (notes.length > 0) {
      await db.insert(agentMemory).values(
        notes.map(note => ({
          id: crypto.randomUUID(),
          projectId,
          agent: note.fromAgent,
          key: `handoff_${note.fromAgent}_${note.toAgent}_${Date.now()}`,
          memoryType: 'handoff' as const,
          value: note,
        }))
      );
    }
  }
}
```

### 3.6.5 Future Reactive Trigger (Out of Scope for This Phase)

The `onUpstreamChange` interface is designed to eventually support async agent invocations:

```typescript
// FUTURE — not implemented in this phase
async onUpstreamChange(source: string, delta: UpstreamDelta): Promise<void> {
  const prompt = this.buildReactivePrompt(delta);
  const response = await callAgent(this.ownerAgent, prompt);
  await commitStateUpdate(response.__stateUpdate);
}
```

When this is activated, the system becomes a live reactive graph. For now, it generates handoff notes only.

---

## 3.7 System Prompt Updates for Existing Agents

All six existing specialist agents receive the following additions to their system prompts. These are additive — the existing prompt body is preserved.

### 3.7.1 Literature Awareness Block (added to all agents)

```
You now have access to technical literature: textbooks, research papers, and manufacturer datasheets. When your RAG context includes a literature source, cite it explicitly using the format:

  [Author, "Title", Year, Ch. N]

Prioritize literature citations when making quantitative claims (target values, design equations, physical constants). For experiential or "in practice" observations, conversation sources are appropriate. Do not confuse the two.

If a literature source contradicts a prior conversation source, note the discrepancy and explain which you trust more and why.
```

### 3.7.2 VituixCAD Awareness Block (added to enclosure, crossover, acoustics, theory)

```
You may receive parsed VituixCAD project data in your context, prefixed with "=== VITUIXCAD PROJECT ===". This is structured simulation data from a real project the user has imported.

When this data is present:
- Reference specific parameter values from it, do not generalize
- Compare simulation data against your domain expectations and call out discrepancies
- Suggest modifications in terms of specific VituixCAD parameter changes the user can make
- Do not claim to know what VituixCAD will produce after a change — reason from physics, not from the tool

If the user asks a question that is better answered by the VituixCAD specialist, say: "Let me hand this to the VituixCAD agent who can reason directly about your project file." The manager will re-route.
```

### 3.7.3 Design State Awareness Block (added to enclosure, crossover, acoustics)

```
You will receive an "=== ACTIVE DESIGN STATE ===" block at the start of the user message. This is the current canonical state of the speaker design. Treat it as ground truth for this project.

When you make a recommendation that changes a design parameter, end your response with a structured update block:
{"__stateUpdate": {"field": "dot.path.field", "value": <value>, "confidence": "proposed|simulated|built", "rationale": "one sentence"}}

Only emit this block when you are confident the parameter value should be recorded. Do not emit it for hypotheticals, comparisons, or exploratory answers.
```

### 3.7.4 Handoff Notes Block (added to all agents)

```
You will see notes from other agents in the design state block. These are not instructions — they are peer context. Read them and factor them into your response. If a note from another agent is no longer relevant (e.g., they were worried about something you have now resolved), acknowledge it briefly.
```

---

## 3.8 Agent Collaboration Pattern

### 3.8.1 Decision: Option C — Shared Design State

As established in Section 3.3, agents do not query the database directly and do not relay requests through the manager at runtime. They read shared design state injected into their context.

This decision was made for the following reasons:

**Why not Option A (direct DB query by agent)?**
- Agents are stateless reasoning units. Adding database awareness couples them to infrastructure.
- Two agents querying concurrently could read inconsistent transient states during a manager commit.
- Testing becomes complex — every agent test needs a database fixture.

**Why not Option B (manager-relayed agent-to-agent requests)?**
- A synchronous relay adds a full agent round-trip mid-response, increasing latency by 2–5 seconds.
- The relayed answer must be re-interpreted by the requesting agent, adding a failure mode.
- It creates hidden conversation turns that confuse the user.

**Why Option C (shared state injected at dispatch)?**
- The manager is already in the critical path. Reading `design_state` from Postgres adds ~5ms.
- Agents remain pure reasoning units with no infrastructure dependencies.
- The state injection template is inspectable and testable in isolation.
- Consistency is guaranteed — the state is committed atomically before dispatch.

### 3.8.2 Collaboration Sequence (Concrete Example)

A user says: "Given the woofer we chose and the box design, what crossover frequency makes sense?"

```
1. USER → /api/agents/manager
   Message: "Given the woofer we chose and the box design, what crossover frequency makes sense?"

2. MANAGER reads:
   - domainHistory: ['enclosure', 'enclosure', 'theory', 'enclosure']
   - design_state: { woofer: SB29RDC, enclosure: { type: vented, tuning: 38Hz, volume: 42.5L } }
   - keyword match: "crossover frequency" → crossover domain

3. MANAGER dispatches to crossover agent:
   Context injection prepended:
   === ACTIVE DESIGN STATE ===
   Woofer: SB Acoustics SB29RDC | Fs=22Hz | Qts=0.32 | Vas=120L | Re=4Ω
   Enclosure: vented | 42.5L | tuning: 38Hz (simulated)
   Crossover: not set
   NOTES: [enclosure→crossover]: Final tuning is 38Hz. Acoustic rolloff below Fb is steep — crossover LP should not be set below 180Hz.
   === END DESIGN STATE ===

   User: "Given the woofer we chose and the box design, what crossover frequency makes sense?"

4. CROSSOVER AGENT responds:
   "Given your SB29RDC in a 42.5L vented box tuned to 38Hz, the acoustic output will roll off
   rapidly below 38Hz. The woofer's upper bandwidth is limited by its natural breakup, typically
   appearing around 1.5–2kHz for a driver of this size. For a 2-way or 3-way topology, a crossover
   point of 200–300Hz is workable if pairing with a large midrange. For a 2-way direct to tweeter,
   you would need a tweeter rated to at least 1.5kHz continuous and a crossover around 1.8–2.5kHz.

   Given the enclosure note about the 38Hz tuning, I would set the LP at no lower than 200Hz.

   My recommendation: 250Hz LP (LR4) for 3-way, 2kHz LP (LR4) for 2-way."

   {"__stateUpdate": {"field": "crossover.wooferLpHz", "value": 250, "confidence": "proposed", "rationale": "LR4 at 250Hz appropriate for vented SB29RDC with 38Hz Fb, pending midrange selection"}}

5. MANAGER strips __stateUpdate, renders response to user, commits state update, propagates
   to CrossoverModule.onUpstreamChange (no-op — enclosure did not change), returns.
```

### 3.8.3 When to Escalate to Manager

A specialist agent should escalate to the manager (via a structured signal in its response) in these cases:

```typescript
interface AgentEscalation {
  __escalate: {
    reason: 'out_of_domain' | 'missing_design_state' | 'contradiction' | 'complex_multi_domain';
    toAgent?: AgentDomain;   // if agent knows who should handle it
    message: string;          // what to tell the manager
  };
}
```

- **`out_of_domain`**: Question clearly belongs to another specialist. Example: crossover agent asked about room treatment.
- **`missing_design_state`**: Agent cannot answer without information that is not in the design state. Example: crossover asked about component values but no drivers are set.
- **`contradiction`**: Design state contains conflicting parameters (e.g., enclosure volume is null but tuning frequency is set).
- **`complex_multi_domain`**: The question requires simultaneous reasoning across 3+ domains (e.g., "Is this design ready to build?"). Manager should synthesize multiple agents.

---

## 3.9 Summary of New Database Objects

| Object | Type | Purpose |
|--------|------|---------|
| `vituixcad_projects` | Table | Parsed VXP project data (structured JSONB) |
| `projects.design_state` | Column (JSONB) | Canonical shared design state per project |
| `conversations.domain_history` | Column (TEXT[]) | Routing momentum tracking |
| `knowledge_chunks.publication` | Column (TEXT) | Literature citation metadata |
| `knowledge_chunks.author` | Column (TEXT) | Literature citation metadata |
| `knowledge_chunks.year` | Column (INT) | Literature citation metadata |
| `knowledge_chunks.chapter` | Column (TEXT) | Literature citation metadata |
| `knowledge_chunks.page_start/end` | Columns (INT) | Literature citation metadata |
| `agent_memory.memory_type` | Column (TEXT) | Discriminator for memory record type |
| `agent_memory.version` | Column (INT) | Snapshot versioning |
| `agent_memory.superseded_by` | Column (UUID FK) | Snapshot chain |

---

## 3.10 Open Questions

1. **VXP parsing depth**: VituixCAD `.vxp` files are XML-based. Should the parser run server-side (Node.js XML parse on upload) or client-side (browser parse before upload)? Server-side is preferred — keeps parsing logic in one place and enables re-parse if schema changes.

2. **Curve injection cost**: A full SPL array at 1/3 octave resolution is ~60 data points × 4 bytes. Injecting all curves for a project adds ~2KB to the context. For GPT-class models this is negligible. Monitor if multi-curve injection (SPL + impedance + phase + group delay) causes noticeable latency.

3. **Handoff note expiry**: Handoff notes currently expire after a fixed number of turns (`expires_after_turns`). Consider expiring on state update instead — a note about enclosure tuning is stale the moment the tuning parameter changes.

4. **Manager as synthesis agent**: The `complex_multi_domain` escalation case assumes the manager can synthesize a multi-agent answer. This requires the manager to be more than a router — it needs its own system prompt for synthesis mode. Spec this separately in Section 4 (UI and Interaction Flows).

5. **Literature confidence scoring**: The ingestion pipeline assigns `confidence: 0.0–1.0` to chunks. For literature, confidence should factor in source authority (peer-reviewed paper > forum post > manufacturer datasheet for physics; reversed for real-world performance). Define the scoring rubric in the Phase 2 knowledge pipeline spec.
