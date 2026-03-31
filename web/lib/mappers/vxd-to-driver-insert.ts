import type { VxdDriverRaw } from '../parser/vituixcad-native';
import { mapThieleSmall } from '../parser/ts-param-mapper';
import { inferDriverType } from './infer-driver-type';
import type { driverDatabase } from '../db/schema';
import type { InferInsertModel } from 'drizzle-orm';

type DriverInsert = InferInsertModel<typeof driverDatabase>;

/**
 * Maps a raw VxdDriverRaw (from the VituixCAD parser) to a Drizzle insert
 * object for the driver_database table.
 */
export function vxdDriverToInsert(raw: VxdDriverRaw): DriverInsert {
  const ts = mapThieleSmall(raw.PARAM ?? []);

  // Manufacturer / model split
  let manufacturer: string;
  let model: string;

  if (raw._brand) {
    manufacturer = raw._brand;
    model = raw._name;
  } else {
    const spaceIdx = raw._name.indexOf(' ');
    if (spaceIdx === -1) {
      manufacturer = 'Unknown';
      model = raw._name;
    } else {
      manufacturer = raw._name.slice(0, spaceIdx);
      model = raw._name.slice(spaceIdx + 1);
    }
  }

  const driverType = inferDriverType(raw._category, ts.fs_hz);

  return {
    manufacturer,
    model,
    driverType,
    // Thiele-Small params
    reOhm:           ts.Re_ohms,
    leMh:            ts.Le_mH,
    bl:              ts.BL_Tm,
    fsHz:            ts.fs_hz,
    qts:             ts.Qts,
    qes:             ts.Qes,
    qms:             ts.Qms,
    vasLiters:       ts.Vas_L,
    mmsGrams:        ts.Mms_g,
    cmsMmPerN:       ts.Cms_mmPerN,
    rmsKgS:          ts.Rms_kgPerS,
    sdCm2:           ts.Sd_cm2,
    xmaxMm:          ts.Xmax_mm,
    sensitivity1m1w: ts.SPL_1w1m_dB,
    powerWatts:      ts.Pmax_W,
    // Metadata
    source:  'vituixcad_import',
    rawData: raw as unknown as Record<string, unknown>,
  };
}
