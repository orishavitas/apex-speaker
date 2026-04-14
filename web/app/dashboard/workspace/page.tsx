'use client';

import { useState, useEffect, Suspense, useMemo, useRef, useCallback } from 'react';
import { Chat, useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { MessageBubble } from '@/components/apex/chat/message-bubble';
import type { AgentDomain } from '@/lib/agents/types';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { EnclosureType, LoadingVariant, WaySlot, ThieleSmallParams } from '@/lib/types/speaker-domain';
import { useDesignStatePersistence, type SaveStatus } from '@/lib/hooks/use-design-state-persistence';
import { WORKSPACE_PROJECT_ID } from '@/lib/constants/workspace';
import {
  calcSealedBox,
  calcPortedBox,
  calcHornLoading,
  sealedBoxQuality,
  portVelocityWarning,
  type SealedBoxResult,
  type PortedBoxResult,
  type HornResult,
} from '@/lib/types/speaker-math';
import type { HornProfile } from '@/lib/types/speaker-domain';

// ── Mini chat for workspace ──────────────────────────────────────────────────
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
        {messages.map((msg) => {
          const text = msg.parts
            ?.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map(p => p.text)
            .join('') ?? '';
          return (
            <MessageBubble
              key={msg.id}
              role={msg.role as 'user' | 'assistant'}
              content={text}
              domain={msg.role === 'assistant' ? routedDomain : undefined}
              isStreaming={msg.role === 'assistant' && isStreaming && msg.id === messages[messages.length - 1]?.id}
            />
          );
        })}
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
  hornConfig = {},
  onHornChange,
}: {
  variant: LoadingVariant;
  onChange: (v: LoadingVariant) => void;
  hornConfig?: Record<string, number>;
  onHornChange?: (key: string, value: number) => void;
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
          <MonoInput label="throat ⌀" unit="mm" value={hornConfig['throat_mm']} onChange={v => onHornChange?.('throat_mm', v)} />
          <MonoInput label="mouth ⌀"  unit="mm" value={hornConfig['mouth_mm']}  onChange={v => onHornChange?.('mouth_mm', v)} />
          <MonoInput label="length"   unit="mm" value={hornConfig['length_mm']} onChange={v => onHornChange?.('length_mm', v)} />
          <MonoInput label="cutoff Fc" unit="Hz" value={hornConfig['cutoff_hz']} onChange={v => onHornChange?.('cutoff_hz', v)} />
          <MonoInput label="coverage H" unit="°" value={hornConfig['coverage_h_deg']} onChange={v => onHornChange?.('coverage_h_deg', v)} />
          <MonoInput label="coverage V" unit="°" value={hornConfig['coverage_v_deg']} onChange={v => onHornChange?.('coverage_v_deg', v)} />
        </div>
      )}
      {isWG && (
        <div className="border-t border-zinc-800 pt-2 space-y-0">
          <MonoInput label="coverage H" unit="°"  value={hornConfig['coverage_h_deg']} onChange={v => onHornChange?.('coverage_h_deg', v)} />
          <MonoInput label="coverage V" unit="°"  value={hornConfig['coverage_v_deg']} onChange={v => onHornChange?.('coverage_v_deg', v)} />
          <MonoInput label="throat ⌀"  unit="mm" value={hornConfig['throat_mm']}       onChange={v => onHornChange?.('throat_mm', v)} />
          <MonoInput label="depth"     unit="mm" value={hornConfig['depth_mm']}         onChange={v => onHornChange?.('depth_mm', v)} />
        </div>
      )}
      {isTL && (
        <div className="border-t border-zinc-800 pt-2 space-y-0">
          <MonoInput label="length"   unit="mm"    value={hornConfig['length_mm']}            onChange={v => onHornChange?.('length_mm', v)} />
          <MonoInput label="line ⌀"   unit="mm"    value={hornConfig['line_diameter_mm']}     onChange={v => onHornChange?.('line_diameter_mm', v)} />
          <MonoInput label="stuffing" unit="kg/m³" value={hornConfig['stuffing_density']}     onChange={v => onHornChange?.('stuffing_density', v)} />
        </div>
      )}
    </div>
  );
}

// ── Driver DB row shape (subset we care about) ───────────────────────────────
interface DriverRow {
  id: string;
  manufacturer: string;
  model: string;
  fsHz: number | null;
  qts: number | null;
  qes: number | null;
  qms: number | null;
  vasLiters: number | null;
  mmsGrams: number | null;
  cmsMmPerN: number | null;
  rmsKgS: number | null;
  sdCm2: number | null;
  xmaxMm: number | null;
  reOhm: number | null;
  leMh: number | null;
  bl: number | null;
  sensitivity1m1w: number | null;
  powerWatts: number | null;
}

function driverRowToTS(d: DriverRow): ThieleSmallParams | null {
  const required = [d.fsHz, d.qts, d.qes, d.qms, d.sdCm2, d.xmaxMm, d.reOhm, d.leMh, d.bl, d.mmsGrams, d.cmsMmPerN, d.rmsKgS, d.sensitivity1m1w, d.powerWatts];
  if (required.some(v => v === null || v === undefined)) return null;
  return {
    fs_hz:        d.fsHz!,
    Qts:          d.qts!,
    Qes:          d.qes!,
    Qms:          d.qms!,
    Sd_cm2:       d.sdCm2!,
    Xmax_mm:      d.xmaxMm!,
    Re_ohms:      d.reOhm!,
    Le_mH:        d.leMh!,
    BL_Tm:        d.bl!,
    Mms_g:        d.mmsGrams!,
    Cms_mmPerN:   d.cmsMmPerN!,
    Rms_kgPerS:   d.rmsKgS!,
    SPL_1w1m_dB:  d.sensitivity1m1w!,
    Pmax_W:       d.powerWatts!,
    Vas_L:        d.vasLiters ?? undefined,
  };
}

// ── Math results panel ────────────────────────────────────────────────────────
function MathResult({ label, value, unit, warn }: { label: string; value: string | number; unit?: string; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="font-mono text-xs text-zinc-500">{label}</span>
      <span className={`font-mono text-xs tabular-nums ${warn ? 'text-amber-400' : 'text-zinc-200'}`}>
        {value}{unit ? <span className="text-zinc-500 ml-0.5">{unit}</span> : null}
      </span>
    </div>
  );
}

function SealedResults({ ts, volumeL }: { ts: ThieleSmallParams; volumeL: number }) {
  const res: SealedBoxResult = calcSealedBox(ts, { type: 'sealed', net_volume_L: volumeL });
  const quality = sealedBoxQuality(res.Qtc);
  return (
    <div className="mt-3 border border-zinc-800/60 rounded p-2 bg-zinc-900/40 space-y-0">
      <div className="font-mono text-xs text-violet-400 mb-1.5">Sealed Box Analysis</div>
      <MathResult label="Qtc" value={res.Qtc} />
      <MathResult label="f3" value={res.f3_hz} unit="Hz" />
      <MathResult label="fb" value={res.fb_hz} unit="Hz" />
      {res.peak_dB > 0 && <MathResult label="peak" value={`+${res.peak_dB}`} unit="dB" warn />}
      <div className="mt-1.5 font-mono text-xs text-zinc-500 leading-tight">{quality}</div>
    </div>
  );
}

function PortedResults({ ts, volumeL }: { ts: ThieleSmallParams; volumeL: number }) {
  const res: PortedBoxResult = calcPortedBox(ts, { type: 'ported', net_volume_L: volumeL });
  const velocityWarn = portVelocityWarning(res.port_velocity_ms);
  return (
    <div className="mt-3 border border-zinc-800/60 rounded p-2 bg-zinc-900/40 space-y-0">
      <div className="font-mono text-xs text-amber-400 mb-1.5">Ported Box Analysis</div>
      <MathResult label="fb" value={res.fb_hz} unit="Hz" />
      <MathResult label="f3" value={res.f3_hz} unit="Hz" />
      <MathResult label="group delay" value={res.group_delay_ms} unit="ms" />
      <MathResult label="port velocity" value={res.port_velocity_ms} unit="m/s" warn={!!velocityWarn} />
      {velocityWarn && (
        <div className="mt-1.5 font-mono text-xs text-amber-400 leading-tight">{velocityWarn}</div>
      )}
    </div>
  );
}

function HornResults({ ts, slot }: { ts: ThieleSmallParams; slot: WaySlot }) {
  const loading = slot.loading;
  const isHornProfile = ['tractrix','exponential','conical','oblate_spheroidal','le_cleach'].includes(loading.variant);
  if (!isHornProfile) return null;

  // Fields stored as diameter (mm); convert to area (cm²) for math engine
  const dims = loading as unknown as Record<string, unknown>;
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

  return (
    <div className="mt-3 border border-zinc-800/60 rounded p-2 bg-zinc-900/40 space-y-0">
      <div className="font-mono text-xs text-violet-400 mb-1.5">Horn Analysis</div>
      <MathResult label="cutoff fc" value={res.fc_hz} unit="Hz" />
      <MathResult label="efficiency" value={res.efficiency_pct} unit="%" />
      <MathResult label="mouth loading" value={res.mouth_loading_dB} unit="dB" />
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
  const [tsParams, setTsParams] = useState<ThieleSmallParams | null>(null);
  const [driverLabel, setDriverLabel] = useState<string | null>(null);

  // Fetch T/S params when driver ID is present
  useEffect(() => {
    if (!slot.driverDatabaseId) {
      setTsParams(null);
      setDriverLabel(null);
      return;
    }
    fetch(`/api/drivers/${slot.driverDatabaseId}`)
      .then(r => r.ok ? r.json() as Promise<{ driver: DriverRow }> : null)
      .then(data => {
        if (!data) return;
        const ts = driverRowToTS(data.driver);
        setTsParams(ts);
        setDriverLabel(`${data.driver.manufacturer} ${data.driver.model}`);
      })
      .catch(() => { /* silently skip — no DB */ });
  }, [slot.driverDatabaseId]);

  // Keep local state in sync when slot changes externally (e.g. on load)
  useEffect(() => {
    setEnclosureType(slot.enclosureType);
  }, [slot.enclosureType]);

  useEffect(() => {
    setLoadingVariant(slot.loading.variant as LoadingVariant);
  }, [slot.loading.variant]);

  const volumeL = slot.netVolumeLiters ?? null;
  const needsVolume = (enclosureType === 'sealed' || enclosureType === 'ported') && tsParams !== null;
  const canShowMath = tsParams !== null && (enclosureType === 'horn' || (volumeL !== null && volumeL > 0));

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
            <span className="font-mono text-xs text-emerald-400">{driverLabel ?? 'driver assigned'}</span>
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
            <div className="flex flex-wrap gap-1 mb-3">
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

            {/* Volume input for sealed/ported */}
            {(enclosureType === 'sealed' || enclosureType === 'ported') && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-500 w-16">volume</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.5"
                  value={volumeL ?? ''}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    onWayChange?.(index, { netVolumeLiters: isNaN(v) ? null : v });
                  }}
                  placeholder="e.g. 20"
                  className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-0.5 font-mono text-xs text-right text-zinc-200 outline-none focus:border-zinc-500 tabular-nums"
                />
                <span className="font-mono text-xs text-zinc-600">L</span>
                {needsVolume && !volumeL && (
                  <span className="font-mono text-xs text-zinc-600">← enter to calculate</span>
                )}
              </div>
            )}

            {/* Math results */}
            {canShowMath && tsParams && (
              <>
                {enclosureType === 'sealed' && volumeL && (
                  <SealedResults ts={tsParams} volumeL={volumeL} />
                )}
                {enclosureType === 'ported' && volumeL && (
                  <PortedResults ts={tsParams} volumeL={volumeL} />
                )}
                {enclosureType === 'horn' && (
                  <HornResults ts={tsParams} slot={slot} />
                )}
              </>
            )}

            {/* No T/S params message */}
            {slot.driverDatabaseId && !tsParams && (
              <div className="mt-2 font-mono text-xs text-zinc-600">
                Driver missing T/S params — calculations unavailable
              </div>
            )}
          </div>

          <Separator className="bg-zinc-800" />

          {/* Horn / loading */}
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

// ── Active project chip ───────────────────────────────────────────────────────
function ActiveProjectChip({ id, onClear }: { id: string; onClear: () => void }) {
  const short = id.slice(0, 8);
  return (
    <div className="flex items-center justify-between font-mono text-xs py-1 px-2 rounded bg-zinc-800/60 border border-zinc-700/40 mb-3">
      <span className="text-zinc-400">◈ <span className="text-zinc-300">{short}…</span></span>
      <button onClick={onClear} className="text-zinc-600 hover:text-zinc-400 ml-2">✕</button>
    </div>
  );
}

// ── Inner workspace (needs useSearchParams → must be inside Suspense) ─────────
function WorkspaceInner() {
  const searchParams = useSearchParams();
  const { state, isLoading, saveStatus, updateWay, setNumWays, setActiveProject } = useDesignStatePersistence(WORKSPACE_PROJECT_ID);

  // On mount, pick up ?activeProject= from T04 navigation and persist it
  useEffect(() => {
    const incoming = searchParams.get('activeProject');
    if (incoming && state && state.activeVituixcadProjectId !== incoming) {
      setActiveProject(incoming);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, state === null]);

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

  const { numWays, slots, activeVituixcadProjectId } = state;

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

        {/* Active VituixCAD project */}
        {activeVituixcadProjectId && (
          <div className="mb-4">
            <div className="font-mono text-xs text-zinc-500 mb-1">Active Project</div>
            <ActiveProjectChip
              id={activeVituixcadProjectId}
              onClear={() => setActiveProject(null)}
            />
          </div>
        )}

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

// ── Default export — Suspense wrapper required for useSearchParams ─────────────
export default function WorkspacePage() {
  return (
    <Suspense fallback={
      <div className="h-[calc(100vh-48px)] grid overflow-hidden" style={{ gridTemplateColumns: '220px 1fr 380px' }}>
        <div className="border-r border-zinc-800 p-4 bg-zinc-950 space-y-3 animate-pulse">
          <div className="h-3 bg-zinc-800 rounded w-24" />
          <div className="h-3 bg-zinc-800 rounded w-16" />
        </div>
        <div className="p-4 bg-zinc-950/50 space-y-3 animate-pulse">
          <div className="h-12 bg-zinc-800 rounded" />
        </div>
        <div className="border-l border-zinc-800 bg-zinc-950" />
      </div>
    }>
      <WorkspaceInner />
    </Suspense>
  );
}
