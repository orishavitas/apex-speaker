// POST /api/agents/manager
// Project Manager agent — keyword-routes queries to specialist domains, streams response.

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { streamText } from "ai";
import { SYSTEM_PROMPTS } from "@/lib/agents/system-prompts";
import { readMemory, formatMemory } from "@/lib/agents/memory";
import type { AgentDomain, AgentChatRequest, ChatMessage } from "@/lib/agents/types";

// Keyword-based domain classifier (Phase 4 upgrades to LLM-based routing)
const DOMAIN_KEYWORDS: Record<Exclude<AgentDomain, "manager" | "design_wizard">, string[]> = {
  // vituixcad is listed first so it wins ties when keywords overlap (e.g. "group delay" in a sim context)
  vituixcad: ["vituixcad", "vituixCAD", "simulation file", "vxp", "vxd", "vxb", "crossover simulation", "loaded project", "parsed project", "simulation data", "port velocity", "group delay", "baffle step"],
  acoustics: ["frequency", "spl", "sensitivity", "waveguide", "horn", "directivity", "dispersion", "thiele", "small", "fs", "qts", "vas", "xmax", "response", "polar", "cardioid"],
  enclosure: ["box", "volume", "port", "ported", "sealed", "isobaric", "passive radiator", "pr", "net volume", "liters", "tuning", "enclosure", "cabinet", "alignment", "winisd"],
  crossover: ["crossover", "filter", "linkwitz", "butterworth", "capacitor", "inductor", "zobel", "notch", "dsp", "minidsp", "active filter", "slope"],
  theory: ["equation", "impedance", "circuit", "analog", "beranek", "physics", "math", "derivation", "schroeder", "room mode", "standing wave", "fft"],
  mechanical: ["material", "mdf", "plywood", "joint", "cnc", "solidworks", "3d print", "brace", "damping", "foam", "bitumen", "veneer", "finish", "construction"],
  research: ["recommend", "driver", "find", "which", "best", "compare", "forum", "diyaudio", "parts express", "scanspeak", "seas", "amplifier", "notebooklm"],
};

function classifyDomain(query: string): Exclude<AgentDomain, "manager" | "design_wizard"> {
  const lower = query.toLowerCase();
  const scores = {} as Record<Exclude<AgentDomain, "manager" | "design_wizard">, number>;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS) as [Exclude<AgentDomain, "manager" | "design_wizard">, string[]][]) {
    scores[domain] = keywords.filter((kw) => lower.includes(kw)).length;
  }

  const ranked = (Object.entries(scores) as [Exclude<AgentDomain, "manager" | "design_wizard">, number][])
    .sort(([, a], [, b]) => b - a);

  return ranked[0][1] > 0 ? ranked[0][0] : "research";
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

  const lastUserMessage = messages.filter((m: ChatMessage) => m.role === "user").at(-1);
  const query = lastUserMessage?.content ?? "";

  // Explicit wizard trigger — starter prompt injects this sentinel token
  // Body was already consumed above, so reconstruct a new Request with the parsed body
  if (query.includes("__WIZARD_TRIGGER__")) {
    const { POST: wizardPost } = await import("../design-wizard/route");
    const clonedReq = new NextRequest(req.url, {
      method: req.method,
      headers: req.headers,
      body: JSON.stringify(body),
    });
    return wizardPost(clonedReq);
  }

  const routedDomain = classifyDomain(query);

  let systemPrompt = SYSTEM_PROMPTS.manager;

  systemPrompt += `\n\n## Routing Decision\nThis query is primarily a **${routedDomain}** domain question.\nDelegate the technical content to the ${routedDomain} specialist.\nIn your response, prefix specialist content with: "**[${routedDomain.toUpperCase()} SPECIALIST]:**"`;

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
    model: "anthropic/claude-sonnet-4.6",
    system: systemPrompt,
    messages: messages.map((m: ChatMessage) => ({
      role: m.role,
      content: m.content,
    })),
    maxOutputTokens: 2000,
  });

  const response = result.toUIMessageStreamResponse();
  const headers = new Headers(response.headers);
  headers.set("X-Routed-Domain", routedDomain);

  return new Response(response.body, { status: response.status, headers });
}
