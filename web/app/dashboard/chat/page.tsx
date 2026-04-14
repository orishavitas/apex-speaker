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
// [CRS:StyleClean:2026-04-06] BUG-ORIGIN: WizardProfile typed as Record<string,unknown> — TypeScript safety bypassed with 'as' casts
// FOUND-BY: QualityHound  SEVERITY: Low
// ROOT-CAUSE: useState<Record<string, unknown> | null> used instead of the actual WizardProfile type
// BEFORE: useState<Record<string, unknown> | null>(null) + 'as' casts on WizardPane props
// AFTER: useState<WizardProfile | null>(null), WizardPane props passed directly without 'as' casts
// VALIDATION-LAYER: business_logic — no type enforcement on the profile parse boundary
// TEST: test_wizard_profile_typed_correctly
import type { WizardProfile } from "@/lib/agents/wizard-profile";

// [CRS:StyleClean:2026-04-06] BUG-ORIGIN: STARTER_PROMPTS[0] duplicated WIZARD_PROMPT as a string literal
// FOUND-BY: QualityHound  SEVERITY: Low
// ROOT-CAUSE: String literal in STARTER_PROMPTS array independent of WIZARD_PROMPT — could silently diverge
// BEFORE: "Help me design a speaker from scratch →" (inline string)
// AFTER: WIZARD_PROMPT reference — single source of truth
// VALIDATION-LAYER: business_logic — no static check enforcing both values stay in sync
// TEST: test_starter_prompt_wizard_triggers_wizard_flow
const WIZARD_PROMPT = "Help me design a speaker from scratch →";

const STARTER_PROMPTS = [
  WIZARD_PROMPT,
  "Port diameter for 12L at 45Hz?",
  "RS180 in a sealed vs ported box?",
  "Linkwitz-Riley vs Butterworth crossover",
  "Isobaric push-push configuration",
  "Best waveguide angle for a 1\" tweeter",
];

export default function ChatPage() {
  // [CRS:LogicDoc:2026-04-06] BUG-ORIGIN: scalar routedDomain state causes all historical assistant bubbles to show the latest domain badge
  // FOUND-BY: CodeReviewSwarm  SEVERITY: Medium
  // ROOT-CAUSE: routedDomain is a single scalar value updated on every response. All MessageBubble renders read from this
  //   same scalar, so every historical assistant message shows the domain of the most recent response.
  // IDEAL FIX: Use Map<messageId, domain> state. In the fetch closure, capture a stable message identifier and store
  //   the domain keyed by that ID. When rendering, look up domain from the map using msg.id.
  // WHY DEFERRED: The AI SDK fetch closure fires during streaming — before the SDK has assigned a final msg.id to the
  //   completed assistant message. There is no reliable per-message identifier available at fetch time that can be
  //   correlated back to msg.id after streaming completes. Implementing this correctly requires either:
  //     (a) a response header from the server carrying the message ID (server-side change required), or
  //     (b) tracking message count/sequence and correlating by insertion order (fragile under retries/errors).
  //   Neither approach is safe to add without a coordinated server-side change. Deferred to Wizard v3 / Sprint 4.
  //   Track under FE-4 in the code review swarm output.
  const [routedDomain, setRoutedDomain] = useState<AgentDomain>("manager");
  const [input, setInput] = useState("");
  const [wizardActive, setWizardActive] = useState(false);
  // QH-10: typed as WizardProfile (imported above) — removes need for 'as' casts on WizardPane props
  const [wizardProfile, setWizardProfile] = useState<WizardProfile | null>(null);
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
            // Pass `api` directly — URL rewrite via string replace is fragile against absolute URLs
            const response = await globalThis.fetch(api, init);
            const domain = response.headers.get("X-Routed-Domain") as AgentDomain | null;
            if (domain) setRoutedDomain(domain);
            const rawProfile = response.headers.get("X-Wizard-Profile");
            const rawBuild = response.headers.get("X-Wizard-Build");
            // [CRS:LogicDoc:2026-04-06] BUG-ORIGIN: Silent JSON.parse failure leaves WizardPane blank with no debug signal
            // FOUND-BY: CodeReviewSwarm  SEVERITY: Medium
            // ROOT-CAUSE: catch block discarded the error and raw header value, making it impossible to diagnose malformed JSON
            // BEFORE: try { setWizardProfile(JSON.parse(rawProfile)); } catch { /* ignore */ }
            // AFTER: catch logs console.warn with the raw header value so the failure is diagnosable
            // VALIDATION-LAYER: debug — no logging at the parse boundary
            // TEST: test_wizard_profile_parse_failure_warns_with_raw_value
            if (rawProfile) {
              try { setWizardProfile(JSON.parse(rawProfile)); } catch { console.warn("[APEX] Failed to parse X-Wizard-Profile header:", rawProfile); }
            }
            if (rawBuild) {
              try { setWizardBuild(JSON.parse(rawBuild)); } catch { console.warn("[APEX] Failed to parse X-Wizard-Build header:", rawBuild); }
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
    // [CRS:LogicDoc:2026-04-06] BUG-ORIGIN: stale closure in transport fetch could miss wizardActive=true if only relying on useEffect sync
    // FOUND-BY: CodeReviewSwarm  SEVERITY: Low
    // ROOT-CAUSE: sendMessage() fires synchronously within the same tick as triggerWizard(). The useEffect that syncs
    //   wizardActive → wizardActiveRef runs asynchronously AFTER React re-renders, which happens AFTER the current
    //   call stack completes. If sendMessage triggers a fetch immediately in the same tick (before the re-render cycle),
    //   the transport closure would read wizardActiveRef.current === false from the stale ref. The eager manual set here
    //   ensures the ref is true before sendMessage is called, regardless of when React schedules the re-render.
    // BEFORE: only useEffect synced the ref
    // AFTER: eager-set ref here, useEffect remains as a safety net for other state-driven changes
    // VALIDATION-LAYER: business_logic — async React render cycle not accounted for in transport closure design
    // TEST: test_wizard_active_ref_set_before_send_message
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
              profile={wizardProfile}
              build={wizardBuild as Parameters<typeof WizardPane>[0]["build"]}
            />
          </div>
        </div>
      )}
    </div>
  );
}
