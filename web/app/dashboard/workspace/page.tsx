'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { EnclosureType, LoadingVariant, WaySlot } from '@/lib/types/speaker-domain';
import { useDesignStatePersistence, type SaveStatus } from '@/lib/hooks/use-design-state-persistence';
import { WORKSPACE_PROJECT_ID } from '@/lib/constants/workspace';

// ── Mini chat for workspace ──────────────────────────────────────────────────
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

// ── Horn loading config UI ────────────────────────────────────────────────────
const HORN_TYPES: { value: LoadingVariant; label: string }[] = [
  { value: 'direct_radiator',    label: 'Direct Radiator' },
  { value: 'waveguide',          label: 'Waveguide' },
  { value: 'tractrix',           label: 'Tractrix Horn' },
  { value: 'exponential',        label: 'Exponential Horn' },
  { value: 'conical',            label: 'Conical Horn' },
  { value: 'oblate_spheroidal',  label: 'Oblate Spheroidal' },
  { value: 'le_cleach',          label: "Le Cléac'h Horn" },
  { value: 'transmission_line',  label: 'Transmission Line' },
];

function MonoInput({ label, unit, value, onChange }: {
  label: string;
  unit: string;
  value?: number;
  onChange?: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="font-mono text-xs text-zinc-500 w-24">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value ?? ''}
          onChange={e => onChange?.(parseFloat(e.target.value))}
          className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 font-mono text-xs text-right text-zinc-200 outline-none focus:border-zinc-500 tabular-nums"
        />
        <span className="font-mono text-xs text-zinc-600 w-8">{unit}</span>
      </div>
    </div>
  );
}

function HornLoadingPanel({
  variant,
  onChange,
}: {
  variant: LoadingVariant;
  onChange: (v: LoadingVariant) => void;
}) {
  const isHorn = ['tractrix', 'exponential', 'conical', 'oblate_spheroidal', 'le_cleach'].includes(variant);
  const isWG = variant === 'waveguide';
  const isTL = variant === 'transmission_line';

  return (
    <div className="mt-2">
      <div className="text-xs font-mono text-zinc-500 mb-2">Loading Type</div>
      <div className="space-y-0.5 mb-3">
        {HORN_TYPES.map(h => (
          <label key={h.value} className="flex items-center gap-2 cursor-pointer hover:bg-zinc-800/50 px-1 rounded">
            <input
              type="radio"
              name="horn-type"
              value={h.value}
              checked={variant === h.value}
              onChange={() => onChange(h.value)}
              className="accent-violet-500"
            />
            <span className={`font-mono text-xs ${variant === h.value ? 'text-white' : 'text-zinc-400'}`}>
              {h.label}
            </span>
          </label>
        ))}
      </div>

      {isHorn && (
        <div className="border-t border-zinc-800 pt-2 space-y-0">
          <MonoInput label="throat ⌀" unit="mm" />
          <MonoInput label="mouth ⌀"  unit="mm" />
          <MonoInput label="length"   unit="mm" />
          <MonoInput label="cutoff Fc" unit="Hz" />
          <MonoInput label="coverage H" unit="°" />
          <MonoInput label="coverage V" unit="°" />
        </div>
      )}
      {isWG && (
        <div className="border-t border-zinc-800 pt-2 space-y-0">
          <MonoInput label="coverage H" unit="°" />
          <MonoInput label="coverage V" unit="°" />
          <MonoInput label="throat ⌀"  unit="mm" />
          <MonoInput label="depth"     unit="mm" />
        </div>
      )}
      {isTL && (
        <div className="border-t border-zinc-800 pt-2 space-y-0">
          <MonoInput label="length"   unit="mm" />
          <MonoInput label="line ⌀"   unit="mm" />
          <MonoInput label="stuffing" unit="kg/m³" />
        </div>
      )}
    </div>
  );
}

// ── Way slot card ─────────────────────────────────────────────────────────────
const ENCLOSURE_TYPES: { value: EnclosureType; label: string }[] = [
  { value: 'sealed',          label: 'Sealed' },
  { value: 'ported',          label: 'Ported' },
  { value: 'passive_radiator', label: 'Passive Radiator' },
  { value: 'open_baffle',     label: 'Open Baffle' },
  { value: 'horn',            label: 'Horn Loaded' },
];

const ROLE_LABELS: Record<string, string> = {
  woofer:      'LF',
  mid:         'MF',
  tweeter:     'HF',
  supertweeter:'SHF',
};

function WayCard({
  slot,
  index,
  onWayChange,
}: {
  slot: WaySlot;
  index: number;
  onWayChange?: (index: number, partial: Partial<WaySlot>) => void;
}) {
  const [expanded, setExpanded] = useState(index === 0);
  const [loadingVariant, setLoadingVariant] = useState<LoadingVariant>(
    slot.loading.variant as LoadingVariant
  );
  const [enclosureType, setEnclosureType] = useState<EnclosureType>(slot.enclosureType);

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden mb-3">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-zinc-900/50 hover:bg-zinc-800/40 text-left"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-500">WAY {index + 1}</span>
          <span className="font-mono text-sm text-zinc-300 font-medium uppercase">
            {ROLE_LABELS[slot.role] ?? slot.role}
          </span>
          {slot.driverDatabaseId ? (
            <span className="font-mono text-xs text-emerald-400">driver assigned</span>
          ) : (
            <span className="font-mono text-xs text-zinc-600">[no driver]</span>
          )}
        </div>
        <span className="text-zinc-600 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 space-y-4 bg-zinc-950/30">
          {/* Driver assignment */}
          <div>
            <div className="text-xs font-mono text-zinc-500 mb-2">Driver</div>
            <Button variant="outline" size="sm" className="font-mono text-xs w-full" asChild>
              <a href="/dashboard/drivers">
                {slot.driverDatabaseId ? 'change driver →' : 'select driver →'}
              </a>
            </Button>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Enclosure */}
          <div>
            <div className="text-xs font-mono text-zinc-500 mb-2">Enclosure</div>
            <div className="flex flex-wrap gap-1">
              {ENCLOSURE_TYPES.map(e => (
                <button
                  key={e.value}
                  onClick={() => {
                    setEnclosureType(e.value);
                    onWayChange?.(index, { enclosureType: e.value });
                  }}
                  className={`font-mono text-xs px-2 py-0.5 rounded border transition-colors ${
                    enclosureType === e.value
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500'
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Horn / loading */}
          <HornLoadingPanel
            variant={loadingVariant}
            onChange={(v) => {
              setLoadingVariant(v);
              onWayChange?.(index, { loading: { variant: v } as WaySlot['loading'] });
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Save indicator ────────────────────────────────────────────────────────────
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null;
  if (status === 'saving') return <span className="font-mono text-xs text-zinc-500"> · saving...</span>;
  if (status === 'saved')  return <span className="font-mono text-xs text-emerald-500"> · saved</span>;
  if (status === 'error')  return <span className="font-mono text-xs text-red-400"> · save failed</span>;
  return null;
}

// ── Main workspace ────────────────────────────────────────────────────────────
export default function WorkspacePage() {
  const { state, isLoading, saveStatus, updateWay, setNumWays } = useDesignStatePersistence(WORKSPACE_PROJECT_ID);

  // Loading skeleton
  if (isLoading) {
    return (
      <div
        className="h-[calc(100vh-48px)] grid overflow-hidden"
        style={{ gridTemplateColumns: '220px 1fr 380px' }}
      >
        <div className="border-r border-zinc-800 p-4 bg-zinc-950 space-y-3 animate-pulse">
          <div className="h-3 bg-zinc-800 rounded w-24" />
          <div className="h-3 bg-zinc-800 rounded w-16" />
          <div className="h-3 bg-zinc-800 rounded w-20" />
        </div>
        <div className="p-4 bg-zinc-950/50 space-y-3 animate-pulse">
          <div className="h-12 bg-zinc-800 rounded" />
          <div className="h-12 bg-zinc-800 rounded" />
        </div>
        <div className="border-l border-zinc-800 bg-zinc-950" />
      </div>
    );
  }

  // Empty state (no state after load)
  if (!state) {
    return (
      <div className="h-[calc(100vh-48px)] flex items-center justify-center bg-zinc-950">
        <div className="text-center space-y-4">
          <div className="font-mono text-zinc-500">No workspace state found.</div>
          <Button variant="outline" size="sm" className="font-mono text-xs" asChild>
            <a href="/dashboard/projects">import a project to get started →</a>
          </Button>
        </div>
      </div>
    );
  }

  const { numWays, slots } = state;

  return (
    <div
      className="h-[calc(100vh-48px)] grid overflow-hidden"
      style={{ gridTemplateColumns: '220px 1fr 380px' }}
    >
      {/* Col 1: Configuration */}
      <div className="border-r border-zinc-800 overflow-y-auto p-4 bg-zinc-950">
        <div className="flex items-center font-mono text-xs text-zinc-500 uppercase tracking-wider mb-4">
          Configuration
          <SaveIndicator status={saveStatus} />
        </div>

        {/* Topology */}
        <div className="mb-6">
          <div className="font-mono text-xs text-zinc-500 mb-2">Topology</div>
          {([2, 3, 4] as const).map(n => (
            <label key={n} className="flex items-center gap-2 mb-1 cursor-pointer hover:bg-zinc-800/50 px-1 rounded">
              <input
                type="radio"
                name="numWays"
                value={n}
                checked={numWays === n}
                onChange={() => setNumWays(n)}
                className="accent-violet-500"
              />
              <span className={`font-mono text-xs ${numWays === n ? 'text-white' : 'text-zinc-400'}`}>
                {n}-way
              </span>
            </label>
          ))}
        </div>

        <Separator className="bg-zinc-800 mb-4" />

        {/* Active ways summary */}
        <div className="mb-6">
          <div className="font-mono text-xs text-zinc-500 mb-2">Ways</div>
          {slots.map((s, i) => (
            <div key={i} className="flex justify-between font-mono text-xs py-0.5">
              <span className="text-zinc-400">WAY {i + 1}</span>
              <span className="text-zinc-300 uppercase">{s.role}</span>
            </div>
          ))}
        </div>

        <Separator className="bg-zinc-800 mb-4" />

        {/* Import */}
        <Button variant="outline" size="sm" className="w-full font-mono text-xs" asChild>
          <a href="/dashboard/projects">import .vxp</a>
        </Button>
      </div>

      {/* Col 2: Driver slots */}
      <div className="overflow-y-auto p-4 bg-zinc-950/50">
        <div className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-4">
          Driver Slots
        </div>
        {slots.map((slot, i) => (
          <WayCard key={i} slot={slot} index={i} onWayChange={updateWay} />
        ))}
      </div>

      {/* Col 3: Agent chat */}
      <div className="border-l border-zinc-800 bg-zinc-950 flex flex-col">
        <div className="font-mono text-xs text-zinc-500 uppercase tracking-wider p-4 border-b border-zinc-800">
          Agent
        </div>
        <div className="flex-1 overflow-hidden">
          <WorkspaceChat domain="acoustics" />
        </div>
      </div>
    </div>
  );
}
