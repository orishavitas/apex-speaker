# Sprint 2 — Workspace Hardening

**Date:** 2026-03-30
**Sprint duration:** 1 session (~4–5h wall-clock with parallel subagents)
**Branch:** `feature/workspace-hardening-sprint-2`
**Synthesized by:** Meta-Orchestrator from 4 specialist agent debate positions
**Depends on:** Sprint 1 (`feature/vituixcad-sprint-1`) — must be merged first

---

## 1. Sprint Summary

Sprint 2 closes the gap between the static workspace scaffold delivered in Sprint 1 and a live, persistent design tool. The workspace will load a real design state from the database on mount, save every user change back via debounced PATCH, and show a save indicator so the designer always knows their work is safe. A "Load into workspace" button on the project detail page bridges the projects list to the workspace via a URL query parameter. Driver data from `.vxd` uploads is imported inline during the upload flow — no new routes needed. Two parser bugs (NaN coercion in `mapThieleSmall`, missing PARAM array guard on individual drivers) are fixed as part of this sprint. No schema migrations are required.

---

## 2. Architecture Decisions

All contested points from the four-agent debate, with final rulings:

### 2.1 Singleton `WORKSPACE_PROJECT_ID`

The `design_state` table uses a `project_id` FK to `projects`. The workspace operates on one well-known project. Rather than requiring a `projects` row to pre-exist, the GET endpoint auto-creates both the `projects` row and the `design_state` row on first call using a stable UUID constant defined in TypeScript.

**Constant:** `WORKSPACE_PROJECT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'`

This value is hardcoded in `web/lib/constants/workspace.ts` and used by both the API route and the client hook. The GET endpoint upserts the `projects` row with `onConflictDoNothing()` before upserting `design_state`, so cold-start is safe.

### 2.2 Debounce Timing: 800ms

Schema Architect proposed 1200ms; Sprint Planner proposed 300–500ms. **Decision: 800ms.** Radio button clicks (topology changes, enclosure type, loading type) can arrive in rapid succession; 800ms batches a deliberate UI gesture without making the save indicator feel sluggish. This is the debounce window applied in `useDesignStatePersistence`.

### 2.3 WayCard Stays Inline

UI/UX Architect proposed extracting `WayCard` to `web/components/apex/workspace/way-card.tsx`. Sprint Planner preferred keeping it inline. **Decision: keep `WayCard` inline in `web/app/dashboard/workspace/page.tsx`.** The workspace page is already `'use client'` and the component is tightly coupled to the page's state shape. Extraction adds file churn with no architectural benefit this sprint. Revisit in Sprint 3 if the page grows further.

### 2.4 No Schema Migration

No new columns, tables, or enums are added in Sprint 2. `vxd_source_id UUID` on `driver_database` is deferred to Sprint 3. The `loading` Zod schema stays as `.passthrough()` — discriminated union validation is Sprint 3 work. The existing schema is sufficient for all Sprint 2 tasks.

### 2.5 `.vxd` Driver Import: Inline in `/api/upload`

No separate `/api/drivers/import` route. When `fileType === 'vxd'`, the existing `POST /api/upload` handler calls `importVxdDrivers(parsedVxd)` inline and returns `{ driversImported: N }` in the response body. The projects page success card reads this field and shows "N drivers imported" with a link to `/dashboard/drivers`.

### 2.6 Handoff via URL Query Parameter

`/dashboard/projects/[id]` gains a `LoadIntoWorkspaceButton` client component. Clicking it navigates to `/dashboard/workspace?projectId=<vxproject-uuid>`. The workspace page reads `projectId` via `useSearchParams()` (wrapped in `<Suspense>`), fetches the VituixCAD project, maps it to a `DesignState` patch via `vxpToDesignState()`, and applies it.

### 2.7 State Lift: WayCard Becomes Controlled

`WayCard`'s `loadingVariant` and `enclosureType` local state moves up to `WorkspacePage`. `WayCard` receives `onWayChange(index, partial: Partial<WaySlot>)` as a prop and calls it on every user interaction. `WorkspacePage` owns the canonical `slots: WaySlot[]` state, which is the single source of truth that flows into `useDesignStatePersistence`.

---

## 3. Task List

### T01 — Sentinel Project ID + GET Auto-Create

**Description:** Establish the singleton workspace project. Create the constants file. Update `GET /api/design-state` to auto-upsert the `projects` row before upserting `design_state`.

**Files edited:**
- `web/lib/constants/workspace.ts` ← **NEW**
- `web/app/api/design-state/route.ts`

**Files created:**
- `web/lib/constants/workspace.ts`

**Implementation details:**

```typescript
// web/lib/constants/workspace.ts
export const WORKSPACE_PROJECT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
export const WORKSPACE_PROJECT_NAME = 'APEX Workspace';
```

In `GET /api/design-state`, when `projectId === WORKSPACE_PROJECT_ID` (or for all projectIds, for generality), before the `design_state` insert, run:

```typescript
await db
  .insert(projects)
  .values({ id: projectId, name: WORKSPACE_PROJECT_NAME })
  .onConflictDoNothing();
```

This requires importing `projects` from `@/lib/db/schema` into the design-state route.

**Definition of done:**
- `GET /api/design-state?projectId=<WORKSPACE_PROJECT_ID>` on a clean DB returns `{ state: {...}, persisted: true, created: true }` with no 500 errors
- Calling GET a second time returns the same state with `created: false`
- `tsc --noEmit` passes

---

### T02 — Workspace Loads State from DB on Mount

**Description:** Replace the static `useEffect` that generates placeholder slots with a real fetch from `GET /api/design-state`. Add the `useSearchParams` hook to detect a `?projectId=` query param (for T04 handoff).

**Files created:**
- `web/lib/hooks/use-design-state-persistence.ts`

**Files edited:**
- `web/app/dashboard/workspace/page.tsx`

**Hook signature:**

```typescript
// web/lib/hooks/use-design-state-persistence.ts
export interface UseDesignStatePersistenceReturn {
  state: DesignState | null;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  updateWay: (index: number, partial: Partial<WaySlot>) => void;
  setNumWays: (n: WayCount) => void;
  loadFromVxProject: (vxProjectId: string) => Promise<void>;
}

export function useDesignStatePersistence(projectId: string): UseDesignStatePersistenceReturn
```

**Hook behavior:**
1. On mount: `fetch('/api/design-state?projectId=' + projectId)` → sets `state`
2. Every time `state` changes (via `updateWay` or `setNumWays`): debounce 800ms → `PATCH /api/design-state`
3. While PATCH is in-flight: `saveStatus = 'saving'`; on success: `saveStatus = 'saved'`; hold 'saved' for 2s then revert to 'idle'

**WorkspacePage changes:**
- Wrap in `<Suspense>` boundary (required for `useSearchParams`)
- Replace the `useState<WaySlot[]>` + `useEffect` with `useDesignStatePersistence(WORKSPACE_PROJECT_ID)`
- Pass `updateWay` and `setNumWays` from the hook down to child components
- Show loading skeleton while `state === null`

**Definition of done:**
- Refreshing `/dashboard/workspace` retains the last-saved topology and enclosure settings
- Browser network tab shows PATCH being called once per 800ms debounce window after a change
- Loading spinner/skeleton visible on slow connections

---

### T03 — PATCH on Change + State Lift in WayCard

**Description:** Lift `loadingVariant` and `enclosureType` out of `WayCard`'s local state. `WayCard` becomes a fully controlled component. All changes funnel through `useDesignStatePersistence` → debounced PATCH.

**Files edited:**
- `web/app/dashboard/workspace/page.tsx`

**New WayCard prop signature:**

```typescript
interface WayCardProps {
  slot: WaySlot;
  index: number;
  onWayChange: (index: number, partial: Partial<WaySlot>) => void;
}

function WayCard({ slot, index, onWayChange }: WayCardProps)
```

**Changes inside WayCard:**
- Remove: `const [loadingVariant, setLoadingVariant] = useState(...)`
- Remove: `const [enclosureType, setEnclosureType] = useState(...)`
- Read: `loadingVariant` from `slot.loading.variant`
- Read: `enclosureType` from `slot.enclosureType`
- On enclosure button click: `onWayChange(index, { enclosureType: e.value })`
- On loading radio change: `onWayChange(index, { loading: { variant: v } })`

**WorkspacePage wires it:**

```typescript
const { state, saveStatus, updateWay, setNumWays } = useDesignStatePersistence(WORKSPACE_PROJECT_ID);

// Pass to WayCard:
<WayCard
  key={i}
  slot={slot}
  index={i}
  onWayChange={updateWay}
/>
```

**Save indicator in Col 1 header:**

```tsx
<div className="flex items-center justify-between mb-4">
  <div className="font-mono text-xs text-zinc-500 uppercase tracking-wider">Configuration</div>
  {saveStatus === 'saving' && (
    <span className="font-mono text-xs text-zinc-500">· saving...</span>
  )}
  {saveStatus === 'saved' && (
    <span className="font-mono text-xs text-emerald-500">· saved</span>
  )}
</div>
```

**Definition of done:**
- Clicking a different enclosure type triggers a PATCH after 800ms
- Changing topology (2-way → 3-way) triggers a PATCH after 800ms
- Save indicator cycles idle → saving → saved → idle visibly
- `WayCard` has zero `useState` calls for UI-driven fields
- `tsc --noEmit` passes

---

### T04 — Load into Workspace Button

**Description:** Replace the static `<a href="/dashboard/workspace">` link on the project detail page with a proper `LoadIntoWorkspaceButton` client component that navigates with the vxproject ID as a query param. The workspace then reads this param, fetches the project, maps it to design state, and patches.

**Files created:**
- `web/components/apex/load-into-workspace-button.tsx`

**Files edited:**
- `web/app/dashboard/projects/[id]/page.tsx`
- `web/lib/mappers/vxp-to-design-state.ts` ← **NEW**

**LoadIntoWorkspaceButton:**

```typescript
// web/components/apex/load-into-workspace-button.tsx
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Props {
  vxProjectId: string;
  fileType: string;
}

export function LoadIntoWorkspaceButton({ vxProjectId, fileType }: Props) {
  const router = useRouter();

  // Only .vxp files have full design state to map; .vxd/.vxb are driver/baffle data
  const isSupported = fileType === 'vxp';

  return (
    <Button
      variant="outline"
      size="sm"
      className="font-mono text-xs"
      disabled={!isSupported}
      title={!isSupported ? 'Only .vxp project files can be loaded into the workspace' : undefined}
      onClick={() => router.push(`/dashboard/workspace?projectId=${vxProjectId}`)}
    >
      load into workspace →
    </Button>
  );
}
```

**Project detail page heading row:**

```tsx
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
    <h1 className="text-xl font-mono font-bold text-white">{String(project.fileName)}</h1>
    <span className="text-xs font-mono px-2 py-0.5 rounded border bg-violet-500/20 text-violet-300 border-violet-500/30">
      .{String(project.fileType)}
    </span>
  </div>
  <LoadIntoWorkspaceButton
    vxProjectId={String(project.id)}
    fileType={String(project.fileType)}
  />
</div>
```

**VXP → DesignState mapper:**

```typescript
// web/lib/mappers/vxp-to-design-state.ts
import type { DesignState, WayCount, EnclosureType } from '@/lib/types/speaker-domain';
import { defaultDesignState } from '@/lib/types/speaker-domain';
import { WORKSPACE_PROJECT_ID } from '@/lib/constants/workspace';

export function vxpToDesignState(parsedData: Record<string, unknown>): Partial<DesignState> {
  // Navigate VXP structure: VITUIXCAD.PROJECT
  const project = (parsedData as any)?.VITUIXCAD?.PROJECT ?? {};

  const numWays = Math.min(
    Math.max(Number(project._waycount ?? 2), 2),
    4
  ) as WayCount;

  // Map VituixCAD enclosure type string to EnclosureType enum
  const enclosureRaw: string = project?.ENCLOSURE?._type ?? 'sealed';
  const enclosureMap: Record<string, EnclosureType> = {
    'Closed':           'sealed',
    'Vented':           'ported',
    'PassiveRadiator':  'passive_radiator',
    'OpenBaffle':       'open_baffle',
    'Horn':             'horn',
  };
  const enclosureType: EnclosureType = enclosureMap[enclosureRaw] ?? 'sealed';

  const base = defaultDesignState(WORKSPACE_PROJECT_ID, numWays);

  // Apply enclosure type to all ways (VXP is per-project, not per-way)
  const waysConfig = base.waysConfig.map(slot => ({ ...slot, enclosureType }));

  return {
    numWays,
    waysConfig,
    // crossoverFreqHz deferred to Sprint 3
    // activeVituixcadProjectId set by workspace page, not this mapper
  };
}
```

**Workspace reads `?projectId`:**

In `WorkspacePage` (after wrapping in Suspense), read `useSearchParams().get('projectId')`. If present, call `hook.loadFromVxProject(vxProjectId)` once on mount. `loadFromVxProject` in the hook:
1. `GET /api/projects/:id` → parsedData
2. Call `vxpToDesignState(parsedData)`
3. Merge result into local state
4. Immediately trigger PATCH to persist

**Definition of done:**
- Visiting `/dashboard/projects` → clicking a `.vxp` project → clicking "load into workspace →" → redirects to `/dashboard/workspace?projectId=<uuid>`
- Workspace applies numWays and enclosureType from the VXP file
- `.vxd` and `.vxb` projects show the button disabled with tooltip
- `tsc --noEmit` passes

---

### T05 — .vxd Driver Import (Inline in Upload)

**Description:** When the upload route receives a `.vxd` file, parse drivers and upsert them into `driver_database`. Return `driversImported: N` in the response. The projects page success card displays this count.

**Files created:**
- `web/lib/mappers/vxd-to-driver-insert.ts`
- `web/lib/mappers/infer-driver-type.ts`

**Files edited:**
- `web/app/api/upload/route.ts`
- `web/app/dashboard/projects/page.tsx`

**`inferDriverType` function:**

```typescript
// web/lib/mappers/infer-driver-type.ts
import type { InferSelectModel } from 'drizzle-orm';
import { driverDatabase } from '@/lib/db/schema';

type DriverType = InferSelectModel<typeof driverDatabase>['driverType'];

const CATEGORY_MAP: Array<[RegExp, DriverType]> = [
  [/woofer|woof|bass|lf/i,          'woofer'],
  [/mid|mf|midrange/i,              'midrange'],
  [/tweet|hf|treble/i,              'tweeter'],
  [/super.?tweet|shf/i,             'supertweeter'],
  [/sub|subwoof/i,                  'subwoofer'],
  [/full.?range|fr/i,               'fullrange'],
  [/compres|driver|cd/i,            'compression_driver'],
  [/ribbon/i,                       'ribbon'],
  [/planar|amt|air.?motion/i,       'planar'],
  [/coax/i,                         'coaxial'],
];

export function inferDriverType(category: string, fsHz: number | null): DriverType {
  for (const [pattern, type] of CATEGORY_MAP) {
    if (pattern.test(category)) return type;
  }
  // fs fallback heuristic
  if (fsHz !== null) {
    if (fsHz < 80)  return 'woofer';
    if (fsHz < 500) return 'midrange';
    return 'tweeter';
  }
  return 'fullrange'; // safe fallback
}
```

**`vxdToDriverInserts` function:**

```typescript
// web/lib/mappers/vxd-to-driver-insert.ts
import type { VxdRaw } from '@/lib/parser/vituixcad-native';
import type { InferInsertModel } from 'drizzle-orm';
import { driverDatabase } from '@/lib/db/schema';
import { mapThieleSmall } from '@/lib/parser/ts-param-mapper';
import { inferDriverType } from './infer-driver-type';

type DriverInsert = InferInsertModel<typeof driverDatabase>;

export function vxdToDriverInserts(vxd: VxdRaw): DriverInsert[] {
  const drivers = vxd.VITUIXCAD.DATABASE.DRIVER ?? [];
  return drivers.map(d => {
    const params = d.PARAM ?? [];                        // Bug fix: guard empty PARAM
    const ts = mapThieleSmall(params);
    const driverType = inferDriverType(d._category ?? '', ts.fs_hz ?? null);

    return {
      manufacturer: d._mfr ?? 'Unknown',
      model:        d._model ?? 'Unknown',
      driverType,
      nominalImpedanceOhm: ts.Re_ohms ?? null,
      reOhm:         ts.Re_ohms    ?? null,
      leMh:          ts.Le_mH      ?? null,
      bl:            ts.BL_Tm      ?? null,
      fsHz:          ts.fs_hz      ?? null,
      qts:           ts.Qts        ?? null,
      qes:           ts.Qes        ?? null,
      qms:           ts.Qms        ?? null,
      vasLiters:     ts.Vas_L      ?? null,
      mmsGrams:      ts.Mms_g      ?? null,
      cmsMmPerN:     ts.Cms_mmPerN ?? null,
      rmsKgS:        ts.Rms_kgPerS ?? null,
      sdCm2:         ts.Sd_cm2     ?? null,
      xmaxMm:        ts.Xmax_mm    ?? null,
      sensitivity1m1w: ts.SPL_1w1m_dB ?? null,
      powerWatts:    ts.Pmax_W     ?? null,
      source:        'vxd_import',
      rawData:       d as unknown as Record<string, unknown>,
    };
  });
}
```

**Upload route — .vxd branch:**

After the existing successful DB insert block, add a `.vxd` branch:

```typescript
import { vxdToDriverInserts } from '@/lib/mappers/vxd-to-driver-insert';
import { driverDatabase } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

// Inside POST, after successful vxd parse:
if (fileType === 'vxd') {
  const inserts = vxdToDriverInserts(parsedData as VxdRaw);
  let driversImported = 0;
  if (inserts.length > 0) {
    const result = await db
      .insert(driverDatabase)
      .values(inserts)
      .onConflictDoUpdate({
        target: [driverDatabase.manufacturer, driverDatabase.model],
        set: {
          // Update T/S params on re-import; preserve manual overrides for fields not in vxd
          reOhm:    sql`excluded.re_ohm`,
          leMh:     sql`excluded.le_mh`,
          bl:       sql`excluded.bl`,
          fsHz:     sql`excluded.fs_hz`,
          qts:      sql`excluded.qts`,
          qes:      sql`excluded.qes`,
          qms:      sql`excluded.qms`,
          vasLiters: sql`excluded.vas_liters`,
          mmsGrams:  sql`excluded.mms_grams`,
          updatedAt: sql`now()`,
        },
      })
      .returning({ id: driverDatabase.id });
    driversImported = result.length;
  }

  return NextResponse.json({
    success: true,
    persisted: true,
    id: inserted.id,
    fileType,
    fileName: filename,
    driversImported,
  });
}
```

**Projects page success card for .vxd:**

```tsx
// In the success state for .vxd uploads:
{uploadResult.fileType === 'vxd' && (
  <p className="font-mono text-xs text-emerald-400 mt-1">
    {uploadResult.driversImported ?? 0} drivers imported —{' '}
    <a href="/dashboard/drivers" className="underline hover:text-emerald-300">
      view driver database →
    </a>
  </p>
)}
```

**Definition of done:**
- Upload a `.vxd` file → response includes `driversImported: N` where N > 0
- Rows appear in `/dashboard/drivers`
- Re-uploading the same `.vxd` updates T/S params (upsert), does not duplicate rows
- Uploading a `.vxd` with a single driver (edge case) works correctly
- `tsc --noEmit` passes

---

### T06 — Active Project Indicator

**Description:** When the workspace has loaded a VituixCAD project via `?projectId=`, show the project filename in the Col 1 sidebar as an "active project" badge. This is a pure UI addition — no new API calls.

**Files edited:**
- `web/app/dashboard/workspace/page.tsx`

**Implementation:** After the `loadFromVxProject` call resolves, store `activeProjectName: string | null` in local state (separate from the persisted `DesignState`). Render in Col 1 below the topology section:

```tsx
{activeProjectName && (
  <div className="mb-4">
    <div className="font-mono text-xs text-zinc-500 mb-1">Active Project</div>
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs text-violet-300 truncate">{activeProjectName}</span>
      <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 border border-violet-500/20">
        .vxp
      </span>
    </div>
  </div>
)}
```

The `"import .vxp"` button in Col 1 remains — it still navigates to `/dashboard/projects` for file selection.

**Definition of done:**
- After loading a project via URL param, the filename appears in the sidebar
- No active project shown on a cold workspace visit (no query param)
- Indicator disappears if the user manually navigates to `/dashboard/workspace` (no param)

---

## 4. Parallelism Windows

```
W0 (parallel, no dependencies):
  ├── T01 — Sentinel project ID + GET auto-create
  └── T05 — .vxd driver import + mappers

W1 (parallel, depends on W0):
  ├── T02 — Workspace loads state from DB (depends on T01: needs WORKSPACE_PROJECT_ID)
  └── T04 — LoadIntoWorkspaceButton + vxp-to-design-state mapper (depends on T01)

W2 (sequential, depends on W1):
  ├── T03 — PATCH on change + state lift (depends on T02: hook must exist)
  └── T06 — Active project indicator (depends on T04: loadFromVxProject must exist in hook)
```

**Estimated wall-clock with 2 parallel subagents:**
- W0: ~45 min
- W1: ~60 min
- W2: ~45 min
- Integration + verification: ~30 min
- Total: ~3h

---

## 5. New Files to Create

| File | Owner task | Purpose |
|------|-----------|---------|
| `web/lib/constants/workspace.ts` | T01 | `WORKSPACE_PROJECT_ID` + `WORKSPACE_PROJECT_NAME` |
| `web/lib/hooks/use-design-state-persistence.ts` | T02 | Fetch + debounced PATCH hook |
| `web/lib/mappers/vxp-to-design-state.ts` | T04 | VXP parsedData → `Partial<DesignState>` |
| `web/lib/mappers/vxd-to-driver-insert.ts` | T05 | VXD DRIVER array → `DriverInsert[]` |
| `web/lib/mappers/infer-driver-type.ts` | T05 | Category string + fs fallback → `DriverType` enum |
| `web/components/apex/load-into-workspace-button.tsx` | T04 | Client component: navigate to workspace with projectId |
| `web/lib/types/api-contracts.ts` | T05 | Typed response shapes for upload, design-state, projects |

**`api-contracts.ts` shape (for type-safe fetch calls in hook + pages):**

```typescript
// web/lib/types/api-contracts.ts

export interface UploadResponse {
  success: boolean;
  persisted: boolean;
  id?: string;
  fileType: 'vxp' | 'vxd' | 'vxb';
  fileName: string;
  driversImported?: number;   // only on .vxd
  parsedData?: unknown;       // only when persisted: false
  message?: string;
  error?: string;
  existingId?: string;
}

export interface DesignStateResponse {
  state: import('./speaker-domain').DesignState;
  persisted: boolean;
  created?: boolean;
}

export interface ProjectDetailResponse {
  project: {
    id: string;
    fileType: 'vxp' | 'vxd' | 'vxb';
    fileName: string;
    parsedData: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
  };
}
```

---

## 6. Files to Modify

| File | Task(s) | What Changes |
|------|--------|-------------|
| `web/app/api/design-state/route.ts` | T01, T02 | Auto-upsert `projects` row; add graceful degradation for PATCH |
| `web/app/api/upload/route.ts` | T05 | Add `.vxd` branch calling `vxdToDriverInserts` + upsert |
| `web/app/dashboard/workspace/page.tsx` | T02, T03, T06 | Replace static state with hook; lift WayCard state; add save indicator; add active project badge; wrap in Suspense |
| `web/app/dashboard/projects/[id]/page.tsx` | T04 | Replace static link with `LoadIntoWorkspaceButton`; adjust heading layout |
| `web/app/dashboard/projects/page.tsx` | T05 | Show `.vxd` success card with `driversImported` count |
| `web/lib/parser/ts-param-mapper.ts` | Bug fix | NaN guard in `mapThieleSmall` |
| `web/lib/parser/vituixcad-parser.ts` | Bug fix | `d.PARAM ?? []` guard in `parseVxd` |

---

## 7. Critical Bug Fixes

These must ship as part of this sprint. They are blocking correctness for T05.

### Bug Fix A: NaN Guard in `mapThieleSmall`

**File:** `web/lib/parser/ts-param-mapper.ts`

**Problem:** `Number(param._v)` returns `NaN` when `_v` is an empty string, `undefined`, or a non-numeric string. `NaN` values silently corrupt the DB row.

**Current code (line 35):**
```typescript
(result as Record<string, number>)[canonical] = Number(param._v);
```

**Fixed code:**
```typescript
const numeric = Number(param._v);
if (!Number.isNaN(numeric)) {
  (result as Record<string, number>)[canonical] = numeric;
}
```

### Bug Fix B: PARAM Array Guard in `parseVxd`

**File:** `web/lib/parser/vituixcad-parser.ts`

**Problem:** `ALWAYS_ARRAY` includes `'PARAM'` globally, so the XMLParser makes `PARAM` an array at the document level. However, individual `DRIVER` elements that have zero params or a single param with non-standard nesting can still arrive as `undefined` or a bare object on the DRIVER node's `.PARAM` property. The `mapThieleSmall` call in `vxdToDriverInserts` receives `d.PARAM` — if it's `undefined`, the loop crashes.

**Fix:** In `vxdToDriverInserts` (not in the parser), always use `d.PARAM ?? []` as shown in the T05 mapper code above. The parser itself does not need changes beyond what Sprint 1 already delivered for the top-level DRIVER array guard.

**Secondary fix:** Add an explicit runtime guard in the `parseVxd` function for defensive correctness:

```typescript
// After the existing DRIVER array guard in parseVxd:
if (raw.VITUIXCAD.DATABASE.DRIVER) {
  for (const driver of raw.VITUIXCAD.DATABASE.DRIVER) {
    if (driver.PARAM && !Array.isArray(driver.PARAM)) {
      driver.PARAM = [driver.PARAM];
    }
  }
}
```

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| **T03: State lift breaks WayCard expand/collapse** | Medium | Medium | `expanded` accordion state stays local in WayCard (it's pure UI, not persisted). Only `loadingVariant` and `enclosureType` lift up. |
| **T02: Version conflict (409) on rapid edits** | Low | Low | Hook discards 409 silently and re-fetches current server version to sync. Does not show error to user. |
| **T05: VXD with zero drivers** | Low | Low | `inserts.length === 0` branch skips DB call; returns `driversImported: 0`. |
| **T04: `useSearchParams` requires Suspense** | High | High | WorkspacePage must be wrapped in `<Suspense fallback={<WorkspaceSkeleton />}>`. Missing Suspense causes a build error in Next.js app router. Verify with `npm run build`. |
| **T01: `WORKSPACE_PROJECT_ID` FK constraint fails** | Medium | High | The `projects.id` FK on `design_state` means the projects row must exist before design_state insert. The auto-upsert in GET route handles this — but only if `projects` import is correctly added to the route. |
| **T05: `onConflictDoUpdate` with `sql` template** | Low | Medium | Drizzle's `onConflictDoUpdate` with `sql\`excluded.column\`` is the correct pattern for Postgres upsert. Test with a re-upload of the same .vxd file. |

---

## 9. Definition of Done — Full Sprint

All of the following must be true before Sprint 2 is considered complete:

1. `tsc --noEmit` exits with zero errors
2. `npm run build` (inside `web/`) exits clean
3. `GET /api/design-state?projectId=<WORKSPACE_PROJECT_ID>` auto-creates state on cold DB
4. Changes in the workspace (topology, enclosure type, loading type) are persisted after 800ms debounce
5. Refreshing `/dashboard/workspace` restores the last-saved state
6. Save indicator shows `· saving...` → `· saved` on each change cycle
7. `/dashboard/projects/[id]` shows "load into workspace →" button, disabled for `.vxd`/`.vxb`
8. Clicking the button on a `.vxp` project navigates to `/dashboard/workspace?projectId=<uuid>` and applies numWays + enclosureType from the file
9. Active project name badge appears in Col 1 after VXP load
10. Upload of a `.vxd` file returns `driversImported: N`, rows appear in `/dashboard/drivers`
11. Re-uploading the same `.vxd` updates existing rows (upsert), no duplicates
12. `mapThieleSmall` skips NaN values (confirmed by unit test or manual inspection with a malformed param)
13. Uploading a `.vxd` with a single driver (PARAM as object, not array) does not crash
14. All Sprint 1 success criteria remain true (existing agents, graceful degradation, route list)

---

## 10. Out of Scope (Sprint 3)

- `vxd_source_id UUID` column on `driver_database`
- `LoadingConfig` Zod discriminated union (replacing `.passthrough()`)
- Crossover frequency mapping from VXP (`_xover_*` attributes)
- Math calculations in workspace (calcSealedBox, calcPortedBox — stubs remain)
- Driver selector UI (clicking "select driver →" opens a searchable modal)
- `vituixcad_measurements` table
- Vector embedding of driver_database rows for RAG search
