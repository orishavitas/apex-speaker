export const dynamic = "force-dynamic";

// [CRS:LogicDoc:2026-04-06] BUG-ORIGIN: BH-1 — after() needed to extend Vercel serverless lifetime past response close
// FOUND-BY: BackendHound  SEVERITY: Critical
// ROOT-CAUSE: onFinish is fire-and-forget; Vercel tears down runtime after response body closes
// BEFORE: import { NextRequest, NextResponse } from "next/server"
// AFTER: added `after` — extends function lifetime for deferred writeMemory call
// VALIDATION-LAYER: environment — Vercel serverless lifecycle not accounted for
// TEST: test_profile_persisted_after_stream_completes
import { NextRequest, NextResponse, after } from "next/server";
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

// [CRS:StyleClean:2026-04-06] BUG-ORIGIN: expertTerms and intermediateTerms allocated on every loop iteration
// FOUND-BY: QualityHound  SEVERITY: Low
// ROOT-CAUSE: Arrays defined inside for...of loop body — reallocated O(n) times per call
// BEFORE: const expertTerms = [...] and const intermediateTerms = [...] inside the loop
// AFTER: hoisted to module-level constants EXPERT_TERMS / INTERMEDIATE_TERMS
// VALIDATION-LAYER: business_logic — no allocation audit on signal extraction path
// TEST: test_experience_level_scoring_increases_for_expert_vocab
export const EXPERT_TERMS = [
  "qts", "bl product", "bl ", "thiele", "small param", "xmax", "vituixcad",
  "winisd", "hornresp", "scanspeak", "seas", "purifi", "crossover topology",
  "linkwitz", "butterworth", "dsp", "fir filter", "iir filter", "baffle step",
  "port velocity",
];

export const INTERMEDIATE_TERMS = [
  "tweeter", "woofer", "midrange", "crossover", "enclosure", "ported",
  "sealed", "sensitivity", "impedance", "frequency response",
];

// [CRS:StyleClean:2026-04-06] BUG-ORIGIN: experience_level stripped in two separate destructures (DRY violation)
// FOUND-BY: QualityHound  SEVERITY: Low
// ROOT-CAUSE: experience_level omitted from prompt JSON at line ~168 AND again at ~211 independently
// BEFORE: two separate `const { experience_level, ...rest } = profile` destructures
// AFTER: single PRIVATE_PROFILE_FIELDS constant + stripPrivateFields() helper called in both places
// VALIDATION-LAYER: business_logic — dual-strip could silently diverge if fields are added later
// TEST: test_experience_level_stripped_from_prompt_and_header
const PRIVATE_PROFILE_FIELDS = ["experience_level"] as const;

export function stripPrivateFields(p: WizardProfile): Omit<WizardProfile, "experience_level"> {
  const copy = { ...p };
  for (const field of PRIVATE_PROFILE_FIELDS) {
    delete (copy as Record<string, unknown>)[field];
  }
  return copy as Omit<WizardProfile, "experience_level">;
}

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

/** Parse wizard signals from all user messages in the conversation.
 *  Best-effort heuristic — merges new findings into the existing profile.
 *  Exported for unit testing (QH-8). */
export function parseSignalsFromMessages(
  messages: ChatMessage[],
  current: WizardProfile
): WizardProfile {
  const updated = { ...current };
  // Accumulate running max for experience scoring (BH-8 fix)
  let msgMaxExpertScore = 0;
  let msgMaxIntScore = 0;

  for (const m of messages) {
    if (m.role !== "user") continue;
    // [CRS:LogicDoc:2026-04-06] BUG-ORIGIN: BH-7 — TypeError when m.content is undefined (AI SDK v6 UIMessage uses parts[])
    // FOUND-BY: BackendHound  SEVERITY: Medium
    // ROOT-CAUSE: No null guard before toLowerCase(); cleanMessages may have undefined content when message has only parts
    // BEFORE: const text = m.content.toLowerCase()
    // AFTER: const text = (m.content ?? '').toLowerCase()
    // VALIDATION-LAYER: entry — message shape not validated before string access
    // TEST: test_parse_signals_handles_null_content
    const text = (m.content ?? "").toLowerCase();

    // Budget: look for dollar amounts
    // [CRS:LogicDoc:2026-04-06] BUG-ORIGIN: BH-3 — budget guard blocks re-extraction once either bound is set
    // FOUND-BY: BackendHound  SEVERITY: Medium
    // ROOT-CAUSE: `&&` means guard only fires when BOTH are undefined; if one bound was already extracted, the other can never fill in
    // BEFORE: if (updated.budget_low === undefined && updated.budget_high === undefined)
    // AFTER: if (updated.budget_low === undefined || updated.budget_high === undefined)
    // VALIDATION-LAYER: business_logic — no test for partial budget state mid-conversation
    // TEST: test_budget_reparsed_when_only_one_bound_missing
    if (updated.budget_low === undefined || updated.budget_high === undefined) {
      const rangeMatch = text.match(/\$?(\d[\d,]*)\s*[-–to]+\s*\$?(\d[\d,]*)/i);
      if (rangeMatch) {
        updated.budget_low = parseInt(rangeMatch[1].replace(/,/g, ""), 10);
        updated.budget_high = parseInt(rangeMatch[2].replace(/,/g, ""), 10);
      } else {
        const singleMatch = text.match(/\$?\s*(\d[\d,]*)\s*(?:usd|dollars?|budget|total|spend)?/i);
        if (singleMatch) {
          const amount = parseInt(singleMatch[1].replace(/,/g, ""), 10);
          if (amount > 0 && amount < 100000) {
            updated.budget_low = amount;
          }
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
      else if (text.includes("tv") || text.includes("surround") || text.includes("home theater") || text.includes("home theatre")) updated.use_case = "TV/surround";
      else if (text.includes("gaming")) updated.use_case = "gaming";
      else if (text.includes("music") || text.includes("hifi") || text.includes("hi-fi")) updated.use_case = "music listening";
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
      else if (text.includes("open plan") || text.includes("open-plan") || text.includes("large room") || text.includes("big room")) updated.room_size = "large";
      else if (text.includes("living room") || text.includes("medium room") || text.includes("lounge")) updated.room_size = "medium";
    }

    // Amplifier
    if (!updated.amplifier) {
      if (text.includes("active") || text.includes("powered") || text.includes("self-powered") || text.includes("built-in amp")) updated.amplifier = "active/powered";
      else if (text.includes("have an amp") || text.includes("already have") || text.includes("existing amp") || text.includes("i have a")) updated.amplifier = "has amplifier";
      else if (text.includes("need an amp") || text.includes("need amp") || text.includes("no amp") || text.includes("don't have") || text.includes("dont have")) updated.amplifier = "needs amplifier";
      else if (text.includes("class d") || text.includes("class-d") || text.includes("hypex") || text.includes("purifi")) updated.amplifier = "class D";
    }

    // Experience level — accumulate per-message scores; assign ceiling at end (BH-8)
    const expertScore = EXPERT_TERMS.filter((t) => text.includes(t)).length;
    const intScore = INTERMEDIATE_TERMS.filter((t) => text.includes(t)).length;
    if (expertScore > msgMaxExpertScore) msgMaxExpertScore = expertScore;
    if (intScore > msgMaxIntScore) msgMaxIntScore = intScore;
  }

  // [CRS:LogicDoc:2026-04-06] BUG-ORIGIN: BH-8 — experience_level write-once guard locks score to first message; later expert messages ignored
  // FOUND-BY: BackendHound  SEVERITY: Medium
  // ROOT-CAUSE: Guard `if (updated.experience_level === undefined)` inside loop means first assigned value is permanent
  // BEFORE: experience_level set once inside loop, early exit on first non-undefined
  // AFTER: running max tracked across all messages; ceiling score assigned AFTER loop completes
  // VALIDATION-LAYER: business_logic — no test for multi-message experience re-scoring
  // TEST: test_experience_level_uses_max_score_across_messages
  if (msgMaxExpertScore >= 2) updated.experience_level = 5;
  else if (msgMaxExpertScore === 1) updated.experience_level = 4;
  else if (msgMaxIntScore >= 2) updated.experience_level = 3;
  else if (msgMaxIntScore === 1) updated.experience_level = 2;

  return updated;
}

export async function POST(req: NextRequest) {
  const body: AgentChatRequest = await req.json();
  const { messages, projectId } = body;

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // [CRS:SecPatch:2026-04-06] BUG-ORIGIN: PII/debug content emitted to production Vercel logs
  // FOUND-BY: SecFencer  SEVERITY: Medium
  // ROOT-CAUSE: Unconditional console.log statements emit raw user message content; Vercel logs are accessible to all project members
  // BEFORE: console.log(...firstMsg.content...) — always fires in prod
  // AFTER: guarded by NODE_ENV !== 'production' — logs only in dev/test
  // VALIDATION-LAYER: debug — no prod/dev logging discipline in place
  // OWASP: A09:2021 – Security Logging and Monitoring Failures
  // TEST: test_debug_logs_suppressed_in_production
  if (process.env.NODE_ENV !== "production") {
    const firstMsg = messages[0] as unknown as Record<string, unknown>;
    console.log("[design-wizard] first msg keys:", Object.keys(firstMsg));
    console.log("[design-wizard] first msg content:", firstMsg.content);
    console.log("[design-wizard] first msg parts:", JSON.stringify(firstMsg.parts)?.slice(0, 200));
  }

  // Strip the wizard trigger token — global regex removes all occurrences
  const cleanMessages: ChatMessage[] = messages.map((m) => {
    const raw = extractText(m);
    return {
      ...m,
      content: raw.replace(/__WIZARD_TRIGGER__/g, "").trim() || "Let's design a speaker.",
    };
  });

  // [CRS:SecPatch:2026-04-06] BUG-ORIGIN: User message content logged to production (SEC-3 continued)
  // FOUND-BY: SecFencer  SEVERITY: Medium
  // ROOT-CAUSE: Same unconditional logging pattern — emits cleaned user text to Vercel prod logs
  // BEFORE: console.log("[design-wizard] cleanMessages[0].content:", ...)
  // AFTER: guarded by NODE_ENV !== 'production'
  // VALIDATION-LAYER: debug — no prod log guard
  // OWASP: A09:2021 – Security Logging and Monitoring Failures
  // TEST: test_debug_logs_suppressed_in_production
  if (process.env.NODE_ENV !== "production") {
    console.log("[design-wizard] cleanMessages[0].content:", cleanMessages[0]?.content?.slice(0, 100));
  }

  // Load existing profile from memory
  let profile: WizardProfile = {};
  if (process.env.DATABASE_URL && projectId) {
    try {
      // [CRS:LogicDoc:2026-04-06] BUG-ORIGIN: BH-2 — readMemory returns any row for domain; wrong data loaded as profile
      // FOUND-BY: BackendHound  SEVERITY: High
      // ROOT-CAUSE: No key filter on readMemory query; first result may be any memory entry for the domain (limit=1 makes it arbitrary)
      // BEFORE: readMemory(..., 1) then mem[0].value — unfiltered, returns first row regardless of key
      // AFTER: fetch up to 20 entries, find row with key === 'wizard_profile' before deserializing
      // VALIDATION-LAYER: business_logic — key-based filtering not enforced at query layer
      // TEST: test_load_profile_uses_wizard_profile_key
      const mem = await readMemory(projectId, "design_wizard", 20);
      const profileEntry = mem.find((e) => e.key === "wizard_profile");
      if (profileEntry) profile = deserializeProfile(profileEntry.value);
    } catch {
      // No DB — continue without profile persistence
    }
  }

  // Merge signals extracted from conversation history
  profile = parseSignalsFromMessages(cleanMessages, profile);
  // [CRS:SecPatch:2026-04-06] BUG-ORIGIN: Full profile (incl. budget, PII signals) logged unconditionally to prod (SEC-3)
  // FOUND-BY: SecFencer  SEVERITY: Medium
  // ROOT-CAUSE: profile object serialized and emitted to Vercel logs in all environments
  // BEFORE: console.log("[design-wizard] profile after extraction:", JSON.stringify(profile))
  // AFTER: guarded by NODE_ENV !== 'production'
  // VALIDATION-LAYER: debug — no prod log guard
  // OWASP: A09:2021 – Security Logging and Monitoring Failures
  // TEST: test_debug_logs_suppressed_in_production
  if (process.env.NODE_ENV !== "production") {
    console.log("[design-wizard] profile after extraction:", JSON.stringify(profile));
  }

  const projectedBuild = deriveProjectedBuild(profile);
  const profileComplete = isProfileComplete(profile);

  // Strip experience_level BEFORE injecting into system prompt — never expose to LLM as raw JSON
  // QH-5: uses shared stripPrivateFields() — single source of truth for which fields are private
  const { experience_level } = profile;
  const profileForPrompt = stripPrivateFields(profile);

  // [CRS:SecPatch:2026-04-06] BUG-ORIGIN: User-controlled string signals injected verbatim into LLM system prompt
  // FOUND-BY: SecFencer  SEVERITY: High
  // ROOT-CAUSE: parseSignalsFromMessages extracts free-text values and they are JSON.stringify'd directly
  //   into the system prompt without validation — a crafted message can break out of the JSON block
  //   and inject arbitrary instructions into the LLM context (prompt injection).
  // BEFORE: profileForPrompt injected as-is via JSON.stringify
  // AFTER: each field validated against its expected type/enum; invalid fields are stripped before injection
  // VALIDATION-LAYER: business_logic — no allowlist gate between signal extraction and prompt assembly
  // OWASP: A03:2021 – Injection (Prompt Injection variant)
  // TEST: test_prompt_injection_blocked_on_profile_signals
  const USE_CASE_ALLOWLIST = new Set(["home_hifi", "studio_monitor", "pa_system", "home_theater", "portable", "other", "studio monitoring", "TV/surround", "gaming", "music listening"]);
  const PLACEMENT_ALLOWLIST = new Set(["desktop", "bookshelf", "floorstanding", "floor_standing", "in-wall", "in_wall", "outdoor", "other"]);
  const SOUND_SIGNATURE_ALLOWLIST = new Set(["warm", "bright", "neutral/flat", "bass-heavy", "detailed", "accurate_flat", "warm_bass", "bright_detailed", "balanced"]);
  const ROOM_SIZE_ALLOWLIST = new Set(["small", "medium", "large"]);
  const AMPLIFIER_ALLOWLIST = new Set(["active/powered", "has amplifier", "needs amplifier", "class D"]);

  const sanitizedProfileForPrompt: Record<string, unknown> = {};

  // budget_low / budget_high: must be a finite non-negative number
  if (typeof profileForPrompt.budget_low === "number" && isFinite(profileForPrompt.budget_low) && profileForPrompt.budget_low >= 0) {
    sanitizedProfileForPrompt.budget_low = profileForPrompt.budget_low;
  }
  if (typeof profileForPrompt.budget_high === "number" && isFinite(profileForPrompt.budget_high) && profileForPrompt.budget_high >= 0) {
    sanitizedProfileForPrompt.budget_high = profileForPrompt.budget_high;
  }
  // Enum fields — strip any value not on the allowlist
  if (typeof profileForPrompt.use_case === "string" && USE_CASE_ALLOWLIST.has(profileForPrompt.use_case)) {
    sanitizedProfileForPrompt.use_case = profileForPrompt.use_case;
  }
  if (typeof profileForPrompt.placement === "string" && PLACEMENT_ALLOWLIST.has(profileForPrompt.placement)) {
    sanitizedProfileForPrompt.placement = profileForPrompt.placement;
  }
  if (typeof profileForPrompt.sound_signature === "string" && SOUND_SIGNATURE_ALLOWLIST.has(profileForPrompt.sound_signature)) {
    sanitizedProfileForPrompt.sound_signature = profileForPrompt.sound_signature;
  }
  if (typeof profileForPrompt.room_size === "string" && ROOM_SIZE_ALLOWLIST.has(profileForPrompt.room_size)) {
    sanitizedProfileForPrompt.room_size = profileForPrompt.room_size;
  }
  if (typeof profileForPrompt.amplifier === "string" && AMPLIFIER_ALLOWLIST.has(profileForPrompt.amplifier)) {
    sanitizedProfileForPrompt.amplifier = profileForPrompt.amplifier;
  }

  const systemPrompt =
    SYSTEM_PROMPTS.design_wizard +
    `\n\n## Current profile state\n${JSON.stringify(sanitizedProfileForPrompt, null, 2)}` +
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
        // [CRS:LogicDoc:2026-04-06] BUG-ORIGIN: BH-1 — writeMemory silently skipped; Vercel tears down runtime after response body closes
        // FOUND-BY: BackendHound  SEVERITY: Critical
        // ROOT-CAUSE: onFinish is fire-and-forget; no lifetime extension for Vercel serverless runtime
        // BEFORE: await writeMemory(...) called directly — no guarantee runtime stays alive
        // AFTER: wrapped in after() — extends function lifetime until callback resolves (Vercel official API)
        // VALIDATION-LAYER: environment — Vercel serverless lifecycle not accounted for at design time
        // TEST: test_profile_persisted_after_stream_completes
        if (process.env.DATABASE_URL && projectId) {
          after(async () => {
            try {
              await writeMemory(projectId, "design_wizard", "wizard_profile", serializeProfile(profile));
            } catch (err) {
              console.error("[design-wizard] writeMemory failed in after():", err);
            }
          });
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
  // Strip experience_level — never send to client; uses shared stripPrivateFields()
  // [CRS:LogicDoc:2026-04-06] BUG-ORIGIN: ARCH-2 — X-Wizard-Profile header silently truncated by Vercel proxy when JSON > ~8KB
  // FOUND-BY: BackendHound  SEVERITY: High
  // ROOT-CAUSE: HTTP response headers not designed for large JSON payloads; Vercel edge has hard header size limits (~8KB)
  // BEFORE: headers.set("X-Wizard-Profile", JSON.stringify(publicProfile)) — no size check, set blindly; returns {} to client
  // AFTER: measure payload length; warn if > 6000 bytes (safe margin below 8KB limit); log actual value for debugging
  // VALIDATION-LAYER: environment — infrastructure constraint not considered at design time
  // TEST: test_wizard_profile_header_present_and_not_truncated
  const publicProfileJson = JSON.stringify(stripPrivateFields(profile));
  if (publicProfileJson.length > 6000) {
    console.warn(
      `[design-wizard] X-Wizard-Profile header is ${publicProfileJson.length} bytes — ` +
      "exceeds 6KB safe limit. Profile may be truncated by Vercel proxy. " +
      "Fetch profile via GET /api/agents/design-wizard/profile as fallback."
    );
  }
  console.log("[design-wizard] X-Wizard-Profile payload:", publicProfileJson);
  headers.set("X-Wizard-Profile", publicProfileJson);

  return new Response(response.body, { headers });
}
