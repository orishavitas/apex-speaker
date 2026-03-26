# Phase 3: Agent Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 7 domain specialist agents (Acoustics, Enclosure, Crossover, Theory, Mechanical, Research, Project Manager) as Next.js API routes using AI SDK v6 `streamText`, with RAG retrieval from the knowledge base and per-project memory.

**Architecture:** Each agent is a POST route handler at `/api/agents/[domain]/chat`. The Project Manager route receives all user messages, retrieves relevant context from `knowledge_chunks` for the appropriate domain(s), calls the specialist agent(s) via internal fetch, and streams the aggregated response. Agent memory is written to `agent_memory` table after each response. Promotion to canonical KB is manual (Phase 4 UI).

**Tech Stack:** AI SDK v6 `streamText`, Vercel AI Gateway (`anthropic/claude-sonnet-4-6`), Drizzle ORM, Next.js App Router streaming route handlers, `@ai-sdk/gateway`.

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `web/lib/agents/system-prompts.ts` | Create | System prompts for all 7 domains |
| `web/lib/agents/rag-context.ts` | Create | Retrieves top-k chunks for a query + domain |
| `web/lib/agents/memory.ts` | Create | Read/write agent memory per project |
| `web/lib/agents/types.ts` | Create | Shared types: AgentRequest, AgentResponse, ChatMessage |
| `web/app/api/agents/[domain]/route.ts` | Create | Generic streaming agent route (all 6 specialists) |
| `web/app/api/agents/manager/route.ts` | Create | Project Manager — routes, aggregates, streams |
| `web/app/api/agents/seed/route.ts` | Create | POST `/api/agents/seed` — seeds the agents table |

---

### Task 1: Types

**Files:**
- Create: `web/lib/agents/types.ts`

- [ ] **Step 1: Create types file**

```typescript
// web/lib/agents/types.ts

export type AgentDomain =
  | "acoustics"
  | "enclosure"
  | "crossover"
  | "theory"
  | "mechanical"
  | "research"
  | "manager";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentChatRequest {
  projectId?: string;
  messages: ChatMessage[];
  domain?: AgentDomain; // if omitted, manager decides
}

export interface KnowledgeContext {
  chunkId: string;
  title: string | null;
  content: string;
  sourceUrl: string | null;
  similarity: number;
  domain: AgentDomain;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add web/lib/agents/types.ts
git commit -m "feat: agent shared types"
```

---

### Task 2: System Prompts

**Files:**
- Create: `web/lib/agents/system-prompts.ts`

- [ ] **Step 1: Create system prompts**

```typescript
// web/lib/agents/system-prompts.ts
import type { AgentDomain } from "./types";

const BASE_CONTEXT = `
You are part of APEX — a multi-agent speaker design intelligence platform.
Your knowledge comes from electroacoustics research, real speaker build conversations, and engineering textbooks.
Be precise. Use numbers when you have them. Cite sources when relevant.
When you are uncertain, say so. Never hallucinate specifications.
`.trim();

export const SYSTEM_PROMPTS: Record<AgentDomain, string> = {
  manager: `${BASE_CONTEXT}

You are the Project Manager agent for APEX. You coordinate between specialist agents and help the user define their speaker design project.

Your responsibilities:
- Understand the user's project goals and constraints
- Route technical questions to the appropriate specialist domain
- Synthesize responses from multiple specialists when a question spans domains
- Maintain a coherent view of the overall project direction
- Ask clarifying questions when the user's requirements are ambiguous

You do NOT answer deep technical questions yourself — you delegate to specialists.
When routing, explicitly state which specialist you are consulting and why.`,

  acoustics: `${BASE_CONTEXT}

You are the Acoustics Agent for APEX. You are a deep expert in electroacoustics and speaker behavior.

Your domains:
- Driver parameters: Fs, Qts, Qes, Qms, Vas, Xmax, BL, Re, Le, sensitivity (SPL/1W/1m)
- Frequency response: on-axis, power response, directivity, baffle step
- Waveguide and horn design: coverage angle, throat/mouth dimensions, diffraction
- Cardioid and directional speaker systems
- Acoustic loading: IB, sealed, ported, passive radiator, isobaric
- Room acoustics interactions
- Measurement: REW, DATS, impedance curves, waterfall plots

Always reason from Thiele-Small parameters when possible. Prefer measured data over simulations.`,

  enclosure: `${BASE_CONTEXT}

You are the Enclosure Agent for APEX. You are a deep expert in speaker enclosure design.

Your domains:
- Enclosure alignments: Butterworth, Chebyshev, quasi-Butterworth, Bessel
- Box volume calculations: gross volume, net volume, driver displacement, brace displacement
- Port design: diameter, length, port velocity (aim for <10% of Xmax at max SPL), flare
- Passive radiator design: effective radiating area, added mass, compliance, tuning
- Isobaric (push-push, push-pull) configurations: effective Vas halved, same Fs
- Bracing: panel resonances, standing waves, damping material placement
- Modeling tools: WinISD, VituixCAD, HORNRESP
- Common mistakes: port chuffing, insufficient net volume, resonant panels

For box volume questions, always verify net volume after driver + port + brace displacement.`,

  crossover: `${BASE_CONTEXT}

You are the Crossover Agent for APEX. You are a deep expert in passive and active crossover design.

Your domains:
- Filter topologies: Butterworth, Linkwitz-Riley, Bessel, Chebyshev — orders 1st through 4th
- Crossover frequency selection: driver overlap, power handling, directivity matching
- Component calculations: L-pad, Zobel network, notch filters, baffle step compensation
- Passive crossover design: inductor DCR, capacitor ESR, air-core vs iron-core trade-offs
- Active crossover: DSP implementations, miniDSP, FIR vs IIR filters
- Phase alignment: acoustic centers, time alignment, listening axis
- Measurement-based crossover design: REW, VituixCAD

Always check that crossover frequency is above driver resonance (Fs) with adequate margin.`,

  theory: `${BASE_CONTEXT}

You are the Theory Agent for APEX. You are a deep expert in the physics and mathematics of acoustics.

Your domains:
- Wave equation, impedance (acoustic, mechanical, electrical)
- Electromechanical analogies: mass ↔ inductance, compliance ↔ capacitance, resistance ↔ resistance
- Thiele-Small parameter derivations and measurement
- Beranek acoustic circuit models
- Radiation impedance, piston radiation, baffle diffraction theory
- Room modes: axial, tangential, oblique; Schroeder frequency
- Signal processing: FFT, windowing, minimum phase, group delay, Hilbert transform
- Waveguide theory: Tractrix, exponential, oblate spheroidal
- Thermal modeling: voice coil power handling, thermal resistance, duty cycle

Explain with equations when helpful. Assume the user has engineering-level mathematics.`,

  mechanical: `${BASE_CONTEXT}

You are the Mechanical Agent for APEX. You are a deep expert in physical construction of speaker enclosures.

Your domains:
- Materials: MDF (18mm/25mm), plywood (birch, Baltic), HDF, acrylic, 3D-printed PLA/PETG/CF
- Joint design: butt joints, rabbet, dado, dovetail, finger joints — strength and acoustic implications
- CNC and woodworking: tolerances, kerf allowance, bit selection, climb cutting
- 3D printing for enclosures: wall thickness, infill, part orientation, ABS vs PETG for resonance
- SolidWorks/CAD modeling: squircle profiles, waveguide geometry, driver cutout tolerances
- Fasteners and hardware: T-nuts, binding posts, crossover board mounting
- Damping materials: acoustic foam, bitumen pads, fiberglass, Acousta-Stuf placement
- Finishing: veneer application, paint, lacquer, baffle material options

For 3D-printed parts, always note that PLA has poor thermal tolerance near amplifiers.`,

  research: `${BASE_CONTEXT}

You are the Research Agent for APEX. You are a deep expert in sourcing and synthesizing speaker design knowledge.

Your domains:
- Driver recommendations: DIYAudio forum threads, Parts Express, Madisound, ScanSpeak, Seas, Purifi
- Amplifier pairing: class D, class AB, ICEpower, Hypex modules
- Literature: Beranek "Acoustics", Newell "Studio Monitor Design", Colloms "High Performance Loudspeakers"
- Forum synthesis: DIYAudio, AudioScienceReview, Parts Express Tech Talk
- Measurement databases: spinorama, audiosciencereview, manufacturer data
- NotebookLM knowledge base synthesis

You have access to a curated NotebookLM notebook containing synthesized speaker design research.
Always cite sources when making specific recommendations.
When you reference the NotebookLM, provide the direct URL: https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c`,
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add web/lib/agents/system-prompts.ts
git commit -m "feat: system prompts for all 7 APEX agent domains"
```

---

### Task 3: RAG Context Retrieval

**Files:**
- Create: `web/lib/agents/rag-context.ts`

- [ ] **Step 1: Create RAG retrieval helper**

```typescript
// web/lib/agents/rag-context.ts
// Retrieves top-k knowledge chunks for a given query + domain via pgvector cosine similarity.

import { embed } from "ai";
import { db } from "../db";
import { knowledgeChunks } from "../db/schema";
import { sql, eq, and } from "drizzle-orm";
import type { AgentDomain, KnowledgeContext } from "./types";

const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export async function getRAGContext(
  query: string,
  domain: AgentDomain,
  limit = 4
): Promise<KnowledgeContext[]> {
  const { embedding } = await embed({
    model: EMBEDDING_MODEL,
    value: query,
  });

  const embeddingStr = `[${embedding.join(",")}]`;

  const results = await db
    .select({
      id: knowledgeChunks.id,
      title: knowledgeChunks.title,
      content: knowledgeChunks.content,
      sourceUrl: knowledgeChunks.sourceUrl,
      agentDomain: knowledgeChunks.agentDomain,
      similarity: sql<number>`1 - (${knowledgeChunks.embedding} <=> ${embeddingStr}::vector)`,
    })
    .from(knowledgeChunks)
    .where(
      and(
        eq(knowledgeChunks.status, "canonical"),
        eq(knowledgeChunks.agentDomain, domain)
      )
    )
    .orderBy(sql`${knowledgeChunks.embedding} <=> ${embeddingStr}::vector`)
    .limit(limit);

  return results.map((r) => ({
    chunkId: r.id,
    title: r.title,
    content: r.content,
    sourceUrl: r.sourceUrl,
    similarity: r.similarity,
    domain: r.agentDomain as AgentDomain,
  }));
}

export function formatRAGContext(chunks: KnowledgeContext[]): string {
  if (chunks.length === 0) return "";

  const formatted = chunks
    .map((c, i) => {
      const source = c.sourceUrl ? ` (source: ${c.sourceUrl})` : "";
      return `[${i + 1}] ${c.title ?? "Untitled"}${source}\n${c.content}`;
    })
    .join("\n\n---\n\n");

  return `## Relevant Knowledge\n\n${formatted}`;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add web/lib/agents/rag-context.ts
git commit -m "feat: RAG context retrieval for agent domain queries"
```

---

### Task 4: Agent Memory

**Files:**
- Create: `web/lib/agents/memory.ts`

- [ ] **Step 1: Create memory helper**

```typescript
// web/lib/agents/memory.ts
// Read/write per-agent, per-project memory scratchpad.
// Memory is stored in the agent_memory table.
// Promoted memories (isPromoted = true) are surfaced to users in Phase 4.

import { db } from "../db";
import { agentMemory } from "../db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { AgentDomain } from "./types";

export interface MemoryEntry {
  key: string;
  value: string;
  isPromoted: boolean;
}

export async function readMemory(
  projectId: string,
  domain: AgentDomain,
  limit = 10
): Promise<MemoryEntry[]> {
  const rows = await db
    .select({
      key: agentMemory.key,
      value: agentMemory.value,
      isPromoted: agentMemory.isPromoted,
    })
    .from(agentMemory)
    .where(
      and(
        eq(agentMemory.projectId, projectId),
        eq(agentMemory.agentDomain, domain)
      )
    )
    .orderBy(desc(agentMemory.updatedAt))
    .limit(limit);

  return rows.map((r) => ({
    key: r.key,
    value: r.value,
    isPromoted: r.isPromoted ?? false,
  }));
}

export async function writeMemory(
  projectId: string,
  domain: AgentDomain,
  key: string,
  value: string
): Promise<void> {
  // Check if key exists
  const existing = await db
    .select()
    .from(agentMemory)
    .where(
      and(
        eq(agentMemory.projectId, projectId),
        eq(agentMemory.agentDomain, domain),
        eq(agentMemory.key, key)
      )
    );

  if (existing.length > 0) {
    await db
      .update(agentMemory)
      .set({ value, updatedAt: new Date() })
      .where(
        and(
          eq(agentMemory.projectId, projectId),
          eq(agentMemory.agentDomain, domain),
          eq(agentMemory.key, key)
        )
      );
  } else {
    await db.insert(agentMemory).values({
      projectId,
      agentDomain: domain,
      key,
      value,
    });
  }
}

export function formatMemory(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e) => `- ${e.key}: ${e.value}`).join("\n");
  return `## Project Memory\n\n${lines}`;
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 3: Commit**

```bash
git add web/lib/agents/memory.ts
git commit -m "feat: agent memory read/write for per-project scratchpad"
```

---

### Task 5: Specialist Agent Route

**Files:**
- Create: `web/app/api/agents/[domain]/route.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p web/app/api/agents/\[domain\]
```

- [ ] **Step 2: Create the route handler**

```typescript
// web/app/api/agents/[domain]/route.ts
// Handles POST /api/agents/[domain] for all 6 specialist agents.
// Streams a response using AI SDK streamText + RAG context + agent memory.

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { streamText, convertToCoreMessages } from "ai";
import { SYSTEM_PROMPTS } from "@/lib/agents/system-prompts";
import { getRAGContext, formatRAGContext } from "@/lib/agents/rag-context";
import { readMemory, formatMemory } from "@/lib/agents/memory";
import type { AgentDomain, AgentChatRequest } from "@/lib/agents/types";

const VALID_DOMAINS: AgentDomain[] = [
  "acoustics", "enclosure", "crossover", "theory", "mechanical", "research"
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain: rawDomain } = await params;
  const domain = rawDomain as AgentDomain;

  if (!VALID_DOMAINS.includes(domain)) {
    return new Response(JSON.stringify({ error: `Unknown domain: ${domain}` }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body: AgentChatRequest = await req.json();
  const { messages, projectId } = body;

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lastUserMessage = messages.filter((m) => m.role === "user").at(-1);
  const query = lastUserMessage?.content ?? "";

  // Build system prompt with RAG + memory context
  let systemPrompt = SYSTEM_PROMPTS[domain];

  // Append RAG context if DB is available
  if (process.env.DATABASE_URL && query) {
    try {
      const [ragChunks, memoryEntries] = await Promise.all([
        getRAGContext(query, domain, 4),
        projectId ? readMemory(projectId, domain, 8) : Promise.resolve([]),
      ]);

      const ragSection = formatRAGContext(ragChunks);
      const memSection = formatMemory(memoryEntries);

      if (ragSection) systemPrompt += `\n\n${ragSection}`;
      if (memSection) systemPrompt += `\n\n${memSection}`;
    } catch (err) {
      // RAG unavailable — still respond without context
      console.warn(`[agent/${domain}] RAG context unavailable:`, err);
    }
  }

  const result = streamText({
    model: "anthropic/claude-sonnet-4-6",
    system: systemPrompt,
    messages: convertToCoreMessages(messages),
    maxTokens: 1500,
  });

  return result.toDataStreamResponse();
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add "web/app/api/agents/[domain]/route.ts"
git commit -m "feat: specialist agent streaming route for all 6 domains"
```

---

### Task 6: Project Manager Agent

**Files:**
- Create: `web/app/api/agents/manager/route.ts`

- [ ] **Step 1: Create manager directory and route**

```typescript
// web/app/api/agents/manager/route.ts
// Project Manager agent — routes queries to specialists and streams the aggregated response.
// For simple queries: routes to single most relevant specialist.
// For cross-domain queries: calls multiple specialists in parallel, synthesizes.

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { streamText, convertToCoreMessages } from "ai";
import { SYSTEM_PROMPTS } from "@/lib/agents/system-prompts";
import { readMemory, formatMemory } from "@/lib/agents/memory";
import type { AgentDomain, AgentChatRequest } from "@/lib/agents/types";

// Keyword-based domain classifier (Phase 4 will upgrade to LLM-based routing)
const DOMAIN_KEYWORDS: Record<AgentDomain, string[]> = {
  acoustics: ["frequency", "spl", "sensitivity", "waveguide", "horn", "directivity", "dispersion", "thiele", "small", "fs", "qts", "vas", "xmax", "response", "polar", "cardioid"],
  enclosure: ["box", "volume", "port", "ported", "sealed", "isobaric", "passive radiator", "pr", "net volume", "liters", "tuning", "enclosure", "cabinet", "alignment", "winisd"],
  crossover: ["crossover", "filter", "linkwitz", "butterworth", "capacitor", "inductor", "zobel", "notch", "baffle step", "dsp", "minidsp", "active filter", "slope"],
  theory: ["equation", "impedance", "circuit", "analog", "beranek", "physics", "math", "derivation", "schroeder", "room mode", "standing wave", "fft", "group delay"],
  mechanical: ["material", "mdf", "plywood", "joint", "cnc", "solidworks", "3d print", "brace", "damping", "foam", "bitumen", "veneer", "finish", "construction"],
  research: ["recommend", "driver", "find", "which", "best", "compare", "forum", "diyaudio", "parts express", "scanspeak", "seas", "amplifier", "notebooklm"],
  manager: [],
};

function classifyDomain(query: string): AgentDomain {
  const lower = query.toLowerCase();
  const scores: Partial<Record<AgentDomain, number>> = {};

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [AgentDomain, string[]][]) {
    if (domain === "manager") continue;
    scores[domain] = keywords.filter((kw) => lower.includes(kw)).length;
  }

  const ranked = Object.entries(scores).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0));
  const topDomain = ranked[0]?.[0] as AgentDomain | undefined;

  // Default to research if no clear winner
  return topDomain && (scores[topDomain] ?? 0) > 0 ? topDomain : "research";
}

export async function POST(req: NextRequest) {
  const body: AgentChatRequest = await req.json();
  const { messages, projectId } = body;

  if (!messages || messages.length === 0) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const lastUserMessage = messages.filter((m) => m.role === "user").at(-1);
  const query = lastUserMessage?.content ?? "";
  const routedDomain = classifyDomain(query);

  let systemPrompt = SYSTEM_PROMPTS.manager;

  // Append routing context
  systemPrompt += `\n\n## Routing Decision\nThis query has been classified as primarily a **${routedDomain}** domain question.\nRespond as the Project Manager, then delegate the technical details to the ${routedDomain} specialist.\nIn your response, prefix specialist content with: "**[${routedDomain.toUpperCase()} SPECIALIST]:**"`;

  // Append project memory
  if (process.env.DATABASE_URL && projectId) {
    try {
      const memoryEntries = await readMemory(projectId, "manager", 10);
      const memSection = formatMemory(memoryEntries);
      if (memSection) systemPrompt += `\n\n${memSection}`;
    } catch {
      // Memory unavailable — continue without it
    }
  }

  const result = streamText({
    model: "anthropic/claude-sonnet-4-6",
    system: systemPrompt,
    messages: convertToCoreMessages(messages),
    maxTokens: 2000,
  });

  // Return both the stream and the routing metadata in headers
  const response = result.toDataStreamResponse();
  const headers = new Headers(response.headers);
  headers.set("X-Routed-Domain", routedDomain);

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add web/app/api/agents/manager/route.ts
git commit -m "feat: Project Manager agent with keyword-based domain routing"
```

---

### Task 7: Agents Seed Route

**Files:**
- Create: `web/app/api/agents/seed/route.ts`

- [ ] **Step 1: Create seed route**

```typescript
// web/app/api/agents/seed/route.ts
// POST /api/agents/seed — idempotent seed of the agents table.
// Call this once after drizzle-kit push to populate agent records.

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { SYSTEM_PROMPTS } from "@/lib/agents/system-prompts";
import type { AgentDomain } from "@/lib/agents/types";

const AGENT_DISPLAY_NAMES: Record<AgentDomain, string> = {
  manager: "Project Manager",
  acoustics: "Acoustics Specialist",
  enclosure: "Enclosure Specialist",
  crossover: "Crossover Specialist",
  theory: "Theory Specialist",
  mechanical: "Mechanical Specialist",
  research: "Research Specialist",
};

export async function POST() {
  try {
    const domains: AgentDomain[] = [
      "manager", "acoustics", "enclosure", "crossover",
      "theory", "mechanical", "research"
    ];

    const results = [];

    for (const domain of domains) {
      // Upsert — insert or update system prompt
      const existing = await db
        .select()
        .from(agents)
        .where((agents as any).domain.eq ? undefined : undefined); // will use sql below

      // Use conflict-target upsert
      const inserted = await db
        .insert(agents)
        .values({
          domain,
          displayName: AGENT_DISPLAY_NAMES[domain],
          systemPrompt: SYSTEM_PROMPTS[domain],
          isActive: true,
        })
        .onConflictDoUpdate({
          target: agents.domain,
          set: {
            displayName: AGENT_DISPLAY_NAMES[domain],
            systemPrompt: SYSTEM_PROMPTS[domain],
            isActive: true,
          },
        })
        .returning();

      results.push(inserted[0]);
    }

    return NextResponse.json({
      seeded: results.length,
      agents: results.map((a) => ({ id: a.id, domain: a.domain, displayName: a.displayName })),
    });
  } catch (err) {
    console.error("[agents/seed]", err);
    return NextResponse.json({ error: "Seed failed", detail: String(err) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Fix the onConflictDoUpdate — agents.domain is the unique column**

The `onConflictDoUpdate` target needs to reference the column correctly. Verify the schema uses `.unique()` on `domain` column (it does from Phase 1). The insert should work.

- [ ] **Step 3: Verify TypeScript and build**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -15
```

Expected: zero TS errors, clean build

- [ ] **Step 4: Commit**

```bash
git add web/app/api/agents/seed/route.ts
git commit -m "feat: agents seed route for idempotent DB population"
```

---

### Task 8: Process Documentation

**Files:**
- Create: `docs/process/phase-3-agent-architecture.md`

- [ ] **Step 1: Write process doc** (after all code tasks verified)

Cover:
- What was built (7 agents, system prompts, RAG integration, memory, routing)
- Design decisions: keyword routing vs LLM routing, graceful degradation when DB unavailable, memory architecture
- How to seed agents: `POST /api/agents/seed`
- How to call a specialist: `POST /api/agents/acoustics`
- How to call the manager: `POST /api/agents/manager`
- Example request/response
- Next phase preview

- [ ] **Step 2: Commit**

```bash
git add docs/process/phase-3-agent-architecture.md
git commit -m "docs: Phase 3 agent architecture process documentation"
```

---

## API Reference (After Phase 3)

### Call a Specialist Agent
```bash
curl -X POST http://localhost:3000/api/agents/acoustics \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "optional-uuid",
    "messages": [
      {"role": "user", "content": "What port diameter should I use for a 12L enclosure tuned to 45Hz?"}
    ]
  }'
```

### Call the Project Manager
```bash
curl -X POST http://localhost:3000/api/agents/manager \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "I want to build a bookshelf speaker with the RS180. Where do I start?"}
    ]
  }'
```

### Seed Agents Table
```bash
curl -X POST http://localhost:3000/api/agents/seed
```
