"use client";

interface PublicProfile {
  budget_low?: number;
  budget_high?: number;
  placement?: string;
  use_case?: string;
  sound_signature?: string;
  room_size?: string;
  amplifier?: string;
}

interface ProjectedBuild {
  topology: string;
  woofer_size: string;
  tweeter: string;
  enclosure: string;
  f3_est_hz_low: number;
  f3_est_hz_high: number;
  sensitivity_low: number;
  sensitivity_high: number;
  cabinet_budget_usd: number;
}

interface WizardPaneProps {
  profile: PublicProfile | null;
  build: ProjectedBuild | null;
}

function PaneRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="font-mono text-xs text-zinc-500 w-24 shrink-0">{label}</span>
      <span className="font-mono text-xs text-zinc-200 text-right">{value}</span>
    </div>
  );
}

export function WizardPane({ profile, build }: WizardPaneProps) {
  const budgetStr = profile?.budget_low
    ? profile.budget_high
      ? `$${profile.budget_low}–${profile.budget_high}`
      : `~$${profile.budget_low}`
    : "···";

  return (
    <div className="h-full flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Profile signals */}
      <div>
        <div className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-2">
          Profile
        </div>
        <PaneRow label="BUDGET"    value={budgetStr} />
        <PaneRow label="PLACEMENT" value={profile?.placement ?? "···"} />
        <PaneRow label="USE CASE"  value={profile?.use_case ?? "···"} />
        <PaneRow label="SOUND SIG" value={profile?.sound_signature ?? "···"} />
        <PaneRow label="ROOM SIZE" value={profile?.room_size ?? "···"} />
        <PaneRow label="AMPLIFIER" value={profile?.amplifier ?? "···"} />
      </div>

      {/* Projected build */}
      {build && (
        <>
          <div className="border-t border-zinc-800" />
          <div>
            <div className="font-mono text-xs text-zinc-500 uppercase tracking-wider mb-2">
              Projected Build
            </div>
            <div className="font-mono text-xs text-zinc-400 leading-relaxed space-y-0.5 mb-2">
              <div className="text-zinc-200">{build.topology}</div>
              <div>{build.woofer_size} + {build.tweeter}</div>
              <div>{build.enclosure}</div>
            </div>
            <PaneRow label="est. f3"     value={`${build.f3_est_hz_low}–${build.f3_est_hz_high} Hz`} />
            <PaneRow label="sensitivity" value={`${build.sensitivity_low}–${build.sensitivity_high} dB`} />
            <PaneRow label="cabinet $"  value={`~$${build.cabinet_budget_usd}`} />
          </div>
        </>
      )}

      {!build && (
        <div className="font-mono text-xs text-zinc-700 text-center pt-8">
          projected build appears here as we talk...
        </div>
      )}
    </div>
  );
}
