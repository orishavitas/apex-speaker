import { Sidebar } from "@/components/apex/sidebar";
import { AgentBadge } from "@/components/apex/agent-badge";

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-zinc-950 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b border-zinc-800 px-6 flex items-center justify-between shrink-0">
          <h1 className="font-mono text-sm text-zinc-400">
            — no project selected —
          </h1>
          <AgentBadge domain="manager" size="sm" />
        </header>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 max-w-md">
            <div className="font-mono text-5xl font-bold text-zinc-800 tracking-widest">
              APEX
            </div>
            <p className="text-zinc-500 text-sm font-mono">
              Speaker Design Intelligence Platform
            </p>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {(["acoustics", "enclosure", "crossover", "theory", "mechanical", "research"] as const).map((d) => (
                <AgentBadge key={d} domain={d} size="sm" />
              ))}
            </div>
            <p className="text-zinc-600 text-xs font-mono pt-2">
              Phase 1: Foundation ✓ — Phase 2: Knowledge Pipeline →
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
