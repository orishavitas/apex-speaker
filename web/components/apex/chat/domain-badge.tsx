"use client";

import type { AgentDomain } from "@/lib/agents/types";

const DOMAIN_CONFIG: Record<AgentDomain, { label: string; color: string; icon: string }> = {
  manager: { label: "Manager", color: "text-white border-white/30", icon: "◈" },
  acoustics: { label: "Acoustics", color: "text-blue-400 border-blue-400/30", icon: "∿" },
  enclosure: { label: "Enclosure", color: "text-green-400 border-green-400/30", icon: "⬡" },
  crossover: { label: "Crossover", color: "text-amber-400 border-amber-400/30", icon: "⋈" },
  theory: { label: "Theory", color: "text-violet-400 border-violet-400/30", icon: "∂" },
  mechanical: { label: "Mechanical", color: "text-slate-400 border-slate-400/30", icon: "⚙" },
  research: { label: "Research", color: "text-cyan-400 border-cyan-400/30", icon: "◎" },
  vituixcad: { label: "VituixCAD", color: "text-teal-400 border-teal-400/30", icon: "⊞" },
};

interface DomainBadgeProps {
  domain: AgentDomain;
  size?: "sm" | "md";
}

export function DomainBadge({ domain, size = "sm" }: DomainBadgeProps) {
  const config = DOMAIN_CONFIG[domain];
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono ${textSize} ${config.color}`}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
