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

/** Parse wizard signals from all user messages in the conversation.
 *  Best-effort heuristic — merges new findings into the existing profile. */
function parseSignalsFromMessages(
  messages: ChatMessage[],
  current: WizardProfile
): WizardProfile {
  const updated = { ...current };

  for (const m of messages) {
    if (m.role !== "user") continue;
    const text = m.content.toLowerCase();

    // Budget: look for dollar amounts
    if (updated.budget_low === undefined && updated.budget_high === undefined) {
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

  // Debug: log incoming message shape
  const firstMsg = messages[0] as unknown as Record<string, unknown>;
  console.log("[design-wizard] first msg keys:", Object.keys(firstMsg));
  console.log("[design-wizard] first msg content:", firstMsg.content);
  console.log("[design-wizard] first msg parts:", JSON.stringify(firstMsg.parts)?.slice(0, 200));

  // Strip the wizard trigger token — global regex removes all occurrences
  const cleanMessages: ChatMessage[] = messages.map((m) => {
    const raw = extractText(m);
    return {
      ...m,
      content: raw.replace(/__WIZARD_TRIGGER__/g, "").trim() || "Let's design a speaker.",
    };
  });

  console.log("[design-wizard] cleanMessages[0].content:", cleanMessages[0]?.content?.slice(0, 100));

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

  // Merge signals extracted from conversation history
  profile = parseSignalsFromMessages(cleanMessages, profile);
  console.log("[design-wizard] profile after extraction:", JSON.stringify(profile));

  const projectedBuild = deriveProjectedBuild(profile);
  const profileComplete = isProfileComplete(profile);

  // Strip experience_level BEFORE injecting into system prompt — never expose to LLM as raw JSON
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
