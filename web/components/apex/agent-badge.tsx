import { cn } from "@/lib/utils";

export type AgentDomain =
  | "acoustics"
  | "enclosure"
  | "crossover"
  | "theory"
  | "mechanical"
  | "research"
  | "manager";

const AGENT_CONFIG: Record<AgentDomain, { label: string; color: string; icon: string }> = {
  manager:    { label: "Project Manager", color: "border-white/40 text-white",        icon: "◈" },
  acoustics:  { label: "Acoustics",       color: "border-blue-400 text-blue-400",     icon: "🔊" },
  enclosure:  { label: "Enclosure",       color: "border-green-400 text-green-400",   icon: "📦" },
  crossover:  { label: "Crossover",       color: "border-amber-400 text-amber-400",   icon: "⚡" },
  theory:     { label: "Theory",          color: "border-violet-400 text-violet-400", icon: "🔬" },
  mechanical: { label: "Mechanical",      color: "border-slate-400 text-slate-400",   icon: "⚙️" },
  research:   { label: "Research",        color: "border-cyan-400 text-cyan-400",     icon: "🌐" },
};

interface AgentBadgeProps {
  domain: AgentDomain;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function AgentBadge({ domain, size = "md", showLabel = true, className }: AgentBadgeProps) {
  const config = AGENT_CONFIG[domain];
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-sm px-3 py-1 gap-1.5",
    lg: "text-base px-4 py-2 gap-2",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded border font-mono font-medium",
        config.color,
        sizeClasses[size],
        className
      )}
    >
      <span>{config.icon}</span>
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
