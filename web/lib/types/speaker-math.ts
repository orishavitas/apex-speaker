// Loudspeaker enclosure math — Phase B implementation.
// Thiele-Small based calculations for sealed, ported, and horn-loaded enclosures.
// Do NOT change function signatures (Phase A contract).

import type { ThieleSmallParams, EnclosureConfig, LoadingConfig, HornProfile } from './speaker-domain';

export interface SealedBoxResult {
  Qtc: number;
  f3_hz: number;
  fb_hz: number;
  peak_dB: number;
}

export interface PortedBoxResult {
  fb_hz: number;
  f3_hz: number;
  group_delay_ms: number;
  port_velocity_ms: number;
}

export interface HornResult {
  fc_hz: number;
  efficiency_pct: number;
  mouth_loading_dB: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Vas in litres → m³
function vasM3(ts: ThieleSmallParams): number {
  // If Vas_L provided, use it. Otherwise derive from T/S params.
  if (ts.Vas_L !== undefined) return ts.Vas_L * 1e-3;
  // Vas = ρ₀ * c² * Sd² * Cms
  // ρ₀ = 1.18 kg/m³, c = 343 m/s, Sd in m², Cms in m/N
  const rho = 1.18;
  const c = 343;
  const Sd_m2 = ts.Sd_cm2 * 1e-4;
  const Cms_mPerN = ts.Cms_mmPerN * 1e-3;
  return rho * c * c * Sd_m2 * Sd_m2 * Cms_mPerN;
}

// Compliance ratio α = Vas / Vb
function alpha(ts: ThieleSmallParams, vb_L: number): number {
  return vasM3(ts) / (vb_L * 1e-3);
}

// ── Sealed box ────────────────────────────────────────────────────────────────
//
// Qtc = Qts * √(1 + α)              — system Q
// fb  = fs  * √(1 + α)              — system resonance
// f3  = fb  * [(1/(2*Qtc²) - 1) + √((1/(2*Qtc²) - 1)² + 1)]^(1/2)
// peak_dB = 0 for Qtc ≤ 1/√2 (Butterworth), positive for higher Qtc
//
// Reference: Thiele, "Loudspeakers in Vented Boxes" (JAES 1971)

export function calcSealedBox(
  ts: ThieleSmallParams,
  enclosure: EnclosureConfig,
): SealedBoxResult {
  const a = alpha(ts, enclosure.net_volume_L);
  const Qtc = ts.Qts * Math.sqrt(1 + a);
  const fb_hz = ts.fs_hz * Math.sqrt(1 + a);

  // -3dB frequency from sealed box transfer function
  // H(s) = s² / (s² + s·ωb/Qtc + ωb²)
  // |H(jω)|² = 1/2 at f3
  // f3/fb = [(1/(2Qtc²) - 1) + √((1/(2Qtc²) - 1)² + 1)]^(1/2)
  const x = 1 / (2 * Qtc * Qtc) - 1;
  const f3_ratio = Math.sqrt(x + Math.sqrt(x * x + 1));
  const f3_hz = fb_hz * f3_ratio;

  // Peak response above Qtc = 1/√2 ≈ 0.707
  // peak_dB = 20·log10(Qtc² / √(Qtc⁴ - 0.25))  for Qtc > 1/√2
  let peak_dB = 0;
  const butterworth_q = 1 / Math.SQRT2;
  if (Qtc > butterworth_q) {
    const q4 = Qtc * Qtc * Qtc * Qtc;
    if (q4 > 0.25) {
      peak_dB = 20 * Math.log10((Qtc * Qtc) / Math.sqrt(q4 - 0.25));
    }
  }

  return {
    Qtc: round(Qtc, 3),
    f3_hz: round(f3_hz, 1),
    fb_hz: round(fb_hz, 1),
    peak_dB: round(peak_dB, 2),
  };
}

// ── Ported box (vented, bass-reflex) ─────────────────────────────────────────
//
// Butterworth B4 (4th-order) alignment: Qtc_target ≈ 0.383, α = Vas/(h·Vb)
// where h = (fb/fs)² for a given alignment.
//
// For a given Vb: fb = fs * √(α/Qts) (simplified from Thiele alignment tables)
//
// General closed-form (approximate, Thiele B4 alignment):
//   fb = fs * (Vas / Vb)^(1/n)  where n varies by alignment
//
// We use the standard Thiele/Small approach:
//   fb = fs * √α  (for B4 where α chosen to give Qt ≈ 0.38)
//   f3 ≈ 0.707 * fb  (B4 alignment passband edge)
//   group_delay at fb ≈ 1/(π·fb) * (1 + Qtc²) seconds
//   port_velocity = Qts * fs * Xmax * 100 / (port_area_cm2 * fb)
//
// Reference: Small, "Vented-Box Loudspeaker Systems" (JAES 1973)

export function calcPortedBox(
  ts: ThieleSmallParams,
  enclosure: EnclosureConfig,
): PortedBoxResult {
  const a = alpha(ts, enclosure.net_volume_L);

  // Tuning frequency (port resonance) — for Butterworth B4: fb = fs * α^0.32
  // More precisely: fb chosen so system is critically damped at the alignment
  // Using h = (Qts/0.383)^2 correction factor for non-ideal Qts:
  const h = (ts.Qts / 0.383) * (ts.Qts / 0.383);
  const fb_hz = ts.fs_hz * Math.sqrt(a * h);

  // f3 for ported box (B4 alignment: f3 ≈ fb for low Qts drivers)
  // From transfer function: -3dB point is approximately at fb for B4
  // More accurate: f3/fb ≈ (1 + 1/(4·Qts²))^(1/2)
  const f3_hz = fb_hz * Math.sqrt(1 + 1 / (4 * ts.Qts * ts.Qts));

  // Group delay at fb: GD_max ≈ 1/(π·fb) × (1 + Qtc²)
  // Use Qtc_ported ≈ Qts × √(1 + a)/h (approximation)
  const Qtc_eff = ts.Qts * Math.sqrt((1 + a) / h);
  const group_delay_ms = (1000 / (Math.PI * fb_hz)) * (1 + Qtc_eff * Qtc_eff);

  // Port air velocity at Xmax (peak):
  // v_port = (Sd × Xmax × fs²) / (port_area × fb)
  // Using port diameter if provided, otherwise estimate from volume
  let port_area_cm2: number;
  if (enclosure.port_diameter_mm && enclosure.port_count) {
    const r_cm = (enclosure.port_diameter_mm / 10) / 2;
    port_area_cm2 = Math.PI * r_cm * r_cm * enclosure.port_count;
  } else {
    // Rule of thumb: port area ≈ 0.5 × Sd for B4 alignment
    port_area_cm2 = 0.5 * ts.Sd_cm2;
  }
  const Sd_cm2 = ts.Sd_cm2;
  const Xmax_cm = ts.Xmax_mm / 10;
  // Peak displacement volume flow / port area
  const port_velocity_ms = (Sd_cm2 * Xmax_cm * ts.fs_hz * ts.fs_hz) /
    (port_area_cm2 * fb_hz) * 0.01; // convert cm/s → m/s scaling

  return {
    fb_hz: round(fb_hz, 1),
    f3_hz: round(f3_hz, 1),
    group_delay_ms: round(group_delay_ms, 1),
    port_velocity_ms: round(Math.abs(port_velocity_ms), 2),
  };
}

// ── Horn loading ───────────────────────────────────────────────────────────────
//
// Horn cutoff frequency (for exponential-family horns):
//   fc = c / (π × mouth_diameter)   — mouth loading cutoff
//
// Throat efficiency (Klipsch/Horn acoustic theory):
//   η = (ρ₀ × c × BL²) / (2π × Mms × Re × fs)  [approximate]
//   More precisely: η₀ = (9.78 × 10⁻¹⁰ × fs³ × Vas) / (Qes) [from T/S]
//   η_dB = 10 × log10(η₀)  (reference efficiency in half-space)
//
// Mouth loading (radiation resistance at cutoff):
//   ΔdB ≈ -6 dB per octave below fc (6dB/oct rolloff from mouth loading)
//   At fc: mouth_loading_dB = -3 dB (half-power point)
//
// Profile-specific cutoff:
//   Exponential: fc_exp = c/(π·Dm), horn flare constant m = c/(2π·fc)
//   Tractrix:    fc_tractrix ≈ 0.9 × fc_exp (slightly lower due to profile)
//   Conical:     fc_conical ≈ c·n/(2π·L) where n = 1 for monopole
//   OS/Oblate:   fc ≈ c/(2·Dm) (more aggressive loading)
//   Le Cléach:   fc ≈ 0.85 × fc_exp (optimized for low distortion)
//
// Reference: Klipsch (1941), Keele (1975), Geddes (2002)

export function calcHornLoading(
  ts: ThieleSmallParams,
  horn: Extract<LoadingConfig, { variant: HornProfile }>,
): HornResult {
  const c = 343; // speed of sound m/s
  const rho = 1.18; // air density kg/m³

  // Mouth diameter from area
  const mouth_area_m2 = (horn as { mouth_area_cm2: number }).mouth_area_cm2 * 1e-4;
  const mouth_diam_m = 2 * Math.sqrt(mouth_area_m2 / Math.PI);

  // Base exponential cutoff
  const fc_exp = c / (Math.PI * mouth_diam_m);

  // Profile correction factor
  const profile = horn.variant as HornProfile;
  const profileFactor: Record<HornProfile, number> = {
    exponential:       1.00,
    tractrix:          0.90,
    conical:           1.15,
    oblate_spheroidal: 0.75,
    le_cleach:         0.85,
  };
  const fc_hz = fc_exp * (profileFactor[profile] ?? 1.0);

  // Reference efficiency from T/S (Thiele 1971 formula):
  // η₀ = (9.78e-10 × fs³ × Vas_m3) / Qes
  const Vas_m3 = vasM3(ts);
  const eta_0 = (9.78e-10 * Math.pow(ts.fs_hz, 3) * Vas_m3) / ts.Qes;
  // Horn loading increases efficiency by reducing Mms radiation load
  // Throat area ratio boosts efficiency: η_horn ≈ η₀ × (Sd / throat_area)
  const throat_area_m2 = (horn as { throat_area_cm2: number }).throat_area_cm2 * 1e-4;
  const Sd_m2 = ts.Sd_cm2 * 1e-4;
  const coupling = Math.min(Sd_m2 / throat_area_m2, 10); // cap at 10× for sanity
  const eta_horn = eta_0 * coupling;
  // Clamp to realistic range (0.1% – 50%)
  const efficiency_pct = Math.min(Math.max(eta_horn * 100, 0.1), 50);

  // Mouth loading: radiation resistance rolls off below fc
  // At fc the driver sees ~half the mouth radiation resistance → -3 dB
  // Express as the dB penalty at fc relative to passband
  const mouth_loading_dB = -3.0; // by definition at cutoff

  return {
    fc_hz: round(fc_hz, 1),
    efficiency_pct: round(efficiency_pct, 2),
    mouth_loading_dB: round(mouth_loading_dB, 1),
  };
}

// ── Utility ────────────────────────────────────────────────────────────────────

function round(n: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(n * f) / f;
}

// ── Interpretation helpers (used by UI) ──────────────────────────────────────

export function sealedBoxQuality(Qtc: number): string {
  if (Qtc < 0.5)  return 'Over-damped — very flat, sluggish bass';
  if (Qtc < 0.65) return 'Slightly damped — extended low end';
  if (Qtc < 0.75) return 'Near-Butterworth — flat response, optimal';
  if (Qtc < 0.90) return 'Chebyshev — slight lift, subjectively punchy';
  if (Qtc < 1.20) return 'Under-damped — audible peak, boomy';
  return 'Severely under-damped — not recommended';
}

export function portVelocityWarning(v_ms: number): string | null {
  if (v_ms > 20) return `Port velocity ${v_ms} m/s — chuffing likely, increase port diameter`;
  if (v_ms > 15) return `Port velocity ${v_ms} m/s — marginal, consider larger port`;
  return null;
}
