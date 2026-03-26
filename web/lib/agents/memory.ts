// Read/write per-agent, per-project memory scratchpad.
// Stored in the agent_memory table.
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
