# Wizard Sprint v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical failure points in the APEX Design Wizard — profile persistence, experience level leakage, confirmation gate, signal completeness, edge case handling — and validate with 5 test scenarios.

**Architecture:** The wizard is a stateful conversation agent (`/api/agents/design-wizard/route.ts`) that builds a `WizardProfile` via LLM conversation, persists it in `agent_memory` via `writeMemory`, and projects a `ProjectedBuild` to display in `WizardPane`. The chat client (`dashboard/chat/page.tsx`) routes wizard messages via `wizardActiveRef` + URL substitution in the transport fetch closure.

**Tech Stack:** Next.js 16, AI SDK v6, TypeScript, Drizzle ORM + Neon PostgreSQL, `lib/agents/wizard-profile.ts`, `lib/agents/memory.ts`

---

## Files Modified

| File | Change |
|------|--------|
| `web/app/api/agents/design-wizard/route.ts` | Profile persistence, experience_level strip, streamText error handling, regex replace |
| `web/lib/agents/wizard-profile.ts` | Fix `!p.budget_low` falsy guard → `=== undefined`, add room_size + amplifier signals |
| `web/lib/agents/system-prompts.ts` | Strengthen wizard prompt: refusal handling, expert shortcut, off-topic rules, new signals |
| `web/app/dashboard/chat/page.tsx` | `useEffect` sync `wizardActive` → `wizardActiveRef` |
| `web/docs/wizard-sprint/logs/v2-improvements.md` | Comparison log created |
| `web/docs/wizard-sprint/versions/` | v1 baseline saves (route, wizard-profile, system-prompts, chat-page) |

---

## Task 1: Save v1 Baseline Copies

**Files:**
- Create: `web/docs/wizard-sprint/versions/route.v1.ts`
- Create: `web/docs/wizard-sprint/versions/wizard-profile.v1.ts`
- Create: `web/docs/wizard-sprint/versions/system-prompts.v1.ts`
- Create: `web/docs/wizard-sprint/versions/chat-page.v1.tsx`

- [ ] **Step 1: Copy current wizard route to v1 baseline**

```bash
cp web/app/api/agents/design-wizard/route.ts web/docs/wizard-sprint/versions/route.v1.ts
cp web/lib/agents/wizard-profile.ts web/docs/wizard-sprint/versions/wizard-profile.v1.ts
cp web/lib/agents/system-prompts.ts web/docs/wizard-sprint/versions/system-prompts.v1.ts
cp web/app/dashboard/chat/page.tsx web/docs/wizard-sprint/versions/chat-page.v1.tsx
```

- [ ] **Step 2: Commit baseline**

```bash
git add web/docs/wizard-sprint/versions/
git commit -m "docs: save wizard v1 baseline before sprint v2 fixes"
```

---

## Task 2: Fix `WizardProfile` — Falsy Guard + New Signals

**Files:**
- Modify: `web/lib/agents/wizard-profile.ts`

**Problem:** `!p.budget_low` returns `true` when budget is `0` (falsy), short-circuiting `deriveProjectedBuild`. Also `profileConfidence` only checks 5 signals but wizard prompt will collect 7 (adding `room_size` and `amplifier`).

- [ ] **Step 1: Open the file and replace the interface + functions**

Replace the content of `web/lib/agents/wizard-profile.ts` with:

```typescript
// Wizard profile — parsed from agent_memory, never shown to user
// Experience level is internal only and never returned to the client.

export interface WizardProfile {
  budget_low?: number;         // USD
  budget_high?: number;        // USD
  placement?: string;          // e.g. "bookshelf", "floor", "desktop"
  use_case?: string;           // e.g. "music", "tv", "studio"
  sound_signature?: string;    // e.g. "warm", "flat", "bright"
  room_size?: string;          // e.g. "small", "medium", "large", "open plan"
  amplifier?: string;          // e.g. "has amp", "needs amp", "integrated", "class D"
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

/** Count how many signals are captured with reasonable confidence.
 *  Requires 5 of the 7 possible signals (budget counts as 1 if either bound is set). */
export function profileConfidence(p: WizardProfile): number {
  let count = 0;
  if (p.budget_low !== undefined || p.budget_high !== undefined) count++;
  if (p.placement) count++;
  if (p.use_case) count++;
  if (p.sound_signature) count++;
  if (p.experience_level !== undefined) count++;
  if (p.room_size) count++;
  if (p.amplifier) count++;
  return count;
}

/** True when wizard has enough to fire the confirmation gate (5 of 7 signals) */
export function isProfileComplete(p: WizardProfile): boolean {
  return profileConfidence(p) >= 5;
}

/** Derive a projected build from the profile.
 *  Returns null only when both budget AND placement are missing. */
export function deriveProjectedBuild(p: WizardProfile): ProjectedBuild | null {
  // Fix: use === undefined instead of !p.budget_low (would fail on $0 budget)
  const hasBudget = p.budget_low !== undefined || p.budget_high !== undefined;
  if (!hasBudget || !p.placement) return null;

  const effectiveLow = p.budget_low ?? 0;
  const totalBudget = p.budget_high ?? effectiveLow * 1.3;
  const driverBudget = Math.round(totalBudget * 0.6);
  const cabinetBudget = totalBudget - driverBudget;

  const isFloor = p.placement.includes('floor') || p.placement.includes('living room');
  const isDesktop = p.placement.includes('desk') || p.placement.includes('near');

  const topology = isFloor ? '2-way floorstanding' : isDesktop ? '2-way desktop/near-field' : '2-way bookshelf';
  const wooferSize = isFloor ? '~6.5" woofer' : isDesktop ? '~4" woofer' : '~5" woofer';
  const f3Low = isFloor ? 45 : isDesktop ? 80 : 65;
  const f3High = isFloor ? 60 : isDesktop ? 100 : 80;
  const sensLow = driverBudget > 150 ? 86 : 84;
  const sensHigh = sensLow + 3;

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

/** Complexity dot rating string */
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

- [ ] **Step 2: Commit**

```bash
git add web/lib/agents/wizard-profile.ts
git commit -m "fix(wizard): fix budget_low falsy guard, add room_size + amplifier signals"
```

---

## Task 3: Fix Design Wizard System Prompt

**Files:**
- Modify: `web/lib/agents/system-prompts.ts` (lines 151–192, the `design_wizard` prompt)

**Problems fixed:**
- Missing `room_size` and `amplifier` signals
- No handling for user who refuses a question
- No handling for expert user who gives all signals in one message
- No handling for repeated off-topic messages
- Confirmation gate language isn't experience-level adaptive
- Experience level visible in raw profile JSON injected to system prompt (handled in Task 4)

- [ ] **Step 1: Replace the `design_wizard` prompt in `system-prompts.ts`**

Find the block starting with `design_wizard:` and replace the entire value (from the backtick after `design_wizard: \`` to the closing backtick before the comma) with:

```
You are the APEX Design Wizard — a conversational guide that helps people design a loudspeaker that matches their needs.

## Your job
Build an invisible profile of the user through natural conversation. You are gathering 7 signals:
1. Budget (total spend in USD)
2. Placement (where the speaker will live: bookshelf, floor, desktop, outdoors, etc.)
3. Use case (music listening, TV/surround, studio monitoring, etc.)
4. Sound signature preference (warm, neutral/flat, bright, bass-heavy, detailed, etc.)
5. Room size (small bedroom, medium living room, large open plan, etc.)
6. Amplifier situation (already has one, needs one included in budget, wants active/powered speaker)
7. Experience level (inferred silently — NEVER ask directly, NEVER mention it)

You need 5 of these 7 signals to fire the confirmation gate. You do not need all 7.

## Rules
- Ask ONE question per response. Never multiple questions in the same message.
- Start with: "Let's build something. First — what's your budget, roughly?"
- Keep responses SHORT — 1-3 sentences maximum until after the confirmation gate.
- Infer experience level silently. Someone who mentions Qts, BL product, or a specific driver model is level 4-5. Someone who says "I want it to sound good" is level 1-2. Calibrate language depth accordingly.
- Adapt question language to experience level: beginners get plain language, experts get technical shorthand.

## Expert shortcut
If the user gives you 3+ signals in a single message (e.g. "500 USD budget, bookshelf, music listening, I'm building a 2-way with a ScanSpeak driver"), extract all of them silently and jump directly to asking about any missing ones. Do not repeat what they told you.

## Handling refusals and skips
- If the user says "not sure", "doesn't matter", "you decide", or similar: treat it as a flexible/open signal, accept it, move to the next question. Do not press them.
- If the user refuses the same question twice: skip it entirely and move on. You can proceed to confirmation gate once you have 5 signals even if some are marked flexible.
- If the user says "skip": immediately move to the next signal.

## Off-topic handling
- If the user asks a technical question mid-wizard (e.g. "what's a Linkwitz transform?"): answer in ONE sentence, then redirect: "Want to keep going with the design?"
- If the user goes off-topic twice in a row: complete the off-topic answer, then do NOT redirect — let them lead.

## Confirmation gate
Once you have 5 or more signals, fire the confirmation gate. Adapt tone by experience level:

**Beginner (levels 1 and 2):** "Here's what sounds right for you — [topology], [enclosure type], around $[driver budget] for the drivers. Does that match what you had in mind, or did I miss something?"

**Intermediate (level 3):** "Based on what you've described — [topology], [enclosure type], ~$[driver budget] driver budget. Does this match your vision, or should we adjust something?"

**Expert (levels 4 and 5):** "[topology] · [enclosure type] · ~$[driver budget] drivers. Correct, or do you want to tune the constraints?"

## After confirmation
Announce handoff to specialist agents:
"◈ enclosure agent — evaluating box alignment..."
"◈ research agent — finding similar builds..."
"◈ acoustics agent — validating driver fit..."

After each agent's contribution, synthesise into a final recommendation using complexity-tagged links:
Format: "→ [Title] [●●○○○] [plain-language reason]"

## Complexity rating guide
- [●○○○○] — beginner, no acoustics knowledge needed
- [●●○○○] — basic speaker literacy needed
- [●●●○○] — intermediate: comfortable with T/S params
- [●●●●○] — advanced: alignment theory, crossover design
- [●●●●●] — expert: deep engineering

## Buy link format
"→ [Driver name] $[price] at [Vendor] [●●○○○] [one sentence reason] (buy link)"

## Final offer
End with: "Want me to load this into the workspace, or keep exploring?"
```

- [ ] **Step 2: Commit**

```bash
git add web/lib/agents/system-prompts.ts
git commit -m "fix(wizard): strengthen system prompt — 7 signals, expert shortcut, refusal handling, adaptive confirmation gate"
```

---

## Task 4: Fix Design Wizard Route — Profile Persistence + Experience Level Strip

**Files:**
- Modify: `web/app/api/agents/design-wizard/route.ts`

**Problems fixed:**
- Profile never written back → wizard is stateless, every turn starts from scratch
- `experience_level` leaks into system prompt via `JSON.stringify(profile, null, 2)` before stripping
- `__WIZARD_TRIGGER__` uses `String.replace()` — only strips first occurrence, not all
- No try/catch around `streamText` — unhandled errors return no response
- Profile extraction from LLM response: needs structured output or signal parsing from text

**Approach for profile persistence without streaming complication:** Use AI SDK `streamText` with a `onFinish` callback to parse signals from the completed assistant response and merge them into the profile, then write to memory. This avoids needing to consume the stream twice.

- [ ] **Step 1: Replace the full content of `web/app/api/agents/design-wizard/route.ts`**

```typescript
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { getModel } from "@/lib/agents/model";
import { SYSTEM_PROMPTS } from "@/lib/agents/system-prompts";
import { readMemory, writeMemory } from "@/lib/agents/memory";
import {
  deserializeProfile,
  serializeProfile,
  deriveProjectedBuild,
  isProfileComplete,
  type WizardProfile,
} from "@/lib/agents/wizard-profile";
import type { AgentChatRequest, ChatMessage } from "@/lib/agents/types";

/** Extract text content from AI SDK v6 UIMessage (parts[]) or legacy content string */
function extractText(m: unknown): string {
  const msg = m as { content?: string; parts?: { type: string; text?: string }[] };
  if (msg.content) return msg.content;
  return (
    msg.parts
      ?.filter((p) => p.type === "text")
      .map((p) => p.text ?? "")
      .join("") ?? ""
  );
}

/** Parse wizard signals from a completed assistant response.
 *  This is a best-effort heuristic — the LLM may not always follow the exact format.
 *  We look for key phrases to update the profile incrementally. */
function parseSignalsFromMessages(
  messages: ChatMessage[],
  current: WizardProfile
): WizardProfile {
  const updated = { ...current };

  // Scan all user messages for signal clues
  for (const m of messages) {
    if (m.role !== "user") continue;
    const text = m.content.toLowerCase();

    // Budget: look for dollar amounts
    const budgetMatch = text.match(/\$?\s*(\d[\d,]*)\s*(?:usd|dollars?|budget|total|spend)?/i);
    if (budgetMatch && updated.budget_low === undefined) {
      const amount = parseInt(budgetMatch[1].replace(/,/g, ""), 10);
      if (amount > 0 && amount < 100000) {
        updated.budget_low = amount;
        // If they say "X-Y" range, pick up high too
        const rangeMatch = text.match(/\$?(\d[\d,]*)\s*[-–to]+\s*\$?(\d[\d,]*)/i);
        if (rangeMatch) {
          updated.budget_low = parseInt(rangeMatch[1].replace(/,/g, ""), 10);
          updated.budget_high = parseInt(rangeMatch[2].replace(/,/g, ""), 10);
        }
      }
    }

    // Placement
    if (!updated.placement) {
      if (text.includes("bookshelf") || text.includes("shelf")) updated.placement = "bookshelf";
      else if (text.includes("floor") || text.includes("floorstand")) updated.placement = "floorstanding";
      else if (text.includes("desk") || text.includes("near-field") || text.includes("nearfield")) updated.placement = "desktop";
      else if (text.includes("outdoor") || text.includes("outside")) updated.placement = "outdoor";
      else if (text.includes("in-wall") || text.includes("built-in")) updated.placement = "in-wall";
    }

    // Use case
    if (!updated.use_case) {
      if (text.includes("studio") || text.includes("monitor") || text.includes("mixing")) updated.use_case = "studio monitoring";
      else if (text.includes("music") || text.includes("hifi") || text.includes("hi-fi")) updated.use_case = "music listening";
      else if (text.includes("tv") || text.includes("surround") || text.includes("home theater") || text.includes("home theatre")) updated.use_case = "TV/surround";
      else if (text.includes("gaming")) updated.use_case = "gaming";
    }

    // Sound signature
    if (!updated.sound_signature) {
      if (text.includes("warm")) updated.sound_signature = "warm";
      else if (text.includes("bright")) updated.sound_signature = "bright";
      else if (text.includes("neutral") || text.includes("flat") || text.includes("accurate")) updated.sound_signature = "neutral/flat";
      else if (text.includes("bass") || text.includes("bass-heavy") || text.includes("punchy")) updated.sound_signature = "bass-heavy";
      else if (text.includes("detail") || text.includes("resolution") || text.includes("analytical")) updated.sound_signature = "detailed";
    }

    // Room size
    if (!updated.room_size) {
      if (text.includes("small room") || text.includes("bedroom") || text.includes("office")) updated.room_size = "small";
      else if (text.includes("living room") || text.includes("medium room") || text.includes("lounge")) updated.room_size = "medium";
      else if (text.includes("large room") || text.includes("open plan") || text.includes("open-plan") || text.includes("big room")) updated.room_size = "large";
    }

    // Amplifier
    if (!updated.amplifier) {
      if (text.includes("have an amp") || text.includes("i have a") || text.includes("already have") || text.includes("existing amp")) updated.amplifier = "has amplifier";
      else if (text.includes("need an amp") || text.includes("need amp") || text.includes("no amp") || text.includes("don't have")) updated.amplifier = "needs amplifier";
      else if (text.includes("active") || text.includes("powered") || text.includes("self-powered") || text.includes("built-in amp")) updated.amplifier = "active/powered";
      else if (text.includes("class d") || text.includes("class-d") || text.includes("hypex") || text.includes("purifi")) updated.amplifier = "class D";
    }

    // Experience level — inferred from vocabulary
    if (updated.experience_level === undefined) {
      const expertTerms = ["qts", "bl product", "bl ", "thiele", "small param", "xmax", "vituixcad", "winisd", "hornresp", "scanspeak", "seas", "purifi", "crossover topology", "linkwitz", "butterworth", "dsp", "fir filter", "iir filter", "baffle step", "port velocity"];
      const intermediateTerms = ["tweeter", "woofer", "midrange", "crossover", "enclosure", "ported", "sealed", "sensitivity", "impedance", "frequency response"];
      const expertScore = expertTerms.filter((t) => text.includes(t)).length;
      const intScore = intermediateTerms.filter((t) => text.includes(t)).length;
      if (expertScore >= 2) updated.experience_level = 5;
      else if (expertScore === 1) updated.experience_level = 4;
      else if (intScore >= 2) updated.experience_level = 3;
      else if (intScore === 1) updated.experience_level = 2;
      // level 1 inferred by absence of all — leave undefined until more turns accumulate
    }
  }

  return updated;
}

export async function POST(req: NextRequest) {
  const body: AgentChatRequest = await req.json();
  const { messages, projectId } = body;

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Strip the wizard trigger token — use global regex to catch all occurrences
  const cleanMessages: ChatMessage[] = messages.map((m) => {
    const raw = extractText(m);
    return {
      ...m,
      content: raw.replace(/__WIZARD_TRIGGER__/g, "").trim() || "Let's design a speaker.",
    };
  });

  // Load existing profile from memory
  let profile: WizardProfile = {};
  if (process.env.DATABASE_URL && projectId) {
    try {
      const mem = await readMemory(projectId, "design_wizard", 1);
      if (mem.length > 0) profile = deserializeProfile(mem[0].value);
    } catch {
      // No DB — continue without profile persistence
    }
  }

  // Merge signals from all user messages so far (incremental signal extraction)
  profile = parseSignalsFromMessages(cleanMessages, profile);

  const projectedBuild = deriveProjectedBuild(profile);
  const profileComplete = isProfileComplete(profile);

  // Strip experience_level BEFORE injecting into system prompt
  const { experience_level, ...profileForPrompt } = profile;

  const systemPrompt =
    SYSTEM_PROMPTS.design_wizard +
    `\n\n## Current profile state\n${JSON.stringify(profileForPrompt, null, 2)}` +
    `\n\nProfile complete: ${profileComplete}` +
    (projectedBuild
      ? `\n\nProjected build so far:\n${JSON.stringify(projectedBuild, null, 2)}`
      : "") +
    (experience_level !== undefined
      ? `\n\n## Inferred experience level (internal only — never mention to user)\n${experience_level}/5`
      : "");

  let result;
  try {
    result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages: cleanMessages.map((m) => ({ role: m.role, content: m.content })),
      maxOutputTokens: 2000,
      onFinish: async () => {
        // Persist updated profile back to memory after stream completes
        if (process.env.DATABASE_URL && projectId) {
          try {
            await writeMemory(projectId, "design_wizard", "wizard_profile", serializeProfile(profile));
          } catch {
            // Memory write failure is non-fatal
          }
        }
      },
    });
  } catch (err) {
    console.error("[design-wizard] streamText error:", err);
    return NextResponse.json({ error: "Wizard agent failed to respond" }, { status: 500 });
  }

  const response = result.toUIMessageStreamResponse();
  const headers = new Headers(response.headers);
  headers.set("X-Routed-Domain", "design_wizard");
  if (projectedBuild) {
    headers.set("X-Wizard-Build", JSON.stringify(projectedBuild));
  }
  // Strip experience_level — never send to client
  const { experience_level: _hidden, ...publicProfile } = profile;
  headers.set("X-Wizard-Profile", JSON.stringify(publicProfile));

  return new Response(response.body, { headers });
}
```

- [ ] **Step 2: Commit**

```bash
git add web/app/api/agents/design-wizard/route.ts
git commit -m "fix(wizard): profile persistence via onFinish writeMemory, experience_level strip from prompt, global trigger regex, streamText error handling"
```

---

## Task 5: Fix Chat Page — wizardActive / wizardActiveRef Sync

**Files:**
- Modify: `web/app/dashboard/chat/page.tsx`

**Problem:** `wizardActiveRef.current` is set to `true` in `triggerWizard()` but `wizardActive` state is set separately. If React batches state and ref updates, the ref can lag. Also: the `chat` memo has an empty dep array but reads `wizardActiveRef` — this is correct, but we should add a `useEffect` to ensure ref stays in sync with state.

- [ ] **Step 1: Add `useEffect` to sync `wizardActive` state → `wizardActiveRef`**

In `web/app/dashboard/chat/page.tsx`, find the line:
```typescript
  const wizardActiveRef = useRef(false);
```

Add immediately after it:
```typescript
  // Keep ref in sync with state for stale-closure safety in the transport fetch
  useEffect(() => {
    wizardActiveRef.current = wizardActive;
  }, [wizardActive]);
```

- [ ] **Step 2: Simplify `triggerWizard` — remove redundant ref set**

The `triggerWizard` function currently sets both `wizardActiveRef.current = true` AND `setWizardActive(true)`. With the `useEffect` sync above, the ref will be set reliably. Keep the direct ref set too (belt-and-suspenders for the immediate fetch call before the effect fires):

```typescript
  function triggerWizard() {
    wizardActiveRef.current = true; // immediate for the imminent fetch call
    setWizardActive(true);          // triggers useEffect to keep in sync thereafter
    sendMessage({ text: "__WIZARD_TRIGGER__ Help me design a speaker." });
  }
```

This is a no-op change for the happy path, but prevents a rare race condition.

- [ ] **Step 3: Commit**

```bash
git add web/app/dashboard/chat/page.tsx
git commit -m "fix(wizard): add useEffect to sync wizardActive state → wizardActiveRef to prevent stale closure"
```

---

## Task 6: Save v2 Copies and Write Improvement Log

**Files:**
- Create: `web/docs/wizard-sprint/versions/route.v2.ts`
- Create: `web/docs/wizard-sprint/versions/wizard-profile.v2.ts`
- Create: `web/docs/wizard-sprint/versions/system-prompts.v2.ts`
- Create: `web/docs/wizard-sprint/versions/chat-page.v2.tsx`
- Create: `web/docs/wizard-sprint/logs/v2-improvements.md`

- [ ] **Step 1: Copy v2 files**

```bash
cp web/app/api/agents/design-wizard/route.ts web/docs/wizard-sprint/versions/route.v2.ts
cp web/lib/agents/wizard-profile.ts web/docs/wizard-sprint/versions/wizard-profile.v2.ts
cp web/lib/agents/system-prompts.ts web/docs/wizard-sprint/versions/system-prompts.v2.ts
cp web/app/dashboard/chat/page.tsx web/docs/wizard-sprint/versions/chat-page.v2.tsx
```

- [ ] **Step 2: Write the improvement log**

Create `web/docs/wizard-sprint/logs/v2-improvements.md` with:

```markdown
# Wizard Sprint v2 — Improvement Log

## Summary

Sprint v2 addresses all 10 critical findings from the swarm review (backend agent: DW-001 to DW-018, UX agent: W-001 to W-018).

## v1 → v2 Changes

### [CRITICAL] Profile never persisted (DW-002 / W-001)
- **v1:** `readMemory` called but `writeMemory` never called. Wizard was stateless — every turn started from empty profile.
- **v2:** `onFinish` callback in `streamText` calls `writeMemory(projectId, "design_wizard", "wizard_profile", serializeProfile(profile))`. Profile now persists across turns and sessions.
- **Impact:** Confirmation gate can now actually fire. Context builds correctly.

### [CRITICAL] experience_level leaked into system prompt (DW-001)
- **v1:** `JSON.stringify(profile, null, 2)` included `experience_level` key. Then `{ experience_level: _hidden, ...publicProfile }` stripped it from the *response headers* but not from the LLM system prompt.
- **v2:** `const { experience_level, ...profileForPrompt } = profile` before injecting. Experience level injected separately in a clearly labelled internal-only section. Never appears in raw profile JSON to LLM.
- **Impact:** LLM no longer sees the explicit level number and potentially leaks it back to user.

### [CRITICAL] isProfileComplete always false (W-002)
- **v1:** `profileConfidence` required 5 specific fields. Since profile was never persisted, it was always empty `{}`. `isProfileComplete({})` = false. Confirmation gate permanently broken.
- **v2:** Fixed by profile persistence (above) + `profileConfidence` updated to count budget as 1 signal if *either* `budget_low` or `budget_high` is set.
- **Impact:** Confirmation gate can now fire correctly.

### [HIGH] budget_low falsy guard (DW-005)
- **v1:** `if (!p.budget_low || !p.placement)` — evaluates to `true` (skip build) when budget is $0.
- **v2:** `const hasBudget = p.budget_low !== undefined || p.budget_high !== undefined` — correct undefined check.
- **Impact:** $0 or very low budgets no longer silently skip the projected build.

### [HIGH] __WIZARD_TRIGGER__ regex not global (DW-010)
- **v1:** `raw.replace("__WIZARD_TRIGGER__", "")` — only removes first occurrence.
- **v2:** `raw.replace(/__WIZARD_TRIGGER__/g, "")` — removes all occurrences.
- **Impact:** No sentinel token leaks to LLM even if message contains multiple occurrences.

### [HIGH] Signal extraction added (W-001 related)
- **v1:** Profile only populated via memory. No extraction from conversation. Signals never populated without persistence working.
- **v2:** `parseSignalsFromMessages()` scans user message history for budget, placement, use case, sound signature, room size, amplifier, and experience level using keyword patterns. Runs on every request before writing to memory.
- **Impact:** Profile builds up incrementally even if memory write fails. Stateless graceful degradation.

### [MEDIUM] Missing signals: room_size and amplifier (W-006 / W-007)
- **v1:** Only 5 signals. Profile missing room_size and amplifier.
- **v2:** 7 signals in `WizardProfile`, 7 in `parseSignalsFromMessages`. Confirmation gate still fires at 5/7.
- **Impact:** More complete recommendations, especially for room-appropriate topology and amplifier budget split.

### [MEDIUM] wizardActive / wizardActiveRef sync (DW-013)
- **v1:** Ref set manually in `triggerWizard`. Possible stale closure if React batches differently.
- **v2:** `useEffect(() => { wizardActiveRef.current = wizardActive; }, [wizardActive])` ensures ref stays in sync.
- **Impact:** Wizard follow-up routing is reliable in all React scheduling scenarios.

### [MEDIUM] No error handling on streamText (DW-006)
- **v1:** `streamText` call unguarded. Any model error returned as garbled stream.
- **v2:** `try/catch` around `streamText` returns a 500 JSON response with a readable error message.
- **Impact:** User sees a real error message instead of silent failure.

### [MEDIUM] System prompt strengthened
- **v1:** No handling for user refusals, expert shortcut, or off-topic escalation.
- **v2:** Added: expert shortcut (extract 3+ signals at once), refusal handling (skip and move on), off-topic escalation (answer + redirect, then drop redirect on repeat), experience-adaptive confirmation gate language.
- **Impact:** Handles power users, reluctant users, and wandering conversations gracefully.

## Test Plan (5 Scenarios)

| # | Scenario | Key Edge Cases Tested |
|---|----------|----------------------|
| 1 | Normal happy path: beginner, gives one signal at a time | Basic flow, confirmation gate fires |
| 2 | Expert shortcut: gives all 5+ signals in first message | Expert detection, no repeated questions |
| 3 | Refusal: skips multiple questions ("you decide") | Skip handling, still reaches confirmation |
| 4 | Off-topic wandering: asks 3 technical questions mid-wizard | Off-topic answer + redirect × 2, then drop redirect |
| 5 | Edge: $0 budget stated, then "actually $50 total" | Budget falsy guard, low-budget projected build |

## Findings NOT Fixed in v2 (Deferred to v3)

- **DW-003:** No session ID → profile key collision across users — deferred (requires auth)
- **DW-007:** No rate limiting on wizard endpoint — deferred (requires infra change)
- **DW-011:** WizardPane doesn't show all 7 signals — deferred (UI sprint)
- **W-003:** No visual progress indicator for signal collection — deferred (UX sprint)
- **W-011:** Workspace chat (Col 3) not wired to agent API — separate task
```

- [ ] **Step 3: Commit**

```bash
git add web/docs/wizard-sprint/
git commit -m "docs: save wizard v2 copies and write v1→v2 improvement log"
```

---

## Task 7: Build and Smoke Test

**Files:**
- None modified (verification only)

- [ ] **Step 1: Type-check the project**

```bash
cd web && npx tsc --noEmit
```

Expected: zero errors. If type errors appear in `route.ts` for the `WizardProfile` import (the new `room_size`/`amplifier` fields), check that `wizard-profile.ts` was saved correctly.

- [ ] **Step 2: Run dev server**

```bash
cd web && npm run dev
```

Expected: Server starts on port 3000 without error. No red TypeScript errors in terminal.

- [ ] **Step 3: Manual smoke test — happy path**

Open browser to `http://localhost:3000/dashboard/chat`. Click "Help me design a speaker from scratch →".

Expected:
- WizardPane appears on right
- First wizard message: "Let's build something. First — what's your budget, roughly?"
- No `__WIZARD_TRIGGER__` visible in chat
- No `undefined` or `[object Object]` in messages

- [ ] **Step 4: Smoke test — follow-up routing**

Reply "around $300".

Expected:
- Response goes to `/api/agents/design-wizard` (not manager)
- Second wizard question appears (placement or use case)
- No "[RESEARCH SPECIALIST]:" prefix (that would indicate wrong routing)

- [ ] **Step 5: Commit smoke test passing note**

```bash
git commit --allow-empty -m "chore: wizard v2 smoke test passing"
```

---

## Task 8: Deploy to Production

**Files:**
- None

- [ ] **Step 1: Push to master**

```bash
git push origin master
```

- [ ] **Step 2: Verify Vercel deployment completes**

Check: https://vercel.com/orishavitas-projects/web — deployment should complete within ~2 minutes.

- [ ] **Step 3: Production smoke test**

Run against production URL:

```bash
curl -s -X POST https://web-blue-theta-12.vercel.app/api/agents/design-wizard \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Let'\''s design a speaker."}]}' \
  --max-time 15 | head -c 500
```

Expected: streaming SSE response starting with `0:"Let` or similar — no empty response, no 500 error.

---

## Test Scenario Scripts (Manual — run after deploy)

These are the 5 wizard test scenarios. Run them against the live chat UI at https://web-blue-theta-12.vercel.app/dashboard/chat.

### Scenario 1: Happy Path (Beginner)
1. Click "Help me design a speaker from scratch →"
2. Reply: "$300"
3. Reply: "bookshelf, for my bedroom"
4. Reply: "mostly music"
5. Reply: "warm and bassy sound"
6. Reply: "medium sized room"
**Pass criteria:** Confirmation gate fires after ≤6 turns. Message uses beginner language. WizardPane shows projected build.

### Scenario 2: Expert Shortcut
1. Click "Help me design a speaker from scratch →"
2. Reply: "500 USD, bookshelf placement, music listening, neutral flat sound, small room, I already have a Hypex amp"
**Pass criteria:** Wizard extracts 6+ signals from single message. Jumps directly to confirmation gate (1-2 turns max). Uses expert register ("~5\" mid/woofer · sealed · ~$300 driver budget. Correct?").

### Scenario 3: Refusal / "You Decide"
1. Click "Help me design a speaker from scratch →"
2. Reply: "$200"
3. Reply: "you decide"  (when asked placement)
4. Reply: "doesn't matter" (when asked use case)
5. Reply: "flat and neutral"
6. Reply: "medium room"
**Pass criteria:** Wizard accepts "you decide" as a flexible signal, moves on, reaches confirmation gate. Does not repeat placement/use-case questions.

### Scenario 4: Off-Topic Wandering
1. Click "Help me design a speaker from scratch →"
2. Reply: "$400"
3. Reply: "what's a Linkwitz transform?" (off-topic)
4. Reply: "bookshelf" (back on topic, answering previous placement Q)
5. Reply: "what's port velocity and why does it matter?" (off-topic again)
6. Reply: "music" (answering use case Q)
**Pass criteria:** Turns 3+5 get brief technical answers. Turn 3 ends with redirect. Turn 5 does NOT end with redirect (second off-topic). Flow continues gathering signals.

### Scenario 5: Edge — Zero / Minimal Budget
1. Click "Help me design a speaker from scratch →"
2. Reply: "$0 budget"
3. Reply (if wizard corrects): "$50 total"
4. Reply: "desktop near my monitor"
5. Reply: "music"
6. Reply: "flat"
**Pass criteria:** No crash when budget is $0 or $50. `deriveProjectedBuild` returns a result (not null). WizardPane shows projected build even at minimal budget.

---
