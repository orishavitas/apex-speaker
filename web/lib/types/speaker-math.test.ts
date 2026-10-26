import { describe, expect, it } from 'vitest';

import { calcHornLoading } from './speaker-math';
import type { HornConfig, ThieleSmallParams } from './speaker-domain';

describe('calcHornLoading', () => {
  it('uses the correct Vas units for horn reference efficiency', () => {
    const ts: ThieleSmallParams = {
      Re_ohms: 6.2,
      Le_mH: 0.8,
      Mms_g: 28,
      Cms_mmPerN: 0.75,
      Rms_kgPerS: 1.2,
      Sd_cm2: 220,
      Xmax_mm: 5,
      BL_Tm: 8.5,
      fs_hz: 35,
      Qts: 0.32,
      Qes: 0.35,
      Qms: 3.8,
      SPL_1w1m_dB: 88,
      Pmax_W: 80,
      Vas_L: 40,
    };
    const horn: HornConfig = {
      variant: 'exponential',
      throat_area_cm2: 220,
      mouth_area_cm2: 1600,
      length_mm: 700,
      cutoff_hz: 120,
      coverage_h_deg: 90,
      coverage_v_deg: 60,
    };

    const result = calcHornLoading(ts, horn);

    expect(result.efficiency_pct).toBeGreaterThan(0.1);
    expect(result.efficiency_pct).toBeGreaterThanOrEqual(0.1);
    expect(result.efficiency_pct).toBeLessThanOrEqual(5);
    expect(result.efficiency_pct).toBeCloseTo(0.48, 2);
  });
});
