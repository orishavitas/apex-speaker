"use client";

import { Chat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState, useMemo } from "react";
import { MessageBubble } from "@/components/apex/chat/message-bubble";
import { ChatInput } from "@/components/apex/chat/chat-input";
import { DomainBadge } from "@/components/apex/chat/domain-badge";
import { WizardPane } from "@/components/apex/chat/wizard-pane";
import type { AgentDomain } from "@/lib/agents/types";

const STARTER_PROMPTS = [
  "Help me design a speaker from scratch →",
  "Port diameter for 12L at 45Hz?",
  "RS180 in a sealed vs ported box?",
  "Linkwitz-Riley vs Butterworth crossover",
  "Isobaric push-push configuration",
  "Best waveguide angle for a 1\" tweeter",
];

const WIZARD_PROMPT = "Help me design a speaker from scratch →";

export default function ChatPage() {
  const [routedDomain, setRoutedDomain] = useState<AgentDomain>("manager");
  const [input, setInput] = useState("");
  const [wizardActive, setWizardActive] = useState(false);
  const [wizardProfile, setWizardProfile] = useState<Record<string, unknown> | null>(null);
  const [wizardBuild, setWizardBuild] = useState<Record<string, unknown> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // Ref so the transport fetch closure can read the current wizard state without stale closure
  const wizardActiveRef = useRef(false);
  // Keep ref in sync with state for stale-closure safety in the transport fetch
  useEffect(() => {
    wizardActiveRef.current = wizardActive;
  }, [wizardActive]);

  const chat = useMemo(
    () =>
      new Chat({
        transport: new DefaultChatTransport({
          api: "/api/agents/manager",
          fetch: async (url, init) => {
            // Route to wizard endpoint if wizard is active
            const api = wizardActiveRef.current
              ? "/api/agents/design-wizard"
              : "/api/agents/manager";
            const resolvedUrl = url.toString().replace("/api/agents/manager", api);
            const response = await globalThis.fetch(resolvedUrl, init);
            const domain = response.headers.get("X-Routed-Domain") as AgentDomain | null;
            if (domain) setRoutedDomain(domain);
            const rawProfile = response.headers.get("X-Wizard-Profile");
            const rawBuild = response.headers.get("X-Wizard-Build");
            if (rawProfile) {
              try { setWizardProfile(JSON.parse(rawProfile)); } catch { /* ignore */ }
            }
            if (rawBuild) {
              try { setWizardBuild(JSON.parse(rawBuild)); } catch { /* ignore */ }
            }
            return response;
          },
        }),
      }),
    []
  );

  const { messages, sendMessage, status } = useChat({ chat });
  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function triggerWizard() {
    wizardActiveRef.current = true;
    setWizardActive(true);
    sendMessage({ text: "__WIZARD_TRIGGER__ Help me design a speaker." });
  }

  function handleSubmit() {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    if (text === WIZARD_PROMPT) {
      triggerWizard();
    } else {
      sendMessage({ text });
    }
    setInput("");
  }

  return (
    <div className={`flex h-full ${wizardActive ? "flex-row" : "flex-col"}`}>
      {/* Main chat column */}
      <div className={`flex flex-col ${wizardActive ? "flex-1 min-w-0" : "h-full"}`}>
        {/* Header */}
        <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-zinc-100 font-mono">APEX Chat</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Project Manager routes to specialists</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-600 font-mono">ACTIVE SPECIALIST</span>
            <DomainBadge domain={routedDomain} size="md" />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-4 py-20">
              <div className="text-4xl font-mono text-zinc-700">◈</div>
              <div>
                <p className="text-zinc-400 text-sm font-medium">APEX Speaker Design Intelligence</p>
                <p className="text-zinc-600 text-xs mt-1">
                  Ask about enclosures, crossovers, acoustics, drivers, or your build.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      if (prompt === WIZARD_PROMPT) {
                        triggerWizard();
                      } else {
                        setInput(prompt);
                      }
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors font-mono"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1;
            const isStreaming = isLast && msg.role === "assistant" && isLoading;
            const content = msg.parts
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("");

            return (
              <MessageBubble
                key={msg.id}
                role={msg.role as "user" | "assistant"}
                content={content}
                domain={msg.role === "assistant" ? routedDomain : undefined}
                isStreaming={isStreaming}
              />
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-zinc-800 px-6 py-4 shrink-0">
          <ChatInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
          <p className="text-[10px] text-zinc-700 mt-2 font-mono text-center">
            Enter to send · Shift+Enter for newline · Routed to {routedDomain}
          </p>
        </div>
      </div>

      {/* Wizard right pane */}
      {wizardActive && (
        <div className="w-72 border-l border-zinc-800 bg-zinc-950 shrink-0 flex flex-col">
          <div className="font-mono text-xs text-zinc-500 uppercase tracking-wider px-4 py-3 border-b border-zinc-800 shrink-0">
            Design Profile
          </div>
          <div className="flex-1 overflow-hidden">
            <WizardPane
              profile={wizardProfile as Parameters<typeof WizardPane>[0]["profile"]}
              build={wizardBuild as Parameters<typeof WizardPane>[0]["build"]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
