# Sprint 4b — Guided Design Wizard Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `design_wizard` agent domain to APEX. Triggered by a new starter prompt in chat, the wizard conducts a conversational interview (budget → placement → use case → sound signature), builds an invisible user profile, hits a 5-signal confirmation gate, then orchestrates `enclosure`, `research`, and `acoustics` agents to produce a recommendation. A live profile pane in the chat right column shows captured signals and a projected build summary updating in real time.

**Architecture:** New `design_wizard` domain added to `AgentDomain` union and `DOMAIN_KEYWORDS`. New system prompt in `system-prompts.ts`. A dedicated `/api/agents/design-wizard/route.ts` handles the wizard flow — it maintains profile state via the existing `agent_memory` table, computes projected build estimates, and streams structured JSON events alongside prose so the client can update the right-column pane. The chat page gains a right-side `WizardPane` component that appears when wizard mode is active.

**Tech Stack:** Next.js 16, AI SDK v6 (streamText), Drizzle ORM, existing agent infrastructure.

---

## File Map

| Action | Path | Responsibility |
|--------|------|---------------|
| Modify | `web/lib/agents/types.ts` | Add `design_wizard` to `AgentDomain` union |
| Modify | `web/lib/agents/system-prompts.ts` | Add wizard system prompt |
| Modify | `web/app/api/agents/manager/route.ts` | Add wizard keyword routing + starter prompt trigger |
| Create | `web/app/api/agents/design-wizard/route.ts` | Wizard agent endpoint |
| Create | `web/lib/agents/wizard-profile.ts` | Profile state: parse, update, confidence check |
| Create | `web/components/apex/chat/wizard-pane.tsx` | Right-column live profile + projected build pane |
| Modify | `web/app/dashboard/chat/page.tsx` | Add wizard starter prompt + WizardPane in right column |

---

## Task 1: Add design_wizard to AgentDomain

**Files:**
- Modify: `web/lib/agents/types.ts`

- [ ] **Step 1: Add the new domain**

In `web/lib/agents/types.ts`, update `AgentDomain`:

```ts
export type AgentDomain =
  | "acoustics"
  | "enclosure"
  | "crossover"
  | "theory"
  | "mechanical"
  | "research"
  | "manager"
  | "vituixcad"
  | "design_wizard";
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors (existing exhaustive switches may now warn — fix in subsequent tasks).

- [ ] **Step 3: Commit**

```bash
git add web/lib/agents/types.ts
git commit -m "feat: add design_wizard to AgentDomain union"
```

---

## Task 2: Wizard Profile Logic

**Files:**
- Create: `web/lib/agents/wizard-profile.ts`

- [ ] **Step 1: Create the profile module**

Create `web/lib/agents/wizard-profile.ts`:

```ts
// Wizard profile — parsed from agent_memory, never shown to user
// Experience level is internal only and never returned to the client.

export interface WizardProfile {
  budget_low?: number;       // USD
  budget_high?: number;      // USD
  placement?: string;        // e.g. "bookshelf", "floor", "desktop"
  use_case?: string;         // e.g. "music", "tv", "studio"
  sound_signature?: string;  // e.g. "warm", "flat", "bright"
  experience_level?: 1 | 2 | 3 | 4 | 5;  // NEVER returned to client
}

export interface ProjectedBuild {
  topology: string;          // e.g. "2-way bookshelf"
  woofer_size: string;       // e.g. "~5\" woofer"
  tweeter: string;           // e.g. "1\" dome tweeter"
  enclosure: string;         // e.g. "sealed or small ported"
  f3_est_hz_low: number;
  f3_est_hz_high: number;
  sensitivity_low: number;
  sensitivity_high: number;
  cabinet_budget_usd: number;
}

/** Count how many signals are captured with reasonable confidence */
export function profileConfidence(p: WizardProfile): number {
  let count = 0;
  if (p.budget_low !== undefined) count++;
  if (p.placement) count++;
  if (p.use_case) count++;
  if (p.sound_signature) count++;
  if (p.experience_level !== undefined) count++;
  return count;
}

/** True when wizard has enough to fire the confirmation gate */
export function isProfileComplete(p: WizardProfile): boolean {
  return profileConfidence(p) >= 5;
}

/** Derive a projected build from the profile */
export function deriveProjectedBuild(p: WizardProfile): ProjectedBuild | null {
  if (!p.budget_low || !p.placement) return null;

  const totalBudget = p.budget_high ?? p.budget_low * 1.3;
  const driverBudget = Math.round(totalBudget * 0.6);
  const cabinetBudget = totalBudget - driverBudget;

  const isBookshelf = p.placement?.includes('bookshelf') || p.placement?.includes('desktop') || p.placement?.includes('shelf');
  const isFloor = p.placement?.includes('floor') || p.placement?.includes('living room');

  // Simple heuristic topology
  const topology = isFloor ? '2-way floorstanding' : '2-way bookshelf';
  const wooferSize = isFloor ? '~6.5" woofer' : '~5" woofer';
  const f3Low = isFloor ? 45 : 65;
  const f3High = isFloor ? 60 : 80;
  const sensLow = driverBudget > 150 ? 86 : 84;
  const sensHigh = sensLow + 3;

  // Enclosure preference by sound signature
  const warmSig = p.sound_signature?.includes('warm') || p.sound_signature?.includes('bass');
  const enclosure = warmSig ? 'ported' : 'sealed or small ported';

  return {
    topology,
    woofer_size: wooferSize,
    tweeter: '1" dome tweeter',
    enclosure,
    f3_est_hz_low: f3Low,
    f3_est_hz_high: f3High,
    sensitivity_low: sensLow,
    sensitivity_high: sensHigh,
    cabinet_budget_usd: Math.round(cabinetBudget),
  };
}

/** Complexity dot rating → string for serialization */
export function complexityDots(level: 1 | 2 | 3 | 4 | 5): string {
  return '●'.repeat(level) + '○'.repeat(5 - level);
}

/** Serialize profile for agent_memory storage */
export function serializeProfile(p: WizardProfile): string {
  return JSON.stringify(p);
}

/** Deserialize profile from agent_memory value */
export function deserializeProfile(raw: string): WizardProfile {
  try { return JSON.parse(raw) as WizardProfile; }
  catch { return {}; }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/agents/wizard-profile.ts
git commit -m "feat: wizard profile module — confidence scoring, projected build derivation"
```

---

## Task 3: Wizard System Prompt

**Files:**
- Modify: `web/lib/agents/system-prompts.ts`

- [ ] **Step 1: Add wizard system prompt**

Open `web/lib/agents/system-prompts.ts` and add to the `SYSTEM_PROMPTS` object:

```ts
design_wizard: `You are the APEX Design Wizard — a conversational guide that helps people design a loudspeaker that matches their needs.

## Your job
Build an invisible profile of the user through natural conversation. You are gathering 5 signals:
1. Budget (total spend in USD)
2. Placement (where the speaker will live: bookshelf, floor, desktop, outdoors, etc.)
3. Use case (music listening, TV/surround, studio monitoring, etc.)
4. Sound signature preference (warm, neutral/flat, bright, bass-heavy, detailed, etc.)
5. Experience level (inferred silently from vocabulary and specificity — NEVER ask directly, NEVER mention it)

## Rules
- Ask ONE question per response. Never multiple questions in the same message.
- Start with: "Let's build something. First — what's your budget, roughly?"
- Keep responses SHORT — 1-3 sentences maximum until after the confirmation gate.
- Infer experience level silently. Someone who mentions Qts or mentions a specific driver model is a level 4-5. Someone who says "I want it to sound good" is a level 1-2. Calibrate your language depth accordingly.
- If the user goes off-topic, answer their question briefly via the relevant domain, then offer to return: "Want to continue with the design?"
- If the user says something nonsensical or irrelevant, gently redirect: "That's a bit outside what I can help with for speaker design — shall we continue?"

## Confirmation gate
Once you have all 5 signals, fire the confirmation gate. Summarise in 2 lines and ask for approval:
"Here's what I'm thinking you need — [topology], [enclosure type], budget ~$[driver budget] for drivers. Want me to run with this, or is there something I got wrong?"

## After confirmation
Announce handoff to specialist agents:
"◈ enclosure agent — evaluating box alignment..."
"◈ research agent — finding similar builds..."
"◈ acoustics agent — validating driver fit..."

After each agent's contribution, synthesise into a final recommendation using complexity-tagged links:
Format: "→ [Title] [●●○○○] [plain-language reason]"

## Complexity rating guide (for tagging links and drivers)
- [●○○○○] — no acoustics knowledge needed, pure beginner
- [●●○○○] — basic speaker literacy needed
- [●●●○○] — intermediate: comfortable with T/S params
- [●●●●○] — advanced: alignment theory, crossover design
- [●●●●●] — expert: PhD-level acoustics or deep engineering

## Output format for buy links
"→ [Driver name] $[price] at [Vendor] [●●○○○] [one sentence reason]"
Always add: "(buy link)" suffix — affiliate note is future scope.

## Final offer
End with: "Want me to load this into the workspace, or keep exploring?"`,
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/lib/agents/system-prompts.ts
git commit -m "feat: design_wizard system prompt — profile building, confirmation gate, complexity tags"
```

---

## Task 4: Manager Routing for Wizard

**Files:**
- Modify: `web/app/api/agents/manager/route.ts`

- [ ] **Step 1: Add wizard to DOMAIN_KEYWORDS**

In `web/app/api/agents/manager/route.ts`, add to `DOMAIN_KEYWORDS`:

```ts
design_wizard: [
  "__WIZARD_TRIGGER__",  // exact trigger token — never matches normal queries
],
```

- [ ] **Step 2: Add trigger detection before classifyDomain**

In the `POST` handler, before `const routedDomain = classifyDomain(query);`, add:

```ts
// Explicit wizard trigger — starter prompt sends this exact string
if (query.includes('__WIZARD_TRIGGER__')) {
  // Redirect to wizard endpoint
  const wizardUrl = new URL('/api/agents/design-wizard', req.url);
  const wizardReq = new Request(wizardUrl, {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(body),
  });
  const { default: wizardHandler } = await import('../design-wizard/route');
  return wizardHandler.POST(wizardReq as NextRequest);
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/app/api/agents/manager/route.ts
git commit -m "feat: manager routes __WIZARD_TRIGGER__ to design-wizard agent"
```

---

## Task 5: Wizard Agent Endpoint

**Files:**
- Create: `web/app/api/agents/design-wizard/route.ts`

- [ ] **Step 1: Create the wizard route**

Create `web/app/api/agents/design-wizard/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { SYSTEM_PROMPTS } from '@/lib/agents/system-prompts';
import { readMemory, writeMemory } from '@/lib/agents/memory';
import {
  deserializeProfile,
  serializeProfile,
  deriveProjectedBuild,
  isProfileComplete,
  type WizardProfile,
} from '@/lib/agents/wizard-profile';
import type { AgentChatRequest, ChatMessage } from '@/lib/agents/types';

export const dynamic = 'force-dynamic';

const gateway = createGateway();

export async function POST(req: NextRequest) {
  const body: AgentChatRequest = await req.json();
  const { messages, projectId } = body;

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 });
  }

  // Strip the wizard trigger token from messages before sending to LLM
  const cleanMessages: ChatMessage[] = messages.map(m => ({
    ...m,
    content: m.content.replace('__WIZARD_TRIGGER__', '').trim() ||
      "Let's design a speaker.",
  }));

  // Load existing profile from memory
  let profile: WizardProfile = {};
  if (process.env.DATABASE_URL && projectId) {
    try {
      const mem = await readMemory(projectId, 'design_wizard', 1);
      if (mem.length > 0) profile = deserializeProfile(mem[0].value);
    } catch { /* no DB — continue without profile persistence */ }
  }

  // Derive projected build for client pane
  const projectedBuild = deriveProjectedBuild(profile);
  const profileComplete = isProfileComplete(profile);

  // Build system prompt with current profile context
  const systemPrompt = SYSTEM_PROMPTS.design_wizard +
    `\n\n## Current profile state\n${JSON.stringify(profile, null, 2)}` +
    `\n\nProfile complete: ${profileComplete}` +
    (projectedBuild ? `\n\nProjected build so far:\n${JSON.stringify(projectedBuild, null, 2)}` : '');

  const result = streamText({
    model: gateway('anthropic/claude-sonnet-4.6'),
    system: systemPrompt,
    messages: cleanMessages.map(m => ({ role: m.role, content: m.content })),
  });

  // Return stream with wizard metadata headers
  const response = result.toUIMessageStreamResponse();
  const headers = new Headers(response.headers);
  headers.set('X-Routed-Domain', 'design_wizard');
  if (projectedBuild) {
    headers.set('X-Wizard-Build', JSON.stringify(projectedBuild));
  }
  // Expose profile signals (without experience_level) for the pane
  const { experience_level: _hidden, ...publicProfile } = profile;
  headers.set('X-Wizard-Profile', JSON.stringify(publicProfile));

  return new Response(response.body, { headers });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/app/api/agents/design-wizard/route.ts
git commit -m "feat: design-wizard agent endpoint — profile context, projected build headers"
```

---

## Task 6: Wizard Pane Component

**Files:**
- Create: `web/components/apex/chat/wizard-pane.tsx`

- [ ] **Step 1: Create the wizard pane**

Create `web/components/apex/chat/wizard-pane.tsx`:

```tsx
'use client';

interface PublicProfile {
  budget_low?: number;
  budget_high?: number;
  placement?: string;
  use_case?: string;
  sound_signature?: string;
}

interface ProjectedBuild {
  topology: string;
  woofer_size: string;
  tweeter: string;
  enclosure: string;
  f3_est_hz_low: number;
  f3_est_hz_high: number;
  sensitivity_low: number;
  sensitivity_high: number;
  cabinet_budget_usd: number;
}

interface WizardPaneProps {
  profile: PublicProfile | null;
  build: ProjectedBuild | null;
}

function PaneRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="font-mono text-xs text-zinc-500 w-24">{label}</span>
      <span className="font-mono text-xs text-zinc-200 text-right">{value}</span>
    </div>
  );
}

export function WizardPane({ profile, build }: WizardPaneProps) {
  const budgetStr = profile?.budget_low
    ? profile.budget_high
      ? `$${profile.budget_low}–${profile.budget_high}`
      : `~$${profile.budget_low}`
    : '···';

  return (
    <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Profile signals */}
      <div>
        <div className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-2">Profile</div>
        <PaneRow label="BUDGET"    value={budgetStr} />
        <PaneRow label="PLACEMENT" value={profile?.placement ?? '···'} />
        <PaneRow label="USE CASE"  value={profile?.use_case ?? '···'} />
        <PaneRow label="SOUND SIG" value={profile?.sound_signature ?? '···'} />
      </div>

      {/* Projected build */}
      {build && (
        <>
          <div className="border-t border-zinc-800" />
          <div>
            <div className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-2">Projected Build</div>
            <div className="font-mono text-xs text-zinc-400 leading-relaxed space-y-0.5">
              <div className="text-zinc-200">{build.topology}</div>
              <div>{build.woofer_size} + {build.tweeter}</div>
              <div>{build.enclosure}</div>
            </div>
            <div className="mt-2 space-y-0.5">
              <PaneRow label="est. f3" value={`${build.f3_est_hz_low}–${build.f3_est_hz_high} Hz`} />
              <PaneRow label="sensitivity" value={`${build.sensitivity_low}–${build.sensitivity_high} dB`} />
              <PaneRow label="cabinet $" value={`~$${build.cabinet_budget_usd}`} />
            </div>
          </div>
        </>
      )}

      {!build && (
        <div className="font-mono text-xs text-zinc-700 text-center pt-8">
          projected build appears here as we talk...
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add web/components/apex/chat/wizard-pane.tsx
git commit -m "feat: WizardPane component — live profile signals + projected build display"
```

---

## Task 7: Wire Wizard into Chat Page

**Files:**
- Modify: `web/app/dashboard/chat/page.tsx`

- [ ] **Step 1: Add wizard starter prompt and pane state**

In `web/app/dashboard/chat/page.tsx`:

Add these imports at the top:
```tsx
import { WizardPane } from '@/components/apex/chat/wizard-pane';
```

Add state after existing state declarations:
```tsx
const [wizardActive, setWizardActive] = useState(false);
const [wizardProfile, setWizardProfile] = useState<Record<string, unknown> | null>(null);
const [wizardBuild, setWizardBuild] = useState<Record<string, unknown> | null>(null);
```

- [ ] **Step 2: Add wizard starter prompt to STARTER_PROMPTS**

In `web/app/dashboard/chat/page.tsx`, update `STARTER_PROMPTS`:

```ts
const STARTER_PROMPTS = [
  "Help me design a speaker from scratch →",   // wizard trigger — keep first
  "Port diameter for 12L at 45Hz?",
  "RS180 in a sealed vs ported box?",
  "Linkwitz-Riley vs Butterworth crossover",
  "Isobaric push-push configuration",
  "Best waveguide angle for a 1\" tweeter",
];
```

- [ ] **Step 3: Update handleSubmit to inject wizard trigger**

Find the `handleSubmit` function and update it:

```tsx
function handleSubmit() {
  if (!input.trim() || isLoading) return;
  const text = input.trim();
  // Wizard starter prompt
  if (text === 'Help me design a speaker from scratch →') {
    setWizardActive(true);
    sendMessage({ text: '__WIZARD_TRIGGER__ Help me design a speaker.' });
  } else {
    sendMessage({ text });
  }
  setInput('');
}
```

Also update the starter prompt click handler:
```tsx
onClick={() => {
  if (prompt === 'Help me design a speaker from scratch →') {
    setWizardActive(true);
    sendMessage({ text: '__WIZARD_TRIGGER__ Help me design a speaker.' });
  } else {
    setInput(prompt);
  }
}}
```

- [ ] **Step 4: Update the fetch interceptor to capture wizard headers**

In the `DefaultChatTransport` fetch function, add after `setRoutedDomain`:

```tsx
const wizardProfile = response.headers.get('X-Wizard-Profile');
const wizardBuild = response.headers.get('X-Wizard-Build');
if (wizardProfile) {
  try { setWizardProfile(JSON.parse(wizardProfile)); } catch { /* ignore */ }
}
if (wizardBuild) {
  try { setWizardBuild(JSON.parse(wizardBuild)); } catch { /* ignore */ }
}
```

- [ ] **Step 5: Add WizardPane to layout**

Find the page return JSX. The chat page is currently a simple flex column. Wrap it to add a right pane when wizard is active:

```tsx
return (
  <div className={`flex h-full ${wizardActive ? 'flex-row' : 'flex-col'}`}>
    {/* Main chat column */}
    <div className={`flex flex-col ${wizardActive ? 'flex-1' : 'h-full'}`}>
      {/* ...existing header, messages, input JSX unchanged... */}
    </div>

    {/* Wizard right pane */}
    {wizardActive && (
      <div className="w-72 border-l border-zinc-800 bg-zinc-950 shrink-0">
        <div className="font-mono text-xs text-zinc-500 uppercase tracking-wider px-4 py-3 border-b border-zinc-800">
          Design Profile
        </div>
        <WizardPane
          profile={wizardProfile as Parameters<typeof WizardPane>[0]['profile']}
          build={wizardBuild as Parameters<typeof WizardPane>[0]['build']}
        />
      </div>
    )}
  </div>
);
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd web && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add web/app/dashboard/chat/page.tsx
git commit -m "feat: wire wizard starter prompt, pane, and header parsing into chat page"
```

---

## Task 8: Smoke Test

- [ ] **Step 1: Start dev server**

```bash
cd web && npm run dev
```

- [ ] **Step 2: Open http://localhost:3000/dashboard/chat**

Expected: "Help me design a speaker from scratch →" appears as first starter prompt.

- [ ] **Step 3: Click wizard starter prompt**

Expected: wizard pane appears on the right, chat streams "Let's build something. First — what's your budget, roughly?", domain badge shows `design_wizard`.

- [ ] **Step 4: Answer the wizard's questions**

Type "about $300" → Expected: BUDGET fills in the pane as "~$300".

- [ ] **Step 5: TypeScript final check**

```bash
cd web && npx tsc --noEmit 2>&1
```

Expected: exit code 0.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: Sprint 4b complete — design wizard agent with profile pane"
```
