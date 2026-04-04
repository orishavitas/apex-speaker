// Wizard profile — parsed from agent_memory, never shown to user
// Experience level is internal only and never returned to the client.

export interface WizardProfile {
  budget_low?: number;       // USD
  budget_high?: number;      // USD
  placement?: string;        // e.g. "bookshelf", "floor", "desktop"
  use_case?: string;         // e.g. "music", "tv", "studio"
  sound_signature?: string;  // e.g. "warm", "flat", "bright"
  experience_level?: 1 | 2 | 3 | 4 | 5;  // NEVER returned to client
}

export interface ProjectedBuild {
  topology: string;          // e.g. "2-way bookshelf"
  woofer_size: string;       // e.g. "~5\" woofer"
  tweeter: string;           // e.g. "1\" dome tweeter"
  enclosure: string;         // e.g. "sealed or small ported"
  f3_est_hz_low: number;
  f3_est_hz_high: number;
  sensitivity_low: number;
  sensitivity_high: number;
  cabinet_budget_usd: number;
}

/** Count how many signals are captured with reasonable confidence */
export function profileConfidence(p: WizardProfile): number {
  let count = 0;
  if (p.budget_low !== undefined) count++;
  if (p.placement) count++;
  if (p.use_case) count++;
  if (p.sound_signature) count++;
  if (p.experience_level !== undefined) count++;
  return count;
}

/** True when wizard has enough to fire the confirmation gate */
export function isProfileComplete(p: WizardProfile): boolean {
  return profileConfidence(p) >= 5;
}

/** Derive a projected build from the profile */
export function deriveProjectedBuild(p: WizardProfile): ProjectedBuild | null {
  if (!p.budget_low || !p.placement) return null;

  const totalBudget = p.budget_high ?? p.budget_low * 1.3;
  const driverBudget = Math.round(totalBudget * 0.6);
  const cabinetBudget = totalBudget - driverBudget;

  const isFloor = p.placement?.includes('floor') || p.placement?.includes('living room');

  const topology = isFloor ? '2-way floorstanding' : '2-way bookshelf';
  const wooferSize = isFloor ? '~6.5" woofer' : '~5" woofer';
  const f3Low = isFloor ? 45 : 65;
  const f3High = isFloor ? 60 : 80;
  const sensLow = driverBudget > 150 ? 86 : 84;
  const sensHigh = sensLow + 3;

  const warmSig = p.sound_signature?.includes('warm') || p.sound_signature?.includes('bass');
  const enclosure = warmSig ? 'ported' : 'sealed or small ported';

  return {
    topology,
    woofer_size: wooferSize,
    tweeter: '1" dome tweeter',
    enclosure,
    f3_est_hz_low: f3Low,
    f3_est_hz_high: f3High,
    sensitivity_low: sensLow,
    sensitivity_high: sensHigh,
    cabinet_budget_usd: Math.round(cabinetBudget),
  };
}

/** Complexity dot rating string */
export function complexityDots(level: 1 | 2 | 3 | 4 | 5): string {
  return '●'.repeat(level) + '○'.repeat(5 - level);
}

/** Serialize profile for agent_memory storage */
export function serializeProfile(p: WizardProfile): string {
  return JSON.stringify(p);
}

/** Deserialize profile from agent_memory value */
export function deserializeProfile(raw: string): WizardProfile {
  try { return JSON.parse(raw) as WizardProfile; }
  catch { return {}; }
}
