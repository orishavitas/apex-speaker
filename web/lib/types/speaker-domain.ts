// Canonical domain model for APEX speaker design
// All types, enums, and interfaces used across agents, UI, and math

// ── Enums ─────────────────────────────────────────────────────────────────────

export type DriverRole = 'woofer' | 'mid' | 'tweeter' | 'supertweeter';
export type WayCount = 2 | 3 | 4;

export type EnclosureType =
  | 'sealed'
  | 'ported'
  | 'passive_radiator'
  | 'open_baffle'
  | 'horn';

export type HornProfile =
  | 'tractrix'
  | 'exponential'
  | 'conical'
  | 'oblate_spheroidal'
  | 'le_cleach';

export type WaveguideProfile = 'waveguide' | 'transmission_line';

export type LoadingVariant = HornProfile | WaveguideProfile | 'direct_radiator';

// ── Thiele-Small (canonical, unit-suffixed) ──────────────────────────────────

export interface ThieleSmallParams {
  Re_ohms: number;
  Le_mH: number;
  Mms_g: number;
  Cms_mmPerN: number;
  Rms_kgPerS: number;
  Sd_cm2: number;
  Xmax_mm: number;
  BL_Tm: number;
  fs_hz: number;
  Qts: number;
  Qes: number;
  Qms: number;
  SPL_1w1m_dB: number;
  Pmax_W: number;
  Vas_L?: number;
}

export function isCompleteThieleSmall(p: Partial<ThieleSmallParams>): p is ThieleSmallParams {
  const required: Array<keyof ThieleSmallParams> = [
    'Re_ohms', 'Le_mH', 'Mms_g', 'Cms_mmPerN', 'Rms_kgPerS',
    'Sd_cm2', 'Xmax_mm', 'BL_Tm', 'fs_hz', 'Qts', 'Qes', 'Qms',
    'SPL_1w1m_dB', 'Pmax_W',
  ];
  return required.every(k => p[k] !== undefined && p[k] !== null);
}

// ── Loading configs (discriminated union) ────────────────────────────────────

export interface DirectRadiatorConfig {
  variant: 'direct_radiator';
}

export interface HornConfig {
  variant: HornProfile;
  throat_area_cm2: number;
  mouth_area_cm2: number;
  length_mm: number;
  cutoff_hz: number;
  coverage_h_deg: number;
  coverage_v_deg: number;
}

export interface WaveguideConfig {
  variant: 'waveguide';
  mouth_area_cm2: number;
  coverage_h_deg: number;
  coverage_v_deg: number;
  depth_mm: number;
}

export interface TransmissionLineConfig {
  variant: 'transmission_line';
  line_length_mm: number;
  line_area_cm2: number;
  stuffing_density_kg_m3: number;
  tuning_hz: number;
}

export type LoadingConfig =
  | DirectRadiatorConfig
  | HornConfig
  | WaveguideConfig
  | TransmissionLineConfig;

// ── Driver slot ───────────────────────────────────────────────────────────────

export interface DriverSlot {
  slot_id: string;
  driver_db_id?: string;
  thiele_small?: ThieleSmallParams;
  quantity: number;
  wiring: 'series' | 'parallel' | 'series_parallel';
}

// ── Way ───────────────────────────────────────────────────────────────────────

export interface Way {
  way_index: number;
  role: DriverRole;
  crossover_low_hz?: number;
  crossover_high_hz?: number;
  loading: LoadingConfig;
  drivers: DriverSlot[];
}

// ── Enclosure ─────────────────────────────────────────────────────────────────

export interface EnclosureConfig {
  type: EnclosureType;
  net_volume_L: number;
  port_count?: number;
  port_diameter_mm?: number;
  port_length_mm?: number;
}

// ── Top-level speaker config ──────────────────────────────────────────────────

export interface SpeakerConfig {
  project_id: string;
  name: string;
  way_count: WayCount;
  ways: Way[];
  enclosure: EnclosureConfig;
  target_impedance_ohms: 4 | 6 | 8 | 16;
  notes?: string;
  vxp_source_path?: string;
  created_at: string;
  updated_at: string;
}

// ── Design state (stored in DB, read by UI + agents) ─────────────────────────

export interface WaySlot {
  wayIndex: number;
  role: DriverRole;
  driverDatabaseId: string | null;
  crossoverFreqHz: number | null;
  enclosureType: EnclosureType;
  loading: LoadingConfig;
}

export interface DesignState {
  projectId: string;
  numWays: WayCount;
  waysConfig: WaySlot[];
  cabinetVolumeLiters?: number;
  cabinetMaterialMm?: number;
  activeVituixcadProjectId?: string | null;
  version: number;
}

export function defaultWaySlot(wayIndex: number): WaySlot {
  const roles: DriverRole[] = ['woofer', 'mid', 'tweeter', 'supertweeter'];
  return {
    wayIndex,
    role: roles[wayIndex] ?? 'mid',
    driverDatabaseId: null,
    crossoverFreqHz: null,
    enclosureType: 'sealed',
    loading: { variant: 'direct_radiator' },
  };
}

export function defaultDesignState(projectId: string, numWays: WayCount = 2): DesignState {
  return {
    projectId,
    numWays,
    waysConfig: Array.from({ length: numWays }, (_, i) => defaultWaySlot(i)),
    version: 1,
  };
}
