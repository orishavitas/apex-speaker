// POST /api/agents/[domain] for all 6 specialist agents.
// Streams a response using AI SDK streamText + RAG context + agent memory.

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { streamText } from "ai";
import { SYSTEM_PROMPTS } from "@/lib/agents/system-prompts";
import { getRAGContext, formatRAGContext } from "@/lib/agents/rag-context";
import { readMemory, formatMemory } from "@/lib/agents/memory";
import type { AgentDomain, AgentChatRequest, ChatMessage } from "@/lib/agents/types";

const VALID_DOMAINS: AgentDomain[] = [
  "acoustics", "enclosure", "crossover", "theory", "mechanical", "research",
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

  const lastUserMessage = messages.filter((m: ChatMessage) => m.role === "user").at(-1);
  const query = lastUserMessage?.content ?? "";

  // Build system prompt with RAG + memory context
  let systemPrompt = SYSTEM_PROMPTS[domain];

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
      console.warn(`[agent/${domain}] RAG context unavailable:`, err);
    }
  }

  const result = streamText({
    model: "anthropic/claude-sonnet-4-6",
    system: systemPrompt,
    messages: messages.map((m: ChatMessage) => ({
      role: m.role,
      content: m.content,
    })),
    maxOutputTokens: 1500,
  });

  return result.toUIMessageStreamResponse();
}
