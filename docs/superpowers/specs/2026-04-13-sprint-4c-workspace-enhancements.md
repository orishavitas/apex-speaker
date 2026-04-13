# Sprint 4-C: Workspace Enhancements — Design Spec

**Date:** 2026-04-13
**Repo:** apex-speaker
**Status:** Approved — ready for implementation plan

---

## Scope

Three self-contained features, all in the workspace (`/dashboard/workspace`):

1. **Workspace Chat Wiring** — wire Col 3 dead `<input>` to a real `useChat` instance
2. **Horn Dimension Persistence** — wire `HornLoadingPanel` MonoInput fields to `onWayChange`
3. **WizardPane Signal Completeness** — add `room_size` and `amplifier` rows (6 visible signals)

---

## Feature 1: Workspace Chat Wiring

### Problem
`WorkspaceChat` in `workspace/page.tsx:23` is a stub. The `<input>` has no `onChange`, no submit handler, no message state, no fetch — completely dead UI.

### Design

**Transport:** POST to `/api/agents/manager` — same endpoint as main chat. Manager routes by keyword to the right specialist. No custom domain injection needed.

**Component refactor:** `WorkspaceChat` becomes a self-contained client component with its own `useChat` hook from `@ai-sdk/react`. Uses `DefaultChatTransport` pointing at `/api/agents/manager`.

**Message rendering:** Reuse `MessageBubble` from `web/components/apex/chat/message-bubble.tsx`. Domain badge from `X-Routed-Domain` response header (same pattern as main chat — intercept via custom `fetch` in `DefaultChatTransport`).

**Input behavior:** `Enter` submits. `Shift+Enter` newline. Disable input while streaming (same as main chat).

**History:** Full in-memory session history via `useChat` internal state. No DB persistence — conversations table is not written. If user navigates away, history is lost (acceptable).

**Initial placeholder:** Replace the current static "Ask the {domain} agent about your design..." with a one-line empty state shown only when `messages.length === 0`.

**File:** Refactor `WorkspaceChat` in `workspace/page.tsx` in-place. No new file needed — component stays co-located in the workspace page.

### Data flow
```
User types → Enter → useChat.sendMessage({text}) 
  → DefaultChatTransport → POST /api/agents/manager
  → manager keywords route → specialist agent streams response
  → X-Routed-Domain header captured → domain badge updated
  → MessageBubble renders each part
```

### Error handling
- Network failure: show inline error text below last message ("connection failed — try again")
- No graceful degradation needed beyond what `useChat` already provides

---

## Feature 2: Horn Dimension Persistence

### Problem
`HornLoadingPanel` renders `MonoInput` fields for throat/mouth/length/etc but passes no `value` and no `onChange` — fields are visually present but never read or written. Values disappear on re-render. `HornResults` reads `hornConfig.mouth_area_cm2` and `hornConfig.throat_area_cm2` from `slot.loading` — these are always undefined because nothing writes them.

### Design

**`HornLoadingPanel` signature extension:**
Add `hornConfig` and `onHornChange` props:
```ts
function HornLoadingPanel({
  variant,
  onChange,
  hornConfig,
  onHornChange,
}: {
  variant: LoadingVariant;
  onChange: (v: LoadingVariant) => void;
  hornConfig?: Record<string, number>;
  onHornChange?: (key: string, value: number) => void;
})
```

**Field mapping by variant:**

| Variant | Fields |
|---------|--------|
| Horn profiles (tractrix/exponential/conical/oblate_spheroidal/le_cleach) | throat_mm, mouth_mm, length_mm, cutoff_hz, coverage_h_deg, coverage_v_deg |
| waveguide | coverage_h_deg, coverage_v_deg, throat_mm, depth_mm |
| transmission_line | length_mm, line_diameter_mm, stuffing_density |

**Storage:** Dimension fields stored on `slot.loading` as flat keys alongside `variant`. `onWayChange(index, { loading: { variant, ...dims } })` — persisted via existing `useDesignStatePersistence` 800ms debounce. No schema migration needed — design_state JSONB absorbs new fields automatically.

**`HornResults` fix:** `HornResults` currently reads `hornConfig.mouth_area_cm2` and `hornConfig.throat_area_cm2`. The math engine (`calcHornLoading`) takes `throat_area_cm2` and `mouth_area_cm2`. Fields stored as `throat_mm` / `mouth_mm` (diameter in mm) — convert to area via `π(d/2)²` in `HornResults` before passing to `calcHornLoading`.

**`WayCard` wiring:** Extract current loading dims from `slot.loading`, pass as `hornConfig` to `HornLoadingPanel`. On `onHornChange`, call `onWayChange(index, { loading: { variant: loadingVariant, ...updatedDims } })`.

---

## Feature 3: WizardPane Signal Completeness

### Problem
`WizardPane` (`web/components/apex/chat/wizard-pane.tsx`) shows 4 signals: budget, placement, use_case, sound_signature. `WizardProfile` has 7 fields — `room_size` and `amplifier` are captured by the wizard but never surfaced in the pane. `experience_level` is internal and stays hidden.

### Design

**`PublicProfile` interface update** (local to wizard-pane.tsx):
```ts
interface PublicProfile {
  budget_low?: number;
  budget_high?: number;
  placement?: string;
  use_case?: string;
  sound_signature?: string;
  room_size?: string;     // ADD
  amplifier?: string;     // ADD
}
```

**New rows added to the Profile section:**
```
ROOM SIZE   [value or ···]
AMPLIFIER   [value or ···]
```

Placed after `SOUND SIG`, before the projected build divider.

**No other changes** — `WizardPaneProps` already accepts `profile: PublicProfile | null`. The chat page already parses the full profile from `X-Wizard-Profile` header and passes it down — the new fields will flow through automatically once the interface includes them.

---

## Implementation Order

| # | Task | File(s) | Effort |
|---|------|---------|--------|
| 1 | WizardPane: add room_size + amplifier rows | `wizard-pane.tsx` | 15 min |
| 2 | Horn dimension persistence: extend HornLoadingPanel props + wire MonoInputs | `workspace/page.tsx` | 45 min |
| 3 | HornResults: convert diameter→area before calcHornLoading | `workspace/page.tsx` | 15 min |
| 4 | WorkspaceChat: full useChat wiring + MessageBubble rendering | `workspace/page.tsx` | 90 min |

Total estimate: ~2.5 hrs for a focused coder agent.

---

## Files Modified

- `web/components/apex/chat/wizard-pane.tsx` — add room_size + amplifier rows
- `web/app/dashboard/workspace/page.tsx` — WorkspaceChat wiring + HornLoadingPanel persistence

No new files. No schema migrations. No new API routes.

---

## Done Criteria

- [ ] Typing in workspace Col 3 input and pressing Enter sends a message and receives a streaming response
- [ ] Domain badge appears per-response in workspace chat
- [ ] Entering throat/mouth/length values in a horn WayCard persists after re-render and page reload
- [ ] HornResults panel shows fc/efficiency/mouth_loading when dimensions are filled
- [ ] WizardPane shows 6 rows: budget, placement, use_case, sound_sig, room_size, amplifier
- [ ] All existing workspace functionality unchanged (persistence, math results, driver assignment)
