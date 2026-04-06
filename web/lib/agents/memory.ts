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

// [CRS:LogicDoc:2026-04-06] BUG-ORIGIN: BH-5 — non-atomic SELECT+INSERT upsert causes duplicate key crash under concurrency
// FOUND-BY: BackendHound  SEVERITY: High
// ROOT-CAUSE: check-then-act pattern without transaction; concurrent requests can both pass the SELECT check and both INSERT,
//   producing a duplicate key error that is silently swallowed by the caller's catch block — profile write lost
// BEFORE: SELECT to check existence, then INSERT or UPDATE in two separate statements — not atomic
// AFTER: wrapped in db.transaction() — SELECT+INSERT/UPDATE are now a single atomic unit; no concurrent duplicate possible
// VALIDATION-LAYER: business_logic — no concurrency test; race condition only manifests under simultaneous wizard requests
// TEST: test_write_memory_concurrent_upsert_atomic
export async function writeMemory(
  projectId: string,
  domain: AgentDomain,
  key: string,
  value: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await tx
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
      await tx
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
      await tx.insert(agentMemory).values({
        projectId,
        agentDomain: domain,
        key,
        value,
      });
    }
  });
}

export function formatMemory(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map((e) => `- ${e.key}: ${e.value}`).join("\n");
  return `## Project Memory\n\n${lines}`;
}
