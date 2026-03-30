// Math stub signatures — Phase A returns typed zeros.
// Phase B replaces function bodies only. Do NOT change signatures.

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

export function calcSealedBox(
  _ts: ThieleSmallParams,
  _enclosure: EnclosureConfig,
): SealedBoxResult {
  throw new Error('calcSealedBox: not implemented — Sprint 2');
}

export function calcPortedBox(
  _ts: ThieleSmallParams,
  _enclosure: EnclosureConfig,
): PortedBoxResult {
  throw new Error('calcPortedBox: not implemented — Sprint 2');
}

export function calcHornLoading(
  _ts: ThieleSmallParams,
  _horn: Extract<LoadingConfig, { variant: HornProfile }>,
): HornResult {
  throw new Error('calcHornLoading: not implemented — Sprint 2');
}
