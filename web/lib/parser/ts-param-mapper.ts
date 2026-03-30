// Maps VituixCAD native parameter names → canonical ThieleSmallParams
// VituixCAD XML uses short names (Re, fs, BL); we use unit-suffixed canonical names

import type { ThieleSmallParams } from '../types/speaker-domain';
export { isCompleteThieleSmall } from '../types/speaker-domain';

interface VxdParamRaw {
  _n: string;
  _v: string | number;
  _u?: string;
}

const PARAM_MAP: Record<string, keyof ThieleSmallParams> = {
  Re:   'Re_ohms',
  Le:   'Le_mH',
  Mms:  'Mms_g',
  Cms:  'Cms_mmPerN',
  Rms:  'Rms_kgPerS',
  Sd:   'Sd_cm2',
  Xmax: 'Xmax_mm',
  BL:   'BL_Tm',
  fs:   'fs_hz',
  Qts:  'Qts',
  Qes:  'Qes',
  Qms:  'Qms',
  SPL:  'SPL_1w1m_dB',
  Pe:   'Pmax_W',
  Vas:  'Vas_L',
};

export function mapThieleSmall(params: VxdParamRaw[]): Partial<ThieleSmallParams> {
  const result: Partial<ThieleSmallParams> = {};
  for (const param of params) {
    const canonical = PARAM_MAP[param._n];
    if (canonical !== undefined) {
      (result as Record<string, number>)[canonical] = Number(param._v);
    }
  }
  return result;
}
