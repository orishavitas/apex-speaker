import Link from "next/link";
import { AgentBadge, type AgentDomain } from "./agent-badge";

const AGENTS: AgentDomain[] = [
  "manager", "acoustics", "enclosure", "crossover", "theory", "mechanical", "research"
];

export function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-zinc-800">
        <div className="font-mono text-xl font-bold tracking-wider text-white">
          APEX
        </div>
        <div className="text-xs text-zinc-500 mt-0.5 font-mono">
          Speaker Design Intelligence
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest px-3 pb-2">
          Workspace
        </div>
        <Link href="/dashboard" className="flex items-center gap-2 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm transition-colors">
          <span className="font-mono text-zinc-500">◈</span> Dashboard
        </Link>
        <Link href="/dashboard/chat" className="flex items-center gap-2 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm transition-colors">
          <span className="font-mono text-zinc-500">⬡</span> Chat
        </Link>
        <Link href="/knowledge" className="flex items-center gap-2 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm transition-colors">
          <span className="font-mono text-zinc-500">⊕</span> Knowledge Base
        </Link>
        <Link href="/sources" className="flex items-center gap-2 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm transition-colors">
          <span className="font-mono text-zinc-500">⊞</span> Sources
        </Link>
        <a
          href="https://notebooklm.google.com/notebook/59cf7942-cf9f-459e-9b3c-46b0702f026c"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 rounded text-zinc-300 hover:bg-zinc-800 hover:text-white text-sm transition-colors"
        >
          <span className="font-mono text-zinc-500">◉</span> NotebookLM
          <span className="ml-auto text-zinc-600 text-xs">↗</span>
        </a>

        <div className="text-xs font-mono text-zinc-500 uppercase tracking-widest px-3 pb-2 pt-4">
          Agents
        </div>
        {AGENTS.map((domain) => (
          <div key={domain} className="px-3 py-1.5">
            <AgentBadge domain={domain} size="sm" />
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-zinc-800 text-xs font-mono text-zinc-600">
        v0.4.0 — Phase 4
      </div>
    </aside>
  );
}
