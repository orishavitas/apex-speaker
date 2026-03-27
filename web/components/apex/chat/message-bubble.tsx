"use client";

import type { AgentDomain } from "@/lib/agents/types";
import { DomainBadge } from "./domain-badge";

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  domain?: AgentDomain;
  isStreaming?: boolean;
}

export function MessageBubble({ role, content, domain, isStreaming }: MessageBubbleProps) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-lg bg-zinc-800 border border-zinc-700 px-4 py-3">
          <p className="text-sm text-zinc-100 whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 px-1">
        {domain && <DomainBadge domain={domain} size="sm" />}
        <span className="text-[10px] font-mono text-zinc-600">APEX</span>
      </div>
      <div className="max-w-[90%] rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3">
        <div className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
          {content}
          {isStreaming && (
            <span className="inline-block ml-0.5 w-1.5 h-3.5 bg-blue-400 animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </div>
  );
}
