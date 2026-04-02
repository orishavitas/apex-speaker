# Section 5 — Acoustic Math Foundation (Phase A → B Bridge)

**Status:** Approved for Phase A implementation
**Owner:** Ori Shavit
**Last updated:** 2026-03-28
**Depends on:** Section 4 (Agent Architecture), System Spec §Phase 3

---

## 5.0 Purpose of This Section

Phase A agents reason about loudspeaker design using domain knowledge and RAG. They do not run simulation math — they explain it, discuss it, and interpret results. Phase B will add actual numerical computation (real transfer functions, real SPL summation, real enclosure modeling). Phase C will add a full simulation engine capable of replacing VituixCAD for common tasks.

The problem: if Phase A and Phase B define their own data shapes independently, integration will be a migration project. This section prevents that by defining the **shared data layer** now. All types, interfaces, and structural conventions are established in Phase A as TypeScript definitions. Phase A agents work with these shapes. Phase B simulation engines implement against them. Phase C extends them.

This section covers:
1. Canonical unit system
2. Primitive acoustic types (frequency arrays, T/S parameters, impedance)
3. Design compound types (enclosure, crossover, driver, full speaker design)
4. The abstract `SimulationEngine` interface that Phase B implements
5. Phase A stub implementation (returns typed placeholders; agents can reference shapes)
6. Phase B implementation roadmap
7. Standard alignment presets (B4, QB3, SC4, C4)

---

## 5.1 Canonical Unit System

All values in this system use SI-derived units unless explicitly noted. Units are enforced via naming convention, not runtime validation (TypeScript types carry no runtime unit information — this is a developer contract).

| Quantity | Unit | Abbreviation | Notes |
|----------|------|--------------|-------|
| Frequency | Hertz | Hz | Linear scale in arrays; log scale for display |
| SPL | Decibels SPL | dB | Relative to 20 µPa, 1W/1m unless stated |
| Phase | Degrees | deg | −180 to +180; unwrapped where noted |
| Impedance magnitude | Ohms | Ω | |
| Impedance phase | Degrees | deg | |
| Volume | Liters | L | Enclosure volume, Vas |
| Length | Millimeters | mm | Port length, driver Xmax, cone diameter |
| Area | Square centimeters | cm² | Sd (piston area) |
| Mass | Grams | g | Mms (moving mass) |
| Compliance | mm/N | mm/N | Cms |
| BL product | Tesla·meters | T·m | |
| Voice coil inductance | Millihenries | mH | Le |
| Voice coil resistance | Ohms | Ω | Re, Rdc |
| Capacitor value | Microfarads | µF | Crossover components |
| Inductor value | Millihenries | mH | Crossover components |
| Resistor value | Ohms | Ω | Crossover components |
| Power | Watts | W | |
| Sensitivity | dB SPL | dB (1W/1m) | |

**Array frequency grids:** All frequency response arrays use the same frequency axis by convention. The standard simulation grid is 96 points per decade from 10 Hz to 40 kHz (ISO preferred third-octave extended). For display, the UI may resample to 1/3 octave. For computation, linear or log-spaced grids are both valid — the `FrequencyGrid` type captures which is in use.

---

## 5.2 Primitive Acoustic Types

### 5.2.1 FrequencyGrid

The shared frequency axis used by all response arrays. Both parties (producer and consumer) must use the same grid for array operations to be meaningful.

```typescript
/**
 * Defines the frequency axis shared by FrequencyResponse and ImpedanceResponse arrays.
 * All array operations (summing, filtering, comparing) require identical grids.
 */
export type FrequencyGridSpacing = 'linear' | 'log' | 'iso-third-octave';

export interface FrequencyGrid {
  /** Frequency values in Hz, ascending. Length determines all response array lengths. */
  frequencies_hz: number[];

  /** How the points are spaced. Determines valid interpolation methods. */
  spacing: FrequencyGridSpacing;

  /** Lowest frequency in the grid, Hz. */
  f_min_hz: number;

  /** Highest frequency in the grid, Hz. */
  f_max_hz: number;

  /** Number of frequency points. Must equal frequencies_hz.length. */
  point_count: number;
}

/**
 * Standard 96-point-per-decade grid from 10 Hz to 40 kHz.
 * This is the default for all simulation outputs.
 */
export const STANDARD_GRID_96PPD: FrequencyGrid = {
  frequencies_hz: [], // populated at runtime by buildStandardGrid()
  spacing: 'log',
  f_min_hz: 10,
  f_max_hz: 40_000,
  point_count: 317, // 96 * log10(40000/10) ≈ 317 points
};
```

### 5.2.2 FrequencyResponse

The core output type for SPL simulation. Every simulation result — enclosure response, crossover transfer function, summed system response — is a `FrequencyResponse`.

```typescript
/**
 * Acoustic frequency response: SPL magnitude and phase at each frequency point.
 *
 * Units:
 *   magnitude_db: dB SPL, referenced to 1W/1m unless noted in metadata.
 *   phase_deg:    degrees, range −180 to +180. Unwrapped if unwrapped_phase is true.
 *
 * Array invariant: all three arrays have identical length equal to grid.point_count.
 */
export interface FrequencyResponse {
  grid: FrequencyGrid;

  /** SPL in dB at each frequency. Array length === grid.point_count. */
  magnitude_db: number[];

  /**
   * Phase in degrees at each frequency. Array length === grid.point_count.
   * Phase is wrapped to (−180, +180] unless unwrapped_phase is true.
   */
  phase_deg: number[];

  /** If true, phase array has been unwrapped (no discontinuities). Default: false. */
  unwrapped_phase?: boolean;

  /** Reference sensitivity level in dB (e.g., 87.5 dB 1W/1m). Null if not applicable. */
  reference_sensitivity_db?: number;

  /** Measurement or simulation distance in meters. Default: 1.0 (1 meter). */
  reference_distance_m?: number;

  /** Human-readable label for plots and reports. */
  label?: string;

  /** Which driver, crossover stage, or system this represents. */
  source_id?: string;

  metadata?: FrequencyResponseMetadata;
}

export interface FrequencyResponseMetadata {
  /** 'simulated' | 'measured' | 'stub' */
  data_origin: 'simulated' | 'measured' | 'stub';

  /** ISO 8601 timestamp of when this was computed or measured. */
  computed_at?: string;

  /** Which SimulationEngine implementation produced this. */
  engine_id?: string;

  /** Any warnings produced during computation (e.g., ported box below Fb). */
  warnings?: string[];
}
```

### 5.2.3 ImpedanceResponse

The electrical impedance of a driver or driver-plus-crossover network, measured or simulated across frequency.

```typescript
/**
 * Electrical impedance response.
 *
 * Units:
 *   magnitude_ohms: absolute impedance magnitude in Ohms.
 *   phase_deg:      impedance phase angle in degrees.
 *
 * Array invariant: both arrays have identical length equal to grid.point_count.
 */
export interface ImpedanceResponse {
  grid: FrequencyGrid;

  /** Impedance magnitude in Ohms at each frequency. */
  magnitude_ohms: number[];

  /** Impedance phase in degrees at each frequency. Wrapped to (−180, +180]. */
  phase_deg: number[];

  /** Nominal impedance rating (e.g., 4, 6, 8 Ohms). */
  nominal_impedance_ohms?: number;

  /** Minimum impedance across the frequency range. */
  minimum_impedance_ohms?: number;

  /** Frequency at which minimum impedance occurs, Hz. */
  minimum_impedance_freq_hz?: number;

  /** Human-readable label. */
  label?: string;

  metadata?: {
    data_origin: 'simulated' | 'measured' | 'stub';
    computed_at?: string;
    engine_id?: string;
    warnings?: string[];
  };
}
```

### 5.2.4 ThieleSmallParams

The complete set of Thiele-Small electromechanical parameters that characterize a driver's behavior in free air and in a given enclosure.

```typescript
/**
 * Thiele-Small electromechanical parameters for a loudspeaker driver.
 *
 * All parameters are free-air values unless enclosure_corrected is true.
 * Sources: manufacturer datasheet, measurement, or estimation from partial data.
 *
 * Units are specified inline per parameter — see Section 5.1 for unit table.
 */
export interface ThieleSmallParams {
  // --- Electrical ---

  /** DC voice coil resistance, Ohms. Also called Rdc. */
  Re_ohms: number;

  /** Voice coil inductance at 1 kHz (or Le_freq_hz if specified), mH. */
  Le_mH: number;

  /** Frequency at which Le was measured, Hz. Default 1000. */
  Le_freq_hz?: number;

  // --- Resonance ---

  /** Free-air resonant frequency, Hz. */
  fs_hz: number;

  /** Mechanical Q factor at fs. */
  Qms: number;

  /** Electrical Q factor at fs. */
  Qes: number;

  /**
   * Total Q factor at fs. Defined as: Qts = (Qms * Qes) / (Qms + Qes).
   * Should equal computed value ±0.02; flag discrepancies.
   */
  Qts: number;

  // --- Mechanical ---

  /**
   * Equivalent acoustic volume of driver suspension compliance, Liters.
   * The volume of air with the same compliance as the driver's suspension.
   */
  Vas_liters: number;

  /**
   * Effective piston radiating area, cm².
   * Sd = π * (effective_radius_cm)²
   */
  Sd_cm2: number;

  /** Force factor (magnetic flux density × voice coil length), T·m. */
  BL_Tm: number;

  /** Moving mass of cone + coil + air load (free air), grams. */
  Mms_g: number;

  /** Mechanical compliance of suspension, mm/N. */
  Cms_mmPerN: number;

  /** Peak one-way linear excursion (coil within gap), mm. */
  Xmax_mm: number;

  // --- Derived / Optional ---

  /** Reference sensitivity, dB SPL at 1W/1m. Derived from T/S if not provided. */
  sensitivity_dB?: number;

  /**
   * Effective mechanical compliance radius, mm.
   * Used for Sd computation when area is not directly available.
   */
  effective_radius_mm?: number;

  /** Voice coil diameter, mm. */
  voice_coil_diameter_mm?: number;

  /** Nominal power handling, Watts. */
  power_handling_W?: number;

  /** Whether these are factory-measured, owner-measured, or estimated. */
  source?: 'datasheet' | 'measured' | 'estimated';

  /** If true, Qes/Qts already include enclosure back-pressure corrections. */
  enclosure_corrected?: boolean;
}
```

---

## 5.3 Design Compound Types

### 5.3.1 EnclosureDesign

```typescript
export type EnclosureType = 'sealed' | 'ported' | 'passive_radiator' | 'bandpass_4th' | 'bandpass_6th' | 'open_baffle' | 'transmission_line';

export type PortShape = 'round' | 'slot' | 'aero';

/**
 * Physical and acoustic description of an enclosure.
 *
 * For sealed boxes: only volume_net_liters is required.
 * For ported boxes: volume_net_liters + tuning_freq_hz + at least one port geometry set.
 * For passive radiators: volume_net_liters + pr_params required.
 */
export interface EnclosureDesign {
  type: EnclosureType;

  /** Net internal volume after subtracting driver displacement and bracing, Liters. */
  volume_net_liters: number;

  /**
   * Gross internal volume (before subtractions), Liters.
   * Optional — used to document build dimensions separately from acoustic volume.
   */
  volume_gross_liters?: number;

  // --- Port / Tuning (ported boxes only) ---

  /** Helmholtz tuning frequency (Fb), Hz. Null for sealed boxes. */
  tuning_freq_hz?: number;

  /** Number of ports. Default: 1. */
  port_count?: number;

  port_geometry?: PortGeometry;

  // --- Passive Radiator (passive_radiator type only) ---

  pr_params?: PassiveRadiatorParams;

  // --- Damping ---

  /**
   * Internal damping material fill fraction.
   * 0.0 = empty; 0.5 = partially stuffed; 1.0 = fully stuffed.
   * Affects effective Vas and thus tuning.
   */
  damping_fill_fraction?: number;

  /** Type of damping material used. Informational. */
  damping_material?: 'acoustic_foam' | 'polyester_fill' | 'fiberglass' | 'acoustic_wool' | 'none';

  // --- Physical Construction ---

  /** Wall thickness, mm. Informational — does not affect simulation. */
  wall_thickness_mm?: number;

  /** Panel material. Informational. */
  panel_material?: 'mdf' | 'plywood' | 'hdf' | 'acrylic' | 'aluminum' | 'other';

  /** External dimensions (W × H × D), mm. Informational. */
  external_dims_mm?: { width: number; height: number; depth: number };

  /**
   * Named alignment this design targets.
   * Links to AlignmentPreset in Section 5.7.
   */
  target_alignment?: AlignmentPresetName;

  label?: string;
}

export interface PortGeometry {
  shape: PortShape;

  /** Inner diameter for round ports, mm. Null for slot ports. */
  diameter_mm?: number;

  /** Port length (acoustic), mm. */
  length_mm?: number;

  /** Slot width, mm. For slot ports only. */
  slot_width_mm?: number;

  /** Slot height, mm. For slot ports only. */
  slot_height_mm?: number;

  /** Flare radius at port ends, mm. 0 = sharp edge. */
  flare_radius_mm?: number;

  /** Port location on enclosure. Informational. */
  location?: 'front' | 'rear' | 'bottom' | 'side';
}

export interface PassiveRadiatorParams {
  /** PR moving mass, grams. */
  Mmp_g: number;

  /** PR compliance, mm/N. */
  Cms_mmPerN: number;

  /** PR effective piston area, cm². */
  Sd_cm2: number;

  /** PR resonant frequency (free air), Hz. */
  fpr_hz?: number;

  /** Number of passive radiators. Default: 1. */
  count?: number;
}
```

### 5.3.2 CrossoverComponent and CrossoverTopology

```typescript
export type CrossoverComponentType = 'capacitor' | 'inductor' | 'resistor' | 'transformer' | 'notch_filter';

export type CrossoverFilterType = 'low_pass' | 'high_pass' | 'band_pass' | 'notch' | 'all_pass' | 'shelving';

export type FilterAlignment = 'butterworth' | 'linkwitz_riley' | 'bessel' | 'chebyshev' | 'custom';

export type CrossoverNetworkType = 'passive' | 'active' | 'dsp';

/**
 * A single passive component in a crossover network.
 */
export interface CrossoverComponent {
  /** Component type determines unit interpretation. */
  type: CrossoverComponentType;

  /**
   * Component value.
   *   capacitor → µF
   *   inductor  → mH
   *   resistor  → Ohms
   */
  value: number;

  /**
   * Explicit unit label. Should match the canonical unit for this component type
   * per Section 5.1, but is carried explicitly to prevent ambiguity.
   *   capacitor → 'µF'
   *   inductor  → 'mH'
   *   resistor  → 'Ω'
   */
  unit: 'µF' | 'mH' | 'Ω';

  /** Reference designator (e.g., "C1", "L2", "R3"). For BOM and schematic. */
  part_id: string;

  /** Manufacturer part number. Optional but recommended for BOM generation. */
  manufacturer_part?: string;

  /** Tolerance, percent. E.g., 5 for ±5%. */
  tolerance_pct?: number;

  /** Maximum power rating, Watts. Important for resistors in high-power paths. */
  power_rating_W?: number;

  /** Note for schematic or BOM. */
  note?: string;
}

/**
 * A single filter stage within a crossover section.
 * One CrossoverSection = one driver branch (woofer, midrange, tweeter).
 */
export interface CrossoverSection {
  /** Which driver branch this section feeds. */
  driver_role: 'woofer' | 'midwoofer' | 'midrange' | 'tweeter' | 'supertweeter' | 'subwoofer';

  filter_type: CrossoverFilterType;

  /**
   * Filter order (slope):
   *   1 → 6 dB/oct
   *   2 → 12 dB/oct
   *   3 → 18 dB/oct
   *   4 → 24 dB/oct
   */
  order: 1 | 2 | 3 | 4;

  alignment: FilterAlignment;

  /** Nominal crossover frequency (−3 dB point for Butterworth; −6 dB for LR), Hz. */
  crossover_freq_hz: number;

  /** Polarity inversion applied to this branch. Default: false (normal polarity). */
  polarity_inverted?: boolean;

  /** All physical components in this section, in signal-path order. */
  components: CrossoverComponent[];

  /**
   * Zobel / impedance correction network components.
   * Separate from signal-path components; used to flatten driver impedance rise.
   */
  impedance_correction?: CrossoverComponent[];

  /**
   * Baffle step compensation network components.
   * Optional; applies a shelving correction for diffraction loss.
   */
  baffle_step_correction?: CrossoverComponent[];
}

/**
 * Complete crossover topology for a multi-way speaker.
 * Contains one CrossoverSection per driver.
 */
export interface CrossoverTopology {
  type: CrossoverNetworkType;

  /**
   * Number of ways (equals number of CrossoverSection entries).
   *   2 → woofer + tweeter
   *   3 → woofer + midrange + tweeter
   *   etc.
   */
  ways: 2 | 3 | 4;

  sections: CrossoverSection[];

  /**
   * For active crossovers: the frequency at which signal is split, per stage.
   * For passive: informational only (actual frequencies are in each section).
   */
  crossover_frequencies_hz?: number[];

  /**
   * Target system impedance, Ohms.
   * The crossover is designed to present this impedance to the amplifier.
   */
  nominal_impedance_ohms?: number;

  label?: string;
}
```

### 5.3.3 DriverSpec

```typescript
/**
 * Complete specification of a loudspeaker driver unit.
 * Extends ThieleSmallParams with identity and categorical data.
 */
export interface DriverSpec extends ThieleSmallParams {
  // --- Identity ---

  /** Manufacturer name (e.g., "Scanspeak", "Seas", "Dayton Audio"). */
  manufacturer: string;

  /** Model number or SKU (e.g., "D2904/9800+", "W18EX001"). */
  model: string;

  /** Human-readable name for display. */
  display_name?: string;

  // --- Classification ---

  driver_type: 'woofer' | 'midwoofer' | 'midrange' | 'tweeter' | 'fullrange' | 'subwoofer';

  /**
   * Transducer technology.
   * Determines valid frequency range and simulation models to apply.
   */
  transducer_type: 'dynamic' | 'ribbon' | 'planar_magnetic' | 'amt' | 'electrostatic';

  // --- Geometry ---

  /** Nominal cone diameter (frame OD), inches. Common convention in the industry. */
  nominal_diameter_inches?: number;

  /** Voice coil former diameter, mm. */
  former_diameter_mm?: number;

  // --- Ratings ---

  /** Nominal impedance, Ohms (e.g., 4, 6, 8). */
  nominal_impedance_ohms: number;

  /** RMS power handling, Watts. */
  power_handling_rms_W?: number;

  /** Peak power handling, Watts. */
  power_handling_peak_W?: number;

  // --- Frequency Response Data ---

  /**
   * Measured on-axis frequency response from manufacturer or third party.
   * If present, the simulation engine may blend measured + modeled data.
   */
  measured_response?: FrequencyResponse;

  /**
   * Measured impedance curve.
   * Preferred over T/S-derived impedance when available.
   */
  measured_impedance?: ImpedanceResponse;

  // --- Sourcing ---

  /** Approximate street price, USD. */
  price_usd?: number;

  /** Datasheet URL. */
  datasheet_url?: string;

  /** Where T/S parameters were sourced. */
  ts_source?: 'datasheet' | 'measured' | 'estimated';

  /** Date of last parameter measurement/verification, ISO 8601. */
  ts_measured_at?: string;
}
```

### 5.3.4 SpeakerDesign

The root type for a complete loudspeaker design. This is what agents and the simulation engine operate on as a whole unit.

```typescript
/**
 * A complete loudspeaker system design.
 * The root aggregate type — enclosure + drivers + crossover + targets.
 */
export interface SpeakerDesign {
  // --- Identity ---

  /** Unique identifier for this design. UUID recommended. */
  id: string;

  /** Human-readable project name. */
  name: string;

  /** Design version (e.g., "1.0", "2.3-beta"). */
  version: string;

  /** Design author or team. */
  author?: string;

  /** ISO 8601 creation timestamp. */
  created_at: string;

  /** ISO 8601 last-modified timestamp. */
  updated_at: string;

  // --- Configuration ---

  /**
   * Number of ways (must match crossover.ways and drivers.length).
   * Invariant: ways === crossover.ways === drivers.length
   */
  ways: 2 | 3 | 4;

  /** Channel configuration. 'stereo' = this spec describes one channel. */
  channel_config: 'mono' | 'stereo';

  // --- Core Design ---

  enclosure: EnclosureDesign;

  /**
   * Ordered list of drivers, from lowest to highest frequency.
   * Index 0: woofer. Last index: tweeter.
   * Length must match ways.
   */
  drivers: DriverSpec[];

  crossover: CrossoverTopology;

  // --- Performance Targets ---

  target_response?: DesignTargets;

  // --- Simulation Results Cache ---

  /**
   * Cached simulation outputs. Populated by SimulationEngine and stored
   * alongside the design. Agents can reference without re-running simulation.
   */
  simulation_cache?: SimulationCache;

  // --- Notes ---

  description?: string;
  design_notes?: string;
  revision_notes?: string;
}

/**
 * Performance targets that guide design decisions and simulation evaluation.
 */
export interface DesignTargets {
  /** Target −3 dB low-frequency extension, Hz. */
  f3_hz?: number;

  /** Target −6 dB low-frequency extension (for subwoofers / room gain environments), Hz. */
  f6_hz?: number;

  /** Target system sensitivity at 1W/1m, dB SPL. */
  sensitivity_dB?: number;

  /** Minimum acceptable impedance across band, Ohms. */
  min_impedance_ohms?: number;

  /** Target listening position (on-axis distance), meters. Default: 1.0. */
  listening_distance_m?: number;

  /**
   * Target in-room frequency response flatness, dB peak-to-peak
   * across the specified passband. E.g., ±3 dB from 80 Hz to 16 kHz.
   */
  flatness_tolerance_dB?: number;
  flatness_range_hz?: { low: number; high: number };

  /** Target maximum SPL at listening position, dB. */
  max_spl_dB?: number;
}

/**
 * Simulation results stored alongside a SpeakerDesign.
 * Populated by SimulationEngine; consumed by agents and the UI.
 */
export interface SimulationCache {
  /** Full system SPL response (summed through crossover). */
  system_response?: FrequencyResponse;

  /** Individual driver responses (through crossover, before summation). */
  driver_responses?: FrequencyResponse[];

  /** System impedance as seen by amplifier. */
  system_impedance?: ImpedanceResponse;

  /** Power response (spatially averaged). */
  power_response?: FrequencyResponse;

  /** Directivity Index (CTA-2034 DI curve). */
  directivity_index?: FrequencyResponse;

  /** Estimated in-room response. */
  predicted_in_room?: FrequencyResponse;

  /** ISO 8601 timestamp of last simulation run. */
  last_simulated_at?: string;

  /** Which engine produced this cache. */
  engine_id?: string;
}
```

---

## 5.4 The Abstract SimulationEngine Interface

This interface is the contract that Phase B implements. Phase A uses only the stub. The interface is intentionally narrow — it covers the six core operations that VituixCAD exposes. Additional operations (directivity simulation, room modeling) are deferred to Phase C.

```typescript
/**
 * Abstract simulation engine interface.
 *
 * Phase A: implemented by StubSimulationEngine (returns typed placeholders).
 * Phase B: implemented by VituixCadBridgeEngine or NativeAcousticsEngine.
 * Phase C: extended by FullSimulationEngine with directivity and room modeling.
 *
 * All methods are async to allow Phase B to call external tools (VituixCAD CLI,
 * Python subprocess, WASM module) without blocking.
 *
 * All methods accept an optional SimulationOptions bag for tuning behavior
 * (frequency grid override, verbose mode, cache bypass, etc.).
 */
export interface SimulationEngine {
  /** Stable identifier for this engine implementation. */
  readonly engine_id: string;

  /** Semantic version of this engine. Used for cache invalidation. */
  readonly version: string;

  /** Which operations this engine supports. Stub returns none. */
  readonly capabilities: SimulationCapability[];

  /**
   * Simulate the acoustic output of a driver in an enclosure.
   *
   * Returns the driver's on-axis SPL frequency response as it would measure
   * at 1W/1m with the given enclosure loading.
   *
   * Phase B implementation notes:
   *   - Sealed: use closed-box transfer function (Butterworth high-pass analogy)
   *   - Ported: include Helmholtz resonator response contribution
   *   - Passive radiator: treat as tuned mass resonator
   */
  simulateEnclosure(
    driver: DriverSpec,
    enclosure: EnclosureDesign,
    options?: SimulationOptions
  ): Promise<FrequencyResponse>;

  /**
   * Compute the transfer function of a crossover section.
   *
   * Returns the filter's amplitude and phase response at each frequency,
   * accounting for the driver's actual impedance curve (not just nominal Ohms).
   *
   * Phase B implementation notes:
   *   - Butterworth: H(s) = 1 / (s² + s√2 + 1) for 2nd order, normalized
   *   - Linkwitz-Riley: H(s) = [Butterworth(s)]² — cascaded 2nd order
   *   - Bessel: maximally flat group delay — use standard Bessel polynomials
   *   - Components interact with driver impedance; passive networks require
   *     driver_impedance to compute accurate filter shape
   */
  simulateCrossover(
    section: CrossoverSection,
    driver_impedance: ImpedanceResponse,
    options?: SimulationOptions
  ): Promise<FrequencyResponse>;

  /**
   * Sum multiple frequency responses into a single system response.
   *
   * Performs complex (magnitude + phase) vector addition at each frequency point.
   * All input responses must share an identical FrequencyGrid.
   *
   * Phase B implementation notes:
   *   - Convert dB magnitude + phase to complex: a + jb = 10^(mag/20) * e^(jφ)
   *   - Sum complex vectors per frequency bin
   *   - Convert back to dB magnitude and phase
   *   - Handle polarity inversion via 180° phase shift before summation
   */
  sumResponses(
    responses: FrequencyResponse[],
    options?: SimulationOptions
  ): Promise<FrequencyResponse>;

  /**
   * Calculate the electrical impedance of a driver + crossover network combination.
   *
   * Returns the impedance as the amplifier sees it — driver impedance transformed
   * by the passive crossover network.
   *
   * Phase B implementation notes:
   *   - Driver impedance model: Z(f) = Re + j(2πf·Le) + Zmotion(f)
   *   - Zmotion = (BL²) / (Rms + j(2πf·Mms − Cms/(2πf)))
   *   - Network transformation: depends on L-pad / series / parallel topology
   */
  calculateImpedance(
    driver: DriverSpec,
    crossover_section: CrossoverSection,
    options?: SimulationOptions
  ): Promise<ImpedanceResponse>;

  /**
   * Compute power response and directivity index (CTA-2034 method).
   *
   * Phase B: stub — deferred to Phase C.
   * Phase C implementation: requires off-axis responses at multiple angles.
   */
  calculatePowerResponse(
    design: SpeakerDesign,
    options?: SimulationOptions
  ): Promise<FrequencyResponse>;

  /**
   * Run a complete simulation of an entire SpeakerDesign.
   *
   * Convenience wrapper: runs enclosure, crossover, impedance, and summation
   * in the correct dependency order, populates a SimulationCache.
   *
   * Phase B should implement this as the primary entry point.
   */
  simulateDesign(
    design: SpeakerDesign,
    options?: SimulationOptions
  ): Promise<SimulationCache>;
}

export type SimulationCapability =
  | 'enclosure'
  | 'crossover'
  | 'summation'
  | 'impedance'
  | 'power_response'
  | 'directivity'
  | 'room_model';

export interface SimulationOptions {
  /** Override the default frequency grid. */
  grid?: FrequencyGrid;

  /** If true, bypass cache and recompute from scratch. Default: false. */
  force_recompute?: boolean;

  /** If true, emit diagnostic information during computation. Default: false. */
  verbose?: boolean;

  /** Abort computation if it exceeds this duration, ms. Default: 30000. */
  timeout_ms?: number;
}
```

---

## 5.5 Phase A Stub Implementation

The stub satisfies the interface contract and produces typed placeholders. Agents can call it to get back correctly-shaped data structures without any math. This allows:
- UI components to render against real types in Phase A
- Agent prompts to reference typed data shapes
- Integration tests to run end-to-end without a real engine

```typescript
import type {
  SimulationEngine,
  SimulationCapability,
  SimulationOptions,
  FrequencyResponse,
  ImpedanceResponse,
  DriverSpec,
  EnclosureDesign,
  CrossoverSection,
  SpeakerDesign,
  SimulationCache,
  FrequencyGrid,
} from './acoustic-types';

/**
 * Phase A stub simulation engine.
 *
 * Returns correctly-typed empty responses. All magnitude arrays are
 * zeroed (0 dB, representing unity gain — not silence). All phase
 * arrays are zeroed. Metadata marks data_origin as 'stub'.
 *
 * Agents should treat stub output as "no simulation data available"
 * and rely on their domain knowledge for actual guidance.
 */
export class StubSimulationEngine implements SimulationEngine {
  readonly engine_id = 'stub-v1';
  readonly version = '1.0.0';
  readonly capabilities: SimulationCapability[] = [];

  private buildEmptyGrid(options?: SimulationOptions): FrequencyGrid {
    const grid = options?.grid ?? STANDARD_GRID_96PPD;
    // In Phase A, frequencies_hz is populated lazily via buildStandardGrid()
    if (grid.frequencies_hz.length === 0) {
      grid.frequencies_hz = buildStandardGrid(grid.f_min_hz, grid.f_max_hz, grid.point_count);
    }
    return grid;
  }

  private emptyResponse(label: string, options?: SimulationOptions): FrequencyResponse {
    const grid = this.buildEmptyGrid(options);
    return {
      grid,
      magnitude_db: new Array(grid.point_count).fill(0),
      phase_deg: new Array(grid.point_count).fill(0),
      label,
      metadata: {
        data_origin: 'stub',
        computed_at: new Date().toISOString(),
        engine_id: this.engine_id,
        warnings: ['Stub engine: no simulation math performed. Phase A placeholder only.'],
      },
    };
  }

  private emptyImpedance(label: string, nominal_ohms: number, options?: SimulationOptions): ImpedanceResponse {
    const grid = this.buildEmptyGrid(options);
    return {
      grid,
      magnitude_ohms: new Array(grid.point_count).fill(nominal_ohms),
      phase_deg: new Array(grid.point_count).fill(0),
      nominal_impedance_ohms: nominal_ohms,
      label,
      metadata: {
        data_origin: 'stub',
        computed_at: new Date().toISOString(),
        engine_id: this.engine_id,
        warnings: ['Stub engine: flat impedance at nominal value. Phase A placeholder only.'],
      },
    };
  }

  async simulateEnclosure(
    driver: DriverSpec,
    enclosure: EnclosureDesign,
    options?: SimulationOptions
  ): Promise<FrequencyResponse> {
    return this.emptyResponse(`Enclosure sim: ${driver.model} in ${enclosure.type} ${enclosure.volume_net_liters}L`, options);
  }

  async simulateCrossover(
    section: CrossoverSection,
    driver_impedance: ImpedanceResponse,
    options?: SimulationOptions
  ): Promise<FrequencyResponse> {
    return this.emptyResponse(`Crossover: ${section.driver_role} ${section.filter_type} @ ${section.crossover_freq_hz}Hz`, options);
  }

  async sumResponses(
    responses: FrequencyResponse[],
    options?: SimulationOptions
  ): Promise<FrequencyResponse> {
    return this.emptyResponse(`Summed response (${responses.length} drivers)`, options);
  }

  async calculateImpedance(
    driver: DriverSpec,
    crossover_section: CrossoverSection,
    options?: SimulationOptions
  ): Promise<ImpedanceResponse> {
    return this.emptyImpedance(
      `Impedance: ${driver.model} + ${crossover_section.driver_role} network`,
      driver.nominal_impedance_ohms,
      options
    );
  }

  async calculatePowerResponse(
    design: SpeakerDesign,
    options?: SimulationOptions
  ): Promise<FrequencyResponse> {
    return this.emptyResponse(`Power response: ${design.name}`, options);
  }

  async simulateDesign(
    design: SpeakerDesign,
    options?: SimulationOptions
  ): Promise<SimulationCache> {
    const now = new Date().toISOString();
    return {
      system_response: this.emptyResponse(`System: ${design.name}`, options) as FrequencyResponse,
      driver_responses: design.drivers.map(d =>
        this.emptyResponse(`Driver: ${d.model}`, options) as FrequencyResponse
      ),
      system_impedance: this.emptyImpedance(
        `System impedance: ${design.name}`,
        design.crossover.nominal_impedance_ohms ?? 8,
        options
      ) as ImpedanceResponse,
      last_simulated_at: now,
      engine_id: this.engine_id,
    };
  }
}

/**
 * Build a logarithmically-spaced frequency array.
 * Used to populate FrequencyGrid.frequencies_hz at initialization.
 */
export function buildStandardGrid(f_min: number, f_max: number, points: number): number[] {
  const result: number[] = [];
  const log_min = Math.log10(f_min);
  const log_max = Math.log10(f_max);
  for (let i = 0; i < points; i++) {
    const log_f = log_min + (i / (points - 1)) * (log_max - log_min);
    result.push(Math.pow(10, log_f));
  }
  return result;
}
```

---

## 5.6 Phase B Implementation Roadmap

Phase B replaces `StubSimulationEngine` with a real implementation. The work is ordered by dependency and complexity.

### Priority order

**Tier 1 — Foundation (implement first):**

| Operation | Formula | Complexity | Notes |
|-----------|---------|------------|-------|
| Closed-box enclosure | `f3 = fs * √(Vas/Vb + 1) / Qtc` | Low | Second-order high-pass, analytic solution |
| Driver impedance model | `Z(f) = Re + j·2πf·Le + Zmech(f)` | Medium | Requires solving complex expression per frequency |
| Butterworth filter | `H(s) = 1/(s² + s·√2 + 1)` normalized | Low | Standard analog prototype, bilinear transform |
| Complex response sum | Vector addition per frequency bin | Low | Pure math, no acoustics domain knowledge needed |

**Tier 2 — Mainstream (implement second):**

| Operation | Formula | Complexity | Notes |
|-----------|---------|------------|-------|
| Ported enclosure | Helmholtz + driver system | Medium | 4th-order bandpass high-pass analogy |
| Linkwitz-Riley filter | `H(s) = [Butterworth(s)]²` | Low | Once Butterworth done, LR is trivial |
| Bessel filter | Bessel polynomial roots | Medium | Require polynomial table or solver |
| Passive component network | Ladder network impedance transform | High | Requires circuit solver for arbitrary topologies |

**Tier 3 — Advanced (Phase C boundary):**

| Operation | Formula | Complexity | Notes |
|-----------|---------|------------|-------|
| Power response (CTA-2034) | Spatial average of polar data | High | Requires off-axis measurements as input |
| Directivity Index | DI(f) = 10·log₁₀(on-axis / power) | Low | Once power response is available |
| Passive radiator tuning | Coupled resonator system | High | Two coupled resonators, 4th-order system |
| Transmission line | Distributed parameter model | Very High | Defer to Phase C |

### Closed-box formula expansion

For Tier 1, the closed-box enclosure simulation uses the following relationships:

```
Qtc = Qts * sqrt(Vab / Vas)      where Vab = Vb + Vd (net + driver displacement equivalent)

Actually: let α = Vas / Vb
  Qtc = Qts * sqrt(1 + α)
  fc  = fs  * sqrt(1 + α)        (system resonant frequency in box)
  f3  = fc / sqrt(2^(1/2) - 1)   (approximate, Butterworth alignment)

For arbitrary Qtc:
  f3 = fc * sqrt( (1/(2*Qtc²)) - 1 + sqrt( (1/(2*Qtc²) - 1)² + 1 ) )
```

The transfer function is a second-order high-pass:

```
H(s) = s² / (s² + s·(ωc/Qtc) + ωc²)    where ωc = 2π·fc
```

This is evaluated at each frequency point as: `s = j·2π·f`

### Recommended Phase B architecture

```
simulation/
├── engine-interface.ts       # SimulationEngine + types (already exists from Phase A)
├── stub-engine.ts            # StubSimulationEngine (Phase A, keep for testing)
├── native-engine.ts          # NativeAcousticsEngine (Phase B implementation)
├── math/
│   ├── enclosure.ts          # Closed-box, ported, PR transfer functions
│   ├── filters.ts            # Butterworth, LR, Bessel transfer functions
│   ├── impedance.ts          # Driver impedance model
│   ├── summation.ts          # Complex vector summation
│   └── grid.ts               # Frequency grid construction (buildStandardGrid)
└── vituixcad-bridge.ts       # Optional: shell out to VituixCAD CLI if available
```

### Engine selection at runtime

```typescript
/**
 * Factory that returns the best available engine at runtime.
 * Agents always call through this — never instantiate engines directly.
 */
export function getSimulationEngine(): SimulationEngine {
  if (process.env.APEX_SIMULATION_ENGINE === 'native') {
    return new NativeAcousticsEngine();  // Phase B
  }
  if (process.env.APEX_SIMULATION_ENGINE === 'vituixcad') {
    return new VituixCadBridgeEngine();  // Phase B (optional)
  }
  return new StubSimulationEngine();     // Phase A (default)
}
```

The `APEX_SIMULATION_ENGINE` environment variable is the Phase A → B switch. No agent code changes required when Phase B ships.

---

## 5.7 Standard Alignment Presets

Named enclosure alignments represent specific Qtc / tuning targets derived from filter theory. Agents reference these by name. The simulation engine uses the target Qtc to determine whether a given driver-enclosure combination matches a named alignment.

```typescript
export type AlignmentPresetName = 'B4' | 'QB3' | 'SC4' | 'C4' | 'BU' | 'custom';

/**
 * A named enclosure alignment — a specific combination of Qtc, tuning,
 * and target frequency response shape derived from filter theory.
 *
 * These are the standard alignments from Thiele's and Small's original papers
 * (1971–1973), as codified in Bullock's "Cookbook" and used by VituixCAD.
 */
export interface AlignmentPreset {
  name: AlignmentPresetName;

  /** Full descriptive name. */
  display_name: string;

  /** Filter theory analog (the prototype filter this alignment maps to). */
  filter_analog: string;

  /** Target system Q factor (Qtc for sealed; Qb for ported). */
  target_Qtc?: number;

  /** Target ported box tuning ratio Fb/Fs. Only for ported alignments. */
  target_Fb_Fs_ratio?: number;

  /** Target system −3 dB frequency as ratio to fs. */
  target_f3_fs_ratio?: number;

  /** Typical transient behavior description. */
  transient_character: string;

  /** Typical bass extension character. */
  bass_character: string;

  /**
   * Recommended driver Qts range for this alignment.
   * Drivers outside this range will require a different alignment.
   */
  recommended_Qts_range: { min: number; max: number };

  /** Box type this alignment applies to. */
  enclosure_type: 'sealed' | 'ported';

  notes: string;
}

/**
 * Standard alignment preset registry.
 *
 * Sources:
 *   Thiele, A.N. (1971) — "Loudspeakers in Vented Boxes"
 *   Small, R.H. (1973) — "Vented-Box Loudspeaker Systems"
 *   Bullock, R.M. (1981) — "Thiele, Small, and Vented Loudspeakers: A Review"
 */
export const ALIGNMENT_PRESETS: Record<AlignmentPresetName, AlignmentPreset> = {

  /**
   * B4 — Butterworth 4th Order (Ported)
   * The maximally flat amplitude alignment for ported enclosures.
   * Optimal for flat in-room extension; steep rolloff below tuning.
   */
  B4: {
    name: 'B4',
    display_name: 'Butterworth 4th Order',
    filter_analog: '4th-order Butterworth high-pass',
    target_Fb_Fs_ratio: 1.0,     // Fb = Fs
    target_f3_fs_ratio: 1.0,     // f3 ≈ Fs
    transient_character: 'Good — no overshoot in step response',
    bass_character: 'Maximally flat, extended',
    recommended_Qts_range: { min: 0.30, max: 0.40 },
    enclosure_type: 'ported',
    notes: 'Classic alignment. Most VituixCAD users start here. Requires Qts ≈ 0.38 for ideal match. Box volume determined by Fs/Qts ratio.',
  },

  /**
   * QB3 — Quasi-Butterworth 3rd Order (Ported)
   * Smaller box than B4 for the same driver. Slightly peaked response
   * compensates for box size reduction. Common in bookshelf designs.
   */
  QB3: {
    name: 'QB3',
    display_name: 'Quasi-Butterworth 3rd Order',
    filter_analog: '3rd-order Butterworth analog (approximated)',
    target_Fb_Fs_ratio: 0.90,    // Fb slightly below Fs
    target_f3_fs_ratio: 1.05,    // f3 slightly above Fs
    transient_character: 'Moderate — slight overshoot',
    bass_character: 'Good extension in smaller box; slight hump before rolloff',
    recommended_Qts_range: { min: 0.35, max: 0.50 },
    enclosure_type: 'ported',
    notes: 'Tradeoff: smaller box than B4 at the cost of a small (~1-2 dB) response peak near tuning. Preferred for bookshelf designs where box volume is constrained.',
  },

  /**
   * SC4 — Sub-Chebyshev 4th Order (Ported)
   * More extended bass than QB3 with larger box. Exhibits more ripple.
   * Used when maximum bass extension is the priority over flatness.
   */
  SC4: {
    name: 'SC4',
    display_name: 'Sub-Chebyshev 4th Order',
    filter_analog: '4th-order Chebyshev (subcritical ripple)',
    target_Fb_Fs_ratio: 1.05,    // Fb slightly above Fs
    target_f3_fs_ratio: 0.95,    // f3 slightly below Fs — extended!
    transient_character: 'Fair — more overshoot than QB3',
    bass_character: 'Extended below fs; some ripple in passband',
    recommended_Qts_range: { min: 0.25, max: 0.38 },
    enclosure_type: 'ported',
    notes: 'Maximizes bass extension at the cost of passband ripple. Use when room gain or DSP correction is available to tame the ripple.',
  },

  /**
   * C4 — Critically Damped 4th Order (Ported)
   * The lowest ripple ported alignment; tightest transients.
   * Requires larger box than B4. Preferred for studio monitors.
   */
  C4: {
    name: 'C4',
    display_name: 'Critically Damped 4th Order',
    filter_analog: '4th-order Critically Damped (two cascaded 2nd-order)',
    target_Fb_Fs_ratio: 0.80,    // Fb well below Fs
    target_f3_fs_ratio: 1.20,    // f3 above Fs — sacrifices extension
    transient_character: 'Excellent — no overshoot, fastest settling',
    bass_character: 'Clean, tight; less deep than B4',
    recommended_Qts_range: { min: 0.20, max: 0.35 },
    enclosure_type: 'ported',
    notes: 'Best transient accuracy. Box is large. f3 is higher than B4 — tradeoff is extension for tightness. Preferred for studio reference monitors and audiophile two-way designs.',
  },

  /**
   * BU — Butterworth 2nd Order Sealed (Sealed)
   * The standard sealed-box alignment. Qtc = 0.707 (1/√2).
   * Maximally flat for sealed enclosures. 12 dB/oct rolloff.
   */
  BU: {
    name: 'BU',
    display_name: 'Butterworth Sealed (Qtc = 0.707)',
    filter_analog: '2nd-order Butterworth high-pass',
    target_Qtc: 0.707,
    target_f3_fs_ratio: 1.0,
    transient_character: 'Good — slight overshoot (~4%) in step response',
    bass_character: 'Maximally flat, gentle rolloff',
    recommended_Qts_range: { min: 0.30, max: 0.50 },
    enclosure_type: 'sealed',
    notes: 'Starting point for all sealed designs. Qtc = 0.707 gives maximally flat response. Box volume determined by: Vb = Vas / ((Qtc/Qts)² - 1). Higher Qts drivers need smaller boxes; lower Qts drivers need larger boxes to achieve target Qtc.',
  },

  /**
   * Custom alignment — placeholder for user-defined targets.
   */
  custom: {
    name: 'custom',
    display_name: 'Custom / User-Defined',
    filter_analog: 'User-specified',
    transient_character: 'Depends on target Qtc / tuning',
    bass_character: 'Depends on target Qtc / tuning',
    recommended_Qts_range: { min: 0.1, max: 1.0 },
    enclosure_type: 'sealed',
    notes: 'User-specified alignment. Set target_Qtc or target_Fb_Fs_ratio manually.',
  },
};

/**
 * Given a driver's Qts and a target alignment, compute the required enclosure volume.
 *
 * Phase A: this is a pure formula — no simulation engine needed.
 * Agents can call this directly to give concrete box size recommendations.
 */
export function computeSealedBoxVolume(
  driver: Pick<ThieleSmallParams, 'Qts' | 'Vas_liters'>,
  target_Qtc: number
): number {
  // Vb = Vas / ((Qtc / Qts)² - 1)
  const ratio = target_Qtc / driver.Qts;
  const denominator = ratio * ratio - 1;
  if (denominator <= 0) {
    throw new Error(
      `Target Qtc ${target_Qtc} is not achievable for driver Qts ${driver.Qts}. ` +
      `Qtc must be greater than Qts. Consider a different alignment or driver.`
    );
  }
  return driver.Vas_liters / denominator;
}

/**
 * Estimate the system resonant frequency in a sealed box.
 */
export function computeSealedSystemFrequency(
  driver: Pick<ThieleSmallParams, 'fs_hz' | 'Vas_liters'>,
  volume_net_liters: number
): { fc_hz: number; Qtc: number } {
  const alpha = driver.Vas_liters / volume_net_liters;
  const fc_hz = driver.fs_hz * Math.sqrt(1 + alpha);
  // Note: Qtc requires Qts which is not in this Pick — caller must provide full ThieleSmallParams
  // This is an intentional partial helper; see computeSealedBoxVolume for full usage
  return { fc_hz, Qtc: NaN }; // Qtc filled by caller with full params
}
```

---

## 5.8 Agent Usage Patterns

Agents do not call `SimulationEngine` methods directly in Phase A. Instead, they:

1. **Reference types** to structure their reasoning (e.g., construct a `SpeakerDesign` object from user-described parameters)
2. **Call pure formula helpers** (e.g., `computeSealedBoxVolume`) for exact numeric answers
3. **Format T/S parameter sets** into `DriverSpec` objects when parsing datasheets
4. **Cite alignment presets** from `ALIGNMENT_PRESETS` when recommending enclosure types

In Phase B, agents will call `getSimulationEngine().simulateDesign(design)` and interpret the `SimulationCache` result. The agent prompt templates will include instructions for interpreting simulation output — these are drafted in Phase A (types available) even before Phase B ships.

### Example agent interaction (Phase A)

```
User: I have a Scanspeak 18W/8531G00 with Qts=0.36, Vas=17L, fs=28Hz.
      What size sealed box should I use?

Enclosure Agent reasoning:
  1. Parse driver → DriverSpec (partial T/S from user input)
  2. Target Butterworth sealed alignment: Qtc = 0.707
  3. computeSealedBoxVolume({ Qts: 0.36, Vas_liters: 17 }, 0.707)
     → Vb = 17 / ((0.707/0.36)² - 1) = 17 / (3.86 - 1) = 17 / 2.86 ≈ 5.94 L
  4. Respond: "For a Butterworth (Qtc=0.707) alignment, you need approximately 6 liters net.
              That's quite small — this driver has high Qts (0.36) which is favorable for
              sealed designs. Consider 8-10 liters for a higher Qtc (0.55-0.60) if you
              want a warmer sound with more bass at the cost of slight hump."
```

This is Phase A behavior: pure formula math + domain reasoning. No simulation engine invoked.

---

## 5.9 File Locations

When Phase B is implemented, create files at these paths:

```
src/
├── simulation/
│   ├── acoustic-types.ts         # All interfaces from this section
│   ├── alignment-presets.ts      # ALIGNMENT_PRESETS registry + formula helpers
│   ├── engine-interface.ts       # SimulationEngine interface + SimulationOptions
│   ├── stub-engine.ts            # StubSimulationEngine
│   ├── engine-factory.ts         # getSimulationEngine() factory
│   └── math/
│       ├── enclosure.ts          # Phase B: closed-box, ported formulas
│       ├── filters.ts            # Phase B: Butterworth, LR, Bessel
│       ├── impedance.ts          # Phase B: driver impedance model
│       ├── summation.ts          # Phase B: complex vector sum
│       └── grid.ts               # buildStandardGrid() + STANDARD_GRID_96PPD
```

All types are exported from a single barrel:

```typescript
// src/simulation/index.ts
export * from './acoustic-types';
export * from './alignment-presets';
export * from './engine-interface';
export * from './stub-engine';
export * from './engine-factory';
```

Agents import from `'@/simulation'` (aliased to `src/simulation/index.ts`).

---

## 5.10 Summary

This section establishes the type contract between Phase A reasoning agents and Phase B simulation engines. Key decisions:

| Decision | Rationale |
|----------|-----------|
| All arrays share a `FrequencyGrid` object | Prevents mismatched-length bugs at the language level |
| Units in property names (`_hz`, `_liters`, `_mm`) | Eliminates unit confusion without runtime cost |
| `SimulationEngine` is async | Phase B engines may shell out to external tools; async from day one avoids migration |
| `data_origin: 'stub'` on all Phase A outputs | Agents and UI can detect "no real data" and display appropriate caveats |
| Pure formula helpers (sealed box math) in Phase A | Agents can provide exact numeric answers for common cases without waiting for Phase B |
| `getSimulationEngine()` factory pattern | Phase A → B transition is a single environment variable change; zero agent code changes |
| `ALIGNMENT_PRESETS` as a named registry | Agents cite presets by name consistently; no hallucinated Qtc values |

Phase B implementation should begin with Tier 1 operations (closed-box enclosure + Butterworth filter + complex summation) as they are mutually independent and together unlock the most common use case: simulating a 2-way speaker with a sealed woofer and a Butterworth or Linkwitz-Riley crossover.
