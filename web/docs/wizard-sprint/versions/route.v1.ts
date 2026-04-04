export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { getModel } from "@/lib/agents/model";
import { SYSTEM_PROMPTS } from "@/lib/agents/system-prompts";
import { readMemory } from "@/lib/agents/memory";
import {
  deserializeProfile,
  deriveProjectedBuild,
  isProfileComplete,
  type WizardProfile,
} from "@/lib/agents/wizard-profile";
import type { AgentChatRequest, ChatMessage } from "@/lib/agents/types";

export async function POST(req: NextRequest) {
  const body: AgentChatRequest = await req.json();
  const { messages, projectId } = body;

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Strip the wizard trigger token before sending to LLM
  // AI SDK v6 UIMessage may have parts instead of content string
  const cleanMessages: ChatMessage[] = messages.map((m) => {
    const raw = m.content ??
      (m as unknown as { parts?: { type: string; text?: string }[] }).parts
        ?.filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("") ?? "";
    return {
      ...m,
      content: raw.replace("__WIZARD_TRIGGER__", "").trim() || "Let's design a speaker.",
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

  const projectedBuild = deriveProjectedBuild(profile);
  const profileComplete = isProfileComplete(profile);

  const systemPrompt =
    SYSTEM_PROMPTS.design_wizard +
    `\n\n## Current profile state\n${JSON.stringify(profile, null, 2)}` +
    `\n\nProfile complete: ${profileComplete}` +
    (projectedBuild
      ? `\n\nProjected build so far:\n${JSON.stringify(projectedBuild, null, 2)}`
      : "");

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages: cleanMessages.map((m) => ({ role: m.role, content: m.content })),
    maxOutputTokens: 2000,
  });

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
