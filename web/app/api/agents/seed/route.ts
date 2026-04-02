// POST /api/agents/seed — idempotent seed of the agents table.
// Call once after drizzle-kit push to populate agent records.

export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agents } from "@/lib/db/schema";
import { SYSTEM_PROMPTS } from "@/lib/agents/system-prompts";
import type { AgentDomain } from "@/lib/agents/types";

const AGENT_DISPLAY_NAMES: Record<AgentDomain, string> = {
  manager:       "Project Manager",
  acoustics:     "Acoustics Specialist",
  enclosure:     "Enclosure Specialist",
  crossover:     "Crossover Specialist",
  theory:        "Theory Specialist",
  mechanical:    "Mechanical Specialist",
  research:      "Research Specialist",
  vituixcad:     "VituixCAD Specialist",
  design_wizard: "Design Wizard",
};

const DOMAINS: AgentDomain[] = [
  "manager", "acoustics", "enclosure", "crossover",
  "theory", "mechanical", "research", "vituixcad", "design_wizard",
];

export async function POST() {
  try {
    const results = [];

    for (const domain of DOMAINS) {
      const inserted = await db
        .insert(agents)
        .values({
          domain,
          displayName: AGENT_DISPLAY_NAMES[domain],
          systemPrompt: SYSTEM_PROMPTS[domain],
          isActive: true,
        })
        .onConflictDoUpdate({
          target: agents.domain,
          set: {
            displayName: AGENT_DISPLAY_NAMES[domain],
            systemPrompt: SYSTEM_PROMPTS[domain],
            isActive: true,
          },
        })
        .returning();

      results.push(inserted[0]);
    }

    return NextResponse.json({
      seeded: results.length,
      agents: results.map((a) => ({
        id: a.id,
        domain: a.domain,
        displayName: a.displayName,
      })),
    });
  } catch (err) {
    console.error("[agents/seed]", err);
    return NextResponse.json({ error: "Seed failed", detail: String(err) }, { status: 500 });
  }
}
