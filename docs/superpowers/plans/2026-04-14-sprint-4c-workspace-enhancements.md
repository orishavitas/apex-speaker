# Sprint 4-C: Workspace Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the workspace Col 3 chat to a real agent, persist horn dimension inputs, and show all 6 public wizard signals in the WizardPane.

**Architecture:** All changes are in two files: `wizard-pane.tsx` (signal rows) and `workspace/page.tsx` (chat wiring + horn persistence). No new files, no new API routes, no DB migrations. WorkspaceChat gets a real `useChat` hook with `DefaultChatTransport` → `/api/agents/manager`. HornLoadingPanel gains `hornConfig`/`onHornChange` props so values flow through `onWayChange` into the existing `useDesignStatePersistence` debounce.

**Tech Stack:** Next.js 16, AI SDK v6 (`useChat`, `DefaultChatTransport`, `Chat` from `@ai-sdk/react`), shadcn/ui zinc dark, TypeScript

---

## File Map

| File | Change |
|------|--------|
| `web/components/apex/chat/wizard-pane.tsx` | Add `room_size` + `amplifier` to `PublicProfile` interface and render 2 new `PaneRow` entries |
| `web/app/dashboard/workspace/page.tsx` | (1) Extend `HornLoadingPanel` with `hornConfig`/`onHornChange` props, wire all `MonoInput` fields; (2) refactor `WorkspaceChat` to use `useChat` + `MessageBubble` + domain badge |

---

## Task 1: WizardPane — add room_size and amplifier signals

**Files:**
- Modify: `web/components/apex/chat/wizard-pane.tsx`

- [ ] **Step 1: Read the current file**

```bash
cat web/components/apex/chat/wizard-pane.tsx
```

Confirm the `PublicProfile` interface has `budget_low`, `budget_high`, `placement`, `use_case`, `sound_signature` — and is missing `room_size` and `amplifier`.

- [ ] **Step 2: Update `PublicProfile` interface**

In `web/components/apex/chat/wizard-pane.tsx`, replace:

```ts
interface PublicProfile {
  budget_low?: number;
  budget_high?: number;
  placement?: string;
  use_case?: string;
  sound_signature?: string;
}
```

with:

```ts
interface PublicProfile {
  budget_low?: number;
  budget_high?: number;
  placement?: string;
  use_case?: string;
  sound_signature?: string;
  room_size?: string;
  amplifier?: string;
}
```

- [ ] **Step 3: Add the two new PaneRow entries**

Find the block inside `WizardPane` that renders the Profile section. It currently ends with:

```tsx
<PaneRow label="SOUND SIG" value={profile?.sound_signature ?? "···"} />
```

Add immediately after that line:

```tsx
<PaneRow label="ROOM SIZE" value={profile?.room_size ?? "···"} />
<PaneRow label="AMPLIFIER" value={profile?.amplifier ?? "···"} />
```

- [ ] **Step 4: Build check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/components/apex/chat/wizard-pane.tsx
git commit -m "feat(wizard): show room_size and amplifier in WizardPane (6 public signals)"
```

---

## Task 2: Horn dimension persistence — extend HornLoadingPanel

**Files:**
- Modify: `web/app/dashboard/workspace/page.tsx` (HornLoadingPanel function + WayCard wiring)

- [ ] **Step 1: Read the current HornLoadingPanel and WayCard**

```bash
sed -n '75,135p' web/app/dashboard/workspace/page.tsx
sed -n '276,440p' web/app/dashboard/workspace/page.tsx
```

Confirm `MonoInput` fields have no `value` or `onChange` props, and `HornLoadingPanel` has no `hornConfig`/`onHornChange` props.

- [ ] **Step 2: Extend HornLoadingPanel signature**

Replace the current `HornLoadingPanel` function signature:

```tsx
function HornLoadingPanel({
  variant,
  onChange,
}: {
  variant: LoadingVariant;
  onChange: (v: LoadingVariant) => void;
}) {
```

with:

```tsx
function HornLoadingPanel({
  variant,
  onChange,
  hornConfig = {},
  onHornChange,
}: {
  variant: LoadingVariant;
  onChange: (v: LoadingVariant) => void;
  hornConfig?: Record<string, number>;
  onHornChange?: (key: string, value: number) => void;
}) {
```

- [ ] **Step 3: Wire MonoInput fields — horn profiles**

Find the `{isHorn && (` block. Replace all six `<MonoInput ... />` with wired versions:

```tsx
{isHorn && (
  <div className="border-t border-zinc-800 pt-2 space-y-0">
    <MonoInput label="throat ⌀" unit="mm" value={hornConfig['throat_mm']} onChange={v => onHornChange?.('throat_mm', v)} />
    <MonoInput label="mouth ⌀"  unit="mm" value={hornConfig['mouth_mm']}  onChange={v => onHornChange?.('mouth_mm', v)} />
    <MonoInput label="length"   unit="mm" value={hornConfig['length_mm']} onChange={v => onHornChange?.('length_mm', v)} />
    <MonoInput label="cutoff Fc" unit="Hz" value={hornConfig['cutoff_hz']} onChange={v => onHornChange?.('cutoff_hz', v)} />
    <MonoInput label="coverage H" unit="°" value={hornConfig['coverage_h_deg']} onChange={v => onHornChange?.('coverage_h_deg', v)} />
    <MonoInput label="coverage V" unit="°" value={hornConfig['coverage_v_deg']} onChange={v => onHornChange?.('coverage_v_deg', v)} />
  </div>
)}
```

- [ ] **Step 4: Wire MonoInput fields — waveguide**

Replace the `{isWG && (` block:

```tsx
{isWG && (
  <div className="border-t border-zinc-800 pt-2 space-y-0">
    <MonoInput label="coverage H" unit="°"  value={hornConfig['coverage_h_deg']} onChange={v => onHornChange?.('coverage_h_deg', v)} />
    <MonoInput label="coverage V" unit="°"  value={hornConfig['coverage_v_deg']} onChange={v => onHornChange?.('coverage_v_deg', v)} />
    <MonoInput label="throat ⌀"  unit="mm" value={hornConfig['throat_mm']}       onChange={v => onHornChange?.('throat_mm', v)} />
    <MonoInput label="depth"     unit="mm" value={hornConfig['depth_mm']}         onChange={v => onHornChange?.('depth_mm', v)} />
  </div>
)}
```

- [ ] **Step 5: Wire MonoInput fields — transmission line**

Replace the `{isTL && (` block:

```tsx
{isTL && (
  <div className="border-t border-zinc-800 pt-2 space-y-0">
    <MonoInput label="length"   unit="mm"    value={hornConfig['length_mm']}            onChange={v => onHornChange?.('length_mm', v)} />
    <MonoInput label="line ⌀"   unit="mm"    value={hornConfig['line_diameter_mm']}     onChange={v => onHornChange?.('line_diameter_mm', v)} />
    <MonoInput label="stuffing" unit="kg/m³" value={hornConfig['stuffing_density']}     onChange={v => onHornChange?.('stuffing_density', v)} />
  </div>
)}
```

- [ ] **Step 6: Wire HornLoadingPanel in WayCard**

Find the `<HornLoadingPanel` usage in `WayCard` (around line 429). It currently reads:

```tsx
<HornLoadingPanel
  variant={loadingVariant}
  onChange={(v) => {
    setLoadingVariant(v);
    onWayChange?.(index, { loading: { variant: v } as WaySlot['loading'] });
  }}
/>
```

Replace with:

```tsx
<HornLoadingPanel
  variant={loadingVariant}
  hornConfig={slot.loading as unknown as Record<string, number>}
  onChange={(v) => {
    setLoadingVariant(v);
    onWayChange?.(index, { loading: { ...slot.loading, variant: v } as WaySlot['loading'] });
  }}
  onHornChange={(key, value) => {
    onWayChange?.(index, { loading: { ...slot.loading, [key]: value } as WaySlot['loading'] });
  }}
/>
```

- [ ] **Step 7: Fix HornResults diameter→area conversion**

Find `HornResults` function. It currently reads `hornConfig.mouth_area_cm2` and `hornConfig.throat_area_cm2` directly. The new storage uses `mouth_mm` and `throat_mm` (diameter in mm). Replace the area-check block:

```tsx
const hornConfig = loading as { variant: HornProfile; mouth_area_cm2?: number; throat_area_cm2?: number };
if (!hornConfig.mouth_area_cm2 || !hornConfig.throat_area_cm2) {
  return (
    <div className="mt-3 border border-zinc-800/60 rounded p-2 bg-zinc-900/40">
      <div className="font-mono text-xs text-violet-400 mb-1">Horn Analysis</div>
      <div className="font-mono text-xs text-zinc-600">Enter throat + mouth dimensions to calculate</div>
    </div>
  );
}

const res: HornResult = calcHornLoading(ts, {
  variant: hornConfig.variant as HornProfile,
  throat_area_cm2: hornConfig.throat_area_cm2,
  mouth_area_cm2: hornConfig.mouth_area_cm2,
  length_mm: (hornConfig as { length_mm?: number }).length_mm ?? 300,
  cutoff_hz: (hornConfig as { cutoff_hz?: number }).cutoff_hz ?? 0,
  coverage_h_deg: (hornConfig as { coverage_h_deg?: number }).coverage_h_deg ?? 90,
  coverage_v_deg: (hornConfig as { coverage_v_deg?: number }).coverage_v_deg ?? 60,
});
```

with:

```tsx
// Fields stored as diameter (mm); convert to area (cm²) for math engine
const dims = loading as Record<string, unknown>;
const throatMm = typeof dims['throat_mm'] === 'number' ? dims['throat_mm'] as number : null;
const mouthMm  = typeof dims['mouth_mm']  === 'number' ? dims['mouth_mm']  as number : null;

if (!throatMm || !mouthMm) {
  return (
    <div className="mt-3 border border-zinc-800/60 rounded p-2 bg-zinc-900/40">
      <div className="font-mono text-xs text-violet-400 mb-1">Horn Analysis</div>
      <div className="font-mono text-xs text-zinc-600">Enter throat + mouth dimensions to calculate</div>
    </div>
  );
}

// diameter mm → radius cm → area cm²
const throatAreaCm2 = Math.PI * Math.pow(throatMm / 20, 2);
const mouthAreaCm2  = Math.PI * Math.pow(mouthMm  / 20, 2);

const variant = (loading as { variant: HornProfile }).variant;
const res: HornResult = calcHornLoading(ts, {
  variant,
  throat_area_cm2: throatAreaCm2,
  mouth_area_cm2:  mouthAreaCm2,
  length_mm:       typeof dims['length_mm']      === 'number' ? dims['length_mm']      as number : 300,
  cutoff_hz:       typeof dims['cutoff_hz']       === 'number' ? dims['cutoff_hz']       as number : 0,
  coverage_h_deg:  typeof dims['coverage_h_deg']  === 'number' ? dims['coverage_h_deg']  as number : 90,
  coverage_v_deg:  typeof dims['coverage_v_deg']  === 'number' ? dims['coverage_v_deg']  as number : 60,
});
```

- [ ] **Step 8: Build check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add web/app/dashboard/workspace/page.tsx
git commit -m "feat(workspace): persist horn dimension inputs through onWayChange"
```

---

## Task 3: Workspace Chat — wire Col 3 to real agent

**Files:**
- Modify: `web/app/dashboard/workspace/page.tsx` (WorkspaceChat function + import block)

- [ ] **Step 1: Check existing imports in workspace/page.tsx**

```bash
head -25 web/app/dashboard/workspace/page.tsx
```

Note which AI SDK imports are already present. We need to add: `useChat`, `Chat`, `DefaultChatTransport`, `useMemo`, `useRef`, `useCallback`. Check if `useState` and `useEffect` are already imported.

- [ ] **Step 2: Add missing imports**

At the top of `web/app/dashboard/workspace/page.tsx`, add these imports after the existing ones:

```tsx
import { useChat } from '@ai-sdk/react';
import { Chat, DefaultChatTransport } from 'ai';
import { useMemo, useRef, useCallback } from 'react';
import { MessageBubble } from '@/components/apex/chat/message-bubble';
import type { AgentDomain } from '@/lib/agents/types';
```

Note: `useState`, `useEffect`, `Suspense` are already imported — do not duplicate them.

- [ ] **Step 3: Replace WorkspaceChat stub with wired implementation**

Find and replace the entire `WorkspaceChat` function (lines ~22–39):

```tsx
function WorkspaceChat({ domain }: { domain: string }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        <div className="text-xs font-mono text-zinc-500 text-center pt-8">
          Ask the {domain} agent about your design...
        </div>
      </div>
      <div className="p-3 border-t border-zinc-800">
        <input
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 outline-none focus:border-zinc-500"
          placeholder="ask about this design..."
        />
      </div>
    </div>
  );
}
```

Replace with:

```tsx
function WorkspaceChat({ domain: _domain }: { domain: string }) {
  const [routedDomain, setRoutedDomain] = useState<AgentDomain>('manager');
  const [inputValue, setInputValue] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const chat = useMemo(
    () =>
      new Chat({
        transport: new DefaultChatTransport({
          api: '/api/agents/manager',
          fetch: async (url, init) => {
            const response = await globalThis.fetch(url, init);
            const domain = response.headers.get('X-Routed-Domain') as AgentDomain | null;
            if (domain) setRoutedDomain(domain);
            return response;
          },
        }),
      }),
    []
  );

  const { messages, sendMessage, status } = useChat({ chat });
  const isStreaming = status === 'streaming' || status === 'submitted';

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && inputValue.trim() && !isStreaming) {
        e.preventDefault();
        sendMessage({ text: inputValue.trim() });
        setInputValue('');
      }
    },
    [inputValue, isStreaming, sendMessage]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-xs font-mono text-zinc-600 text-center pt-8">
            ask the agent about your design...
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            domain={msg.role === 'assistant' ? routedDomain : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="p-3 border-t border-zinc-800">
        <input
          className={`w-full bg-zinc-900 border rounded px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 outline-none transition-colors ${
            isStreaming
              ? 'border-zinc-800 text-zinc-600 cursor-not-allowed'
              : 'border-zinc-700 focus:border-zinc-500'
          }`}
          placeholder={isStreaming ? 'responding...' : 'ask about this design...'}
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Check MessageBubble props signature**

```bash
head -40 web/components/apex/chat/message-bubble.tsx
```

Confirm `MessageBubble` accepts `message` and `domain` props. If `domain` prop name differs, adjust the call in Step 3 accordingly.

- [ ] **Step 5: Build check**

```bash
cd web && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors. Common fix needed: if `Chat` import conflicts, try `import { Chat } from '@ai-sdk/react'` instead of `'ai'` — check main chat page for the correct import source:

```bash
head -10 web/app/dashboard/chat/page.tsx
```

- [ ] **Step 6: Dev server smoke-test**

```bash
cd web && npm run dev 2>&1 &
sleep 8
curl -s http://localhost:3000/dashboard/workspace | grep -c "workspace" || echo "page loaded"
```

Expected: page loads without 500. Then manually verify in browser (or Playwright snapshot if available) that Col 3 has an input, typing works, Enter sends a message.

- [ ] **Step 7: Commit**

```bash
git add web/app/dashboard/workspace/page.tsx
git commit -m "feat(workspace): wire Col 3 chat to agent via useChat + DefaultChatTransport"
```

---

## Task 4: Final verification + push

- [ ] **Step 1: Full TypeScript build**

```bash
cd web && npx tsc --noEmit 2>&1
```

Expected: zero errors.

- [ ] **Step 2: Verify no regressions in existing tests**

```bash
cd web && npm test 2>&1 | tail -20
```

Expected: 26 passing (parseSignalsFromMessages Vitest suite). No failures.

- [ ] **Step 3: Push to origin**

```bash
git push origin master
```

Expected: fast-forward push, Vercel auto-deploy triggered.

- [ ] **Step 4: Update TODO.md**

Add to TODO.md under Sprint 4-C:

```markdown
## Sprint 4-C — COMPLETE (2026-04-14)
- [x] WizardPane: room_size + amplifier signals (6 rows visible)
- [x] Horn dimension persistence: all MonoInput fields wired + diameter→area conversion
- [x] WorkspaceChat: real useChat wiring, MessageBubble rendering, domain badge
```

- [ ] **Step 5: Commit quartet update**

```bash
git add TODO.md
git commit -m "docs: Sprint 4-C complete"
git push origin master
```

---

## Done Criteria

- [ ] Workspace Col 3 input accepts text, Enter sends to `/api/agents/manager`, streaming response renders in `MessageBubble`
- [ ] Domain badge updates per response based on `X-Routed-Domain` header
- [ ] Input disabled while streaming, placeholder changes to "responding..."
- [ ] Entering throat/mouth/length in a horn WayCard persists after navigating away and returning
- [ ] `HornResults` panel shows fc/efficiency/mouth_loading when throat_mm and mouth_mm are both set
- [ ] WizardPane renders 6 rows: BUDGET, PLACEMENT, USE CASE, SOUND SIG, ROOM SIZE, AMPLIFIER
- [ ] `npm test` passes (26 tests)
- [ ] `tsc --noEmit` clean
