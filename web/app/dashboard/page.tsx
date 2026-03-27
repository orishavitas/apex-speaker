import Link from "next/link";
import { AgentBadge } from "@/components/apex/agent-badge";

export default function DashboardPage() {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0">
        <h1 className="font-mono text-sm text-zinc-400">— APEX Speaker Design Intelligence —</h1>
        <AgentBadge domain="manager" size="sm" />
      </header>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center space-y-6 max-w-lg">
          <div className="font-mono text-6xl font-bold text-zinc-800 tracking-widest">APEX</div>
          <p className="text-zinc-500 text-sm font-mono">Speaker Design Intelligence Platform</p>

          <div className="flex flex-wrap gap-2 justify-center pt-1">
            {(["acoustics", "enclosure", "crossover", "theory", "mechanical", "research"] as const).map((d) => (
              <AgentBadge key={d} domain={d} size="sm" />
            ))}
          </div>

          <div className="pt-4">
            <Link
              href="/dashboard/chat"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-mono rounded-lg transition-colors"
            >
              <span>◈</span>
              <span>Open Chat</span>
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2 text-left">
            {PHASE_STATUS.map((phase) => (
              <div key={phase.label} className="border border-zinc-800 rounded-lg px-3 py-2">
                <div className="text-[10px] font-mono text-zinc-600">{phase.label}</div>
                <div className={`text-xs font-mono mt-0.5 ${phase.done ? "text-green-400" : "text-zinc-500"}`}>
                  {phase.done ? "✓ Complete" : "→ Pending"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PHASE_STATUS = [
  { label: "Phase 1: Foundation", done: true },
  { label: "Phase 2: Knowledge Pipeline", done: true },
  { label: "Phase 3: Agents", done: true },
  { label: "Phase 4: UI", done: true },
  { label: "Phase 5: Deployment", done: false },
  { label: "DB: Neon Push", done: false },
];
