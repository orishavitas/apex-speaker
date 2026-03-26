# APEX Phase 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the APEX web app with Next.js 16, the APEX design system, Neon PostgreSQL with pgvector, Drizzle ORM, and the full DB schema ready for agent and knowledge data.

**Architecture:** Next.js 16 App Router in `/web` directory. Drizzle ORM with Neon serverless driver. pgvector for embeddings. shadcn/ui with a custom APEX dark theme built on zinc palette + electric blue accent.

**Tech Stack:** Next.js 16, TypeScript, shadcn/ui, Tailwind CSS 4, Drizzle ORM, Neon PostgreSQL, pgvector, Geist font, AI Elements

**Spec:** `docs/superpowers/specs/2026-03-26-apex-system-design.md`

---

## File Map

```
apex-speaker/
├── web/                          # Next.js app
│   ├── app/
│   │   ├── layout.tsx            # Root layout with APEX theme
│   │   ├── page.tsx              # Landing / redirect to dashboard
│   │   ├── globals.css           # CSS variables, APEX color tokens
│   │   ├── dashboard/
│   │   │   └── page.tsx          # Main dashboard shell (placeholder)
│   │   └── api/
│   │       └── health/
│   │           └── route.ts      # Health check endpoint
│   ├── components/
│   │   ├── ui/                   # shadcn/ui components (auto-generated)
│   │   └── apex/
│   │       ├── agent-badge.tsx   # Agent identity badge with domain color
│   │       ├── sidebar.tsx       # Left nav sidebar
│   │       └── theme-provider.tsx
│   ├── lib/
│   │   ├── db/
│   │   │   ├── index.ts          # Drizzle client (Neon serverless)
│   │   │   ├── schema.ts         # Full DB schema
│   │   │   └── migrations/       # Drizzle migration files
│   │   └── utils.ts              # cn() and shared utils
│   ├── components.json           # shadcn/ui config
│   ├── next.config.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── drizzle.config.ts
├── docs/
│   ├── process/
│   │   └── phase-1-foundation.md # Process doc (written at end)
│   └── superpowers/
│       ├── specs/
│       └── plans/
└── .gitignore
```

---

## Task 1: Scaffold Next.js 16 App

**Files:**
- Create: `web/` (full Next.js app)

- [ ] **Step 1: Initialize Next.js 16 with TypeScript and Tailwind**

```bash
cd /c/Users/OriShavit/documents/github/apex-speaker
npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*" --turbopack --yes
```

- [ ] **Step 2: Install core dependencies**

```bash
cd web
npm install drizzle-orm@^0.31.0 @neondatabase/serverless
npm install -D drizzle-kit
npm install ai @ai-sdk/react @ai-sdk/gateway
npm install geist
npm install dotenv
```

- [ ] **Step 3: Verify dev server starts**

```bash
npm run dev
```
Expected: Server starts on http://localhost:3000, no errors.

- [ ] **Step 4: Commit**

```bash
cd ..
git add web/
git commit -m "feat: scaffold Next.js 16 app with core dependencies"
```

---

## Task 2: Configure APEX Design System

**Files:**
- Modify: `web/app/globals.css`
- Modify: `web/app/layout.tsx`
- Create: `web/components/apex/theme-provider.tsx`

- [ ] **Step 1: Initialize shadcn/ui**

```bash
cd web
npx shadcn@latest init
```
When prompted: select **Dark** style, **zinc** base color, **yes** to CSS variables. The `--defaults` flag bypasses these prompts — do NOT use it here.

- [ ] **Step 2: Add core shadcn components**

```bash
npx shadcn@latest add button card badge separator tooltip tabs scroll-area sheet dialog
```

- [ ] **Step 3: Replace globals.css with APEX token system**

Replace `web/app/globals.css` with:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* APEX dark theme - engineering instrument aesthetic */
  --background: 0 0% 4%;          /* zinc-950 */
  --foreground: 0 0% 90%;
  --card: 0 0% 6%;                 /* zinc-900 */
  --card-foreground: 0 0% 90%;
  --popover: 0 0% 6%;
  --popover-foreground: 0 0% 90%;
  --primary: 213 89% 64%;          /* electric blue #4f9cf9 */
  --primary-foreground: 0 0% 4%;
  --secondary: 0 0% 10%;           /* zinc-800 */
  --secondary-foreground: 0 0% 70%;
  --muted: 0 0% 10%;
  --muted-foreground: 0 0% 45%;
  --accent: 213 89% 64%;
  --accent-foreground: 0 0% 4%;
  --destructive: 0 84% 60%;
  --border: 0 0% 12%;              /* zinc-800 borders */
  --input: 0 0% 12%;
  --ring: 213 89% 64%;
  --radius: 0.5rem;

  /* Agent domain colors */
  --agent-acoustics: 213 89% 64%;   /* blue */
  --agent-enclosure: 142 71% 45%;   /* green */
  --agent-crossover: 38 92% 50%;    /* amber */
  --agent-theory: 271 91% 65%;      /* violet */
  --agent-mechanical: 215 14% 55%;  /* slate */
  --agent-research: 188 86% 53%;    /* cyan */
  --agent-manager: 0 0% 90%;        /* white */
}

* {
  border-color: hsl(var(--border));
}

body {
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: var(--font-geist-sans), sans-serif;
}

code, .mono {
  font-family: var(--font-geist-mono), monospace;
}
```

- [ ] **Step 4: Update root layout with Geist font and dark class**

Replace `web/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "APEX — Speaker Design Intelligence",
  description: "Multi-agent speaker design platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verify styles load correctly**

```bash
npm run dev
```
Expected: Page renders with dark background (zinc-950), no CSS errors in console.

- [ ] **Step 6: Commit**

```bash
cd ..
git add web/
git commit -m "feat: APEX design system — dark theme, zinc palette, agent color tokens"
```

---

## Task 3: Build Agent Badge Component

**Files:**
- Create: `web/components/apex/agent-badge.tsx`

- [ ] **Step 1: Create agent badge with domain colors**

```tsx
// web/components/apex/agent-badge.tsx
import { cn } from "@/lib/utils";

export type AgentDomain =
  | "acoustics"
  | "enclosure"
  | "crossover"
  | "theory"
  | "mechanical"
  | "research"
  | "manager";

const AGENT_CONFIG: Record<AgentDomain, { label: string; color: string; icon: string }> = {
  manager:    { label: "Project Manager", color: "border-white/40 text-white",        icon: "◈" },
  acoustics:  { label: "Acoustics",       color: "border-blue-400 text-blue-400",     icon: "🔊" },
  enclosure:  { label: "Enclosure",       color: "border-green-400 text-green-400",   icon: "📦" },
  crossover:  { label: "Crossover",       color: "border-amber-400 text-amber-400",   icon: "⚡" },
  theory:     { label: "Theory",          color: "border-violet-400 text-violet-400", icon: "🔬" },
  mechanical: { label: "Mechanical",      color: "border-slate-400 text-slate-400",   icon: "⚙️" },
  research:   { label: "Research",        color: "border-cyan-400 text-cyan-400",     icon: "🌐" },
};

interface AgentBadgeProps {
  domain: AgentDomain;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function AgentBadge({ domain, size = "md", showLabel = true, className }: AgentBadgeProps) {
  const config = AGENT_CONFIG[domain];
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-3 py-1 gap-1.5",
    lg: "text-base px-4 py-2 gap-2",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border font-mono font-medium",
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <span>{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
```

- [ ] **Step 2: Create components barrel export**

Create `web/components/index.ts`:
```typescript
export { AgentBadge, type AgentDomain } from "./apex/agent-badge";
export { Sidebar } from "./apex/sidebar";
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/OriShavit/documents/github/apex-speaker
git add web/components/
git commit -m "feat: AgentBadge component with domain color system"
```

---

## Task 4: Database Schema

**Files:**
- Create: `web/lib/db/schema.ts`
- Create: `web/lib/db/index.ts`
- Create: `web/drizzle.config.ts`

- [ ] **Step 0: Set DATABASE_URL before running any DB commands**

Create `web/.env.local` with your Neon connection string (get from Neon dashboard):
```
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
```
Do NOT commit this file — it is in .gitignore.

- [ ] **Step 1: Create Drizzle schema**

```typescript
// web/lib/db/schema.ts
import {
  pgTable, text, varchar, timestamp, uuid, real, integer,
  boolean, jsonb, customType, index, pgEnum
} from "drizzle-orm/pg-core";

// pgvector custom type (vector not exported from drizzle-orm/pg-core natively)
const vector = customType<{ data: number[]; config: { dimensions: number } }>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 1536})`;
  },
});


// Enums
export const agentDomainEnum = pgEnum("agent_domain", [
  "manager", "acoustics", "enclosure", "crossover", "theory", "mechanical", "research"
]);

export const sourceTypeEnum = pgEnum("source_type", [
  "chatgpt_conversation", "book_chapter", "forum_thread", "datasheet", "research_paper"
]);

export const knowledgeStatusEnum = pgEnum("knowledge_status", [
  "private", "canonical"
]);

// Projects — a user's speaker build project
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  goals: jsonb("goals").$type<string[]>().default([]),
  constraints: jsonb("constraints").$type<Record<string, string>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Conversations — chat history per project
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id),
  role: varchar("role", { length: 20 }).notNull(), // user | assistant
  agentDomain: agentDomainEnum("agent_domain").default("manager"),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Knowledge chunks — RAG-indexed knowledge units
export const knowledgeChunks = pgTable("knowledge_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  agentDomain: agentDomainEnum("agent_domain").notNull(),
  title: varchar("title", { length: 512 }),
  content: text("content").notNull(),
  summary: text("summary"),
  tags: jsonb("tags").$type<string[]>().default([]),
  confidence: real("confidence").default(0.7),
  status: knowledgeStatusEnum("status").default("canonical"),
  embedding: vector("embedding", { dimensions: 1536 }),
  sourceUrl: text("source_url"),
  sourcePath: text("source_path"),
  chunkIndex: integer("chunk_index").default(0),
  parentId: uuid("parent_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("knowledge_domain_idx").on(table.agentDomain),
  index("knowledge_status_idx").on(table.status),
  // HNSW index created separately via raw SQL migration after push (pgvector requirement)
]);

// Agents — identity, config, and status per domain
export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  domain: agentDomainEnum("domain").notNull().unique(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  systemPrompt: text("system_prompt"),
  isActive: boolean("is_active").default(true),
  knowledgeChunkCount: integer("knowledge_chunk_count").default(0),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Agent memory — private scratchpad per agent per project
export const agentMemory = pgTable("agent_memory", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id).notNull(),
  agentDomain: agentDomainEnum("agent_domain").notNull(),
  key: varchar("key", { length: 255 }).notNull(),
  value: text("value").notNull(),
  isPromoted: boolean("is_promoted").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sources — ingestion registry
export const sources = pgTable("sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 512 }).notNull(),
  sourceType: sourceTypeEnum("source_type").notNull(),
  url: text("url"),
  filePath: text("file_path"),
  totalChunks: integer("total_chunks").default(0),
  isIngested: boolean("is_ingested").default(false),
  ingestedAt: timestamp("ingested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Create Drizzle client**

```typescript
// web/lib/db/index.ts
// Uses neon-http adapter (HTTP fetch-based, pairs with neon() function)
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
export * from "./schema";
```

- [ ] **Step 3: Create Drizzle config**

```typescript
// web/drizzle.config.ts
import type { Config } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export default {
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

- [ ] **Step 4: Enable pgvector extension and push schema to Neon**

```bash
cd web
# Enable pgvector extension on Neon (run once)
# Open Neon dashboard SQL editor and run: CREATE EXTENSION IF NOT EXISTS vector;
# Then push the schema:
npx drizzle-kit push
```
Expected: Drizzle prints all 6 tables created (projects, conversations, knowledge_chunks, agent_memory, agents, sources). No errors.

- [ ] **Step 5: Seed agents table with domain roster**

```bash
# Run this seed script once after push:
node -e "
const { neon } = require('@neondatabase/serverless');
require('dotenv').config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);
const agents = [
  { domain: 'manager',    display_name: 'Project Manager', system_prompt: 'You coordinate all specialist agents and guide the user through speaker design.' },
  { domain: 'acoustics',  display_name: 'Acoustics Agent', system_prompt: 'You are an expert in electroacoustics, SPL, frequency response, and directivity.' },
  { domain: 'enclosure',  display_name: 'Enclosure Agent', system_prompt: 'You specialize in cabinet design: ported, sealed, isobaric, passive radiator, transmission line.' },
  { domain: 'crossover',  display_name: 'Crossover Agent', system_prompt: 'You design crossover networks: topology, component values, phase alignment.' },
  { domain: 'theory',     display_name: 'Theory Agent',    system_prompt: 'You handle Thiele-Small parameters, physics, and mathematical modeling.' },
  { domain: 'mechanical', display_name: 'Mechanical Agent',system_prompt: 'You advise on materials, bracing, damping, CNC, and 3D printing.' },
  { domain: 'research',   display_name: 'Research Agent',  system_prompt: 'You search forums, papers, and datasheets to find relevant technical information.' },
];
Promise.all(agents.map(a => sql\`INSERT INTO agents (domain, display_name, system_prompt) VALUES (\${a.domain}, \${a.display_name}, \${a.system_prompt}) ON CONFLICT (domain) DO NOTHING\`))
  .then(() => { console.log('Agents seeded'); process.exit(0); })
  .catch(e => { console.error(e); process.exit(1); });
"
```
Expected: "Agents seeded"

- [ ] **Step 6: Commit**

```bash
cd /c/Users/OriShavit/documents/github/apex-speaker
git add web/lib/ web/drizzle.config.ts
git commit -m "feat: Drizzle schema — projects, conversations, knowledge_chunks, agent_memory, agents, sources + migration"
```

---

## Task 5: Dashboard Shell UI

**Files:**
- Create: `web/components/apex/sidebar.tsx`
- Modify: `web/app/dashboard/page.tsx`
- Modify: `web/app/page.tsx`

- [ ] **Step 1: Create sidebar component**

```tsx
// web/components/apex/sidebar.tsx
import Link from "next/link";
import { AgentBadge, type AgentDomain } from "./agent-badge";

const AGENTS: AgentDomain[] = [
  "manager", "acoustics", "enclosure", "crossover", "theory", "mechanical", "research"
];

export function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-zinc-800">
        <div className="font-mono text-xl font-bold tracking-wider text-white">
          APEX
        </div>
        <div className="text-xs text-zinc-500 mt-0.5 font-mono">
          Speaker Design Intelligence
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest px-3 pb-2">
          Workspace
        </div>
        <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm transition-colors">
          <span className="font-mono">◈</span> Dashboard
        </Link>
        <Link href="/knowledge" className="flex items-center gap-2 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm transition-colors">
          <span className="font-mono">⊕</span> Knowledge Base
        </Link>
        <Link href="/sources" className="flex items-center gap-2 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm transition-colors">
          <span className="font-mono">⊞</span> Sources
        </Link>

        <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest px-3 pb-2 pt-4">
          Agents
        </div>
        {AGENTS.map((domain) => (
          <div key={domain} className="px-3 py-1.5">
            <AgentBadge domain={domain} size="sm" />
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 text-xs font-mono text-zinc-600">
        v0.1.0 — Phase 1
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Create dashboard shell**

```tsx
// web/app/dashboard/page.tsx
import { Sidebar } from "@/components/apex/sidebar";
import { AgentBadge } from "@/components/apex/agent-badge";

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-zinc-950">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between">
          <h1 className="font-mono text-sm text-zinc-400">
            — no project selected —
          </h1>
          <AgentBadge domain="manager" size="sm" />
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="font-mono text-4xl font-bold text-zinc-700">APEX</div>
            <p className="text-zinc-500 text-sm font-mono">
              Knowledge pipeline initializing...
            </p>
            <p className="text-zinc-600 text-xs font-mono">
              Phase 1: Foundation complete. Phase 2: Knowledge ingestion next.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Redirect root to dashboard**

```tsx
// web/app/page.tsx
import { redirect } from "next/navigation";
export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 4: Health check API route**

```typescript
// web/app/api/health/route.ts
import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ status: "ok", phase: "1-foundation", version: "0.1.0" });
}
```

- [ ] **Step 5: Verify dashboard renders**

```bash
npm run dev
```
Open http://localhost:3000 — should redirect to /dashboard. Dark zinc background. APEX sidebar. Agent badges visible.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/OriShavit/documents/github/apex-speaker
git add web/
git commit -m "feat: dashboard shell with APEX sidebar and agent roster"
```

---

## Task 6: .gitignore and .env Setup

- [ ] **Step 1: Create .gitignore**

```
# web
web/.next/
web/node_modules/
web/.env.local
web/.env*.local

# superpowers
.superpowers/

# OS
.DS_Store
Thumbs.db
```

Save to `/c/Users/OriShavit/documents/github/apex-speaker/.gitignore`

- [ ] **Step 2: Create .env.local template (no secrets)**

```bash
# web/.env.local.example
DATABASE_URL=postgresql://...
# Get from: vercel env pull (after vercel link)
# VERCEL_OIDC_TOKEN=auto-provisioned
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/OriShavit/documents/github/apex-speaker
git add .gitignore web/.env.local.example
git commit -m "chore: gitignore and env template"
```

---

## Task 7: Process Documentation

- [ ] **Step 1: Write Phase 1 process doc**

Create `docs/process/phase-1-foundation.md` with:
- What was built
- Design decisions made (why zinc/dark, why Drizzle over Prisma, why pgvector)
- DB schema rationale
- How to extend

- [ ] **Step 2: Commit process doc**

```bash
git add docs/process/phase-1-foundation.md
git commit -m "docs: Phase 1 foundation process documentation"
```

---

## Completion Checklist

- [ ] `npm run build` passes with zero errors
- [ ] `npm run dev` — dashboard loads, dark theme, all agent badges visible
- [ ] `/api/health` returns `{"status":"ok"}`
- [ ] DB schema file compiles without TypeScript errors
- [ ] All 7 tasks committed individually

---

## Next Phase

**Phase 2: Knowledge Pipeline**
- Ingest 23 scraped ChatGPT conversations into Neon via embeddings
- Book PDF chunking pipeline
- Forum crawler (Playwright agent for DIYAudio, AudioScienceReview)
- Knowledge search API

Plan file: `docs/superpowers/plans/2026-03-26-phase-2-knowledge-pipeline.md`
